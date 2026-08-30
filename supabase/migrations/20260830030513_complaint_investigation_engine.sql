create table if not exists public.complaint_investigation_audit (
  id uuid primary key default gen_random_uuid(),
  merchant_reference text,
  tx_id bigint not null,
  sms_id bigint,
  action text not null check (action in ('approve_paid', 'link_sms', 'reject_complaint')),
  actor_id uuid not null,
  actor_name text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists complaint_investigation_audit_tx_created_idx
  on public.complaint_investigation_audit (tx_id, created_at desc);

alter table public.complaint_investigation_audit enable row level security;

drop policy if exists complaint_audit_staff_select on public.complaint_investigation_audit;
create policy complaint_audit_staff_select
  on public.complaint_investigation_audit for select
  to authenticated
  using ((select public.is_staff()));

drop policy if exists complaint_audit_staff_insert on public.complaint_investigation_audit;
create policy complaint_audit_staff_insert
  on public.complaint_investigation_audit for insert
  to authenticated
  with check ((select public.is_staff()) and actor_id = (select auth.uid()));

grant select, insert on public.complaint_investigation_audit to authenticated;
revoke all on public.complaint_investigation_audit from anon;

create or replace function public.investigate_merchant_complaints(
  p_references text[],
  p_master_merchant text default 'NGPay'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with requested as (
  select distinct trim(value) as merchant_reference
  from unnest(coalesce(p_references, array[]::text[])) as value
  where trim(value) ~ '^[0-9]{11}$'
), tx as (
  select
    r.merchant_reference,
    mt.tx_id,
    upper(coalesce(mt.status, '')) as status,
    mt.amount,
    mt.currency,
    mt.sender_number,
    coalesce(nullif(mt.receiving_wallet, ''), nullif(mt.to_account_number, '')) as receiving_wallet,
    coalesce(
      case when mt.created_utc ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}'
        then (replace(left(mt.created_utc, 19), 'T', ' ')::timestamp at time zone 'UTC') end,
      mt.first_seen_at
    ) as created_at,
    mt.last_status_change,
    mt.approved_by,
    mt.master_merchant,
    mt.guid
  from requested r
  left join public.maven_transactions mt
    on trim(mt.raw->>'Reference1') = r.merchant_reference
   and case
     when lower(p_master_merchant) = 'payfuture' then
       lower(coalesce(mt.master_merchant, '') || ' ' || coalesce(mt.gateway, '')) like '%payfuture%'
       or lower(coalesce(mt.master_merchant, '') || ' ' || coalesce(mt.gateway, '')) like '%avadapay%'
     else
       lower(coalesce(mt.master_merchant, '') || ' ' || coalesce(mt.gateway, '')) like '%ngpay%'
       or lower(coalesce(mt.master_merchant, '') || ' ' || coalesce(mt.gateway, '')) like '%nagupay%'
   end
), evaluated as (
  select
    tx.*,
    conflict.sms_id as conflict_sms_id,
    conflict.received_at as conflict_sms_at,
    sibling.tx_id as sibling_tx_id,
    candidates.unconsumed_count,
    candidates.total_count as candidate_count,
    candidates.first_unconsumed_id,
    candidates.first_unconsumed_at,
    candidates.first_other_id,
    candidates.first_other_at,
    candidates.first_other_tx_id,
    candidates.first_other_sender_diff
  from tx
  left join lateral (
    select s.id as sms_id, s.received_at
    from public.inbound_sms s
    where s.consumed_by_tx_id = tx.tx_id
    order by s.received_at asc nulls last, s.id
    limit 1
  ) conflict on true
  left join lateral (
    select other.tx_id
    from public.maven_transactions other
    where tx.tx_id is not null
      and other.tx_id <> tx.tx_id
      and upper(coalesce(other.status, '')) = 'PAID'
      and other.amount = tx.amount
      and other.sender_number is not distinct from tx.sender_number
      and tx.sender_number is not null
      and coalesce(
        case when other.created_utc ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}'
          then (replace(left(other.created_utc, 19), 'T', ' ')::timestamp at time zone 'UTC') end,
        other.first_seen_at
      ) between tx.created_at - interval '30 minutes' and tx.created_at + interval '30 minutes'
    order by abs(extract(epoch from (coalesce(other.first_seen_at, tx.created_at) - tx.created_at)))
    limit 1
  ) sibling on true
  left join lateral (
    select
      count(*)::int as total_count,
      count(*) filter (where s.consumed_by_tx_id is null)::int as unconsumed_count,
      (array_agg(s.id order by s.received_at, s.id) filter (where s.consumed_by_tx_id is null))[1] as first_unconsumed_id,
      (array_agg(s.received_at order by s.received_at, s.id) filter (where s.consumed_by_tx_id is null))[1] as first_unconsumed_at,
      (array_agg(s.id order by s.received_at, s.id) filter (where s.consumed_by_tx_id is not null and s.consumed_by_tx_id <> tx.tx_id))[1] as first_other_id,
      (array_agg(s.received_at order by s.received_at, s.id) filter (where s.consumed_by_tx_id is not null and s.consumed_by_tx_id <> tx.tx_id))[1] as first_other_at,
      (array_agg(s.consumed_by_tx_id order by s.received_at, s.id) filter (where s.consumed_by_tx_id is not null and s.consumed_by_tx_id <> tx.tx_id))[1] as first_other_tx_id,
      bool_or(
        s.consumed_by_tx_id is not null
        and s.consumed_by_tx_id <> tx.tx_id
        and s.sender_number is not null
        and other_tx.sender_number is distinct from s.sender_number
      ) as first_other_sender_diff
    from public.inbound_sms s
    left join public.maven_transactions other_tx on other_tx.tx_id = s.consumed_by_tx_id
    where tx.tx_id is not null
      and s.amount = tx.amount
      and s.receiver_number = tx.receiving_wallet
      and s.received_at between tx.created_at - interval '15 minutes' and tx.created_at + interval '90 minutes'
      and (s.sender_number is null or s.sender_number = tx.sender_number)
  ) candidates on true
), verdicts as (
  select *,
    case
      when tx_id is null then 'not_found'
      when status = 'PAID' then 'already_paid'
      when status = 'DECLINED' and conflict_sms_id is not null then 'engine_conflict'
      when sibling_tx_id is not null then 'duplicate_submission'
      when coalesce(unconsumed_count, 0) = 1 then 'valid_unlinked'
      when coalesce(unconsumed_count, 0) > 1 then 'manual_review'
      when first_other_tx_id is not null and coalesce(first_other_sender_diff, false) then 'misallocated'
      when first_other_tx_id is not null then 'manual_review'
      else 'correctly_declined'
    end as verdict
  from evaluated
), shaped as (
  select
    merchant_reference,
    tx_id,
    status,
    amount,
    coalesce(currency, 'EGP') as currency,
    sender_number,
    receiving_wallet,
    created_at as created_utc,
    last_status_change,
    approved_by,
    master_merchant,
    verdict,
    case
      when verdict = 'engine_conflict' then conflict_sms_id
      when verdict in ('valid_unlinked', 'manual_review') and first_unconsumed_id is not null then first_unconsumed_id
      when verdict in ('misallocated', 'manual_review') then first_other_id
      else null
    end as sms_id,
    case
      when verdict = 'engine_conflict' then conflict_sms_at
      when verdict in ('valid_unlinked', 'manual_review') and first_unconsumed_at is not null then first_unconsumed_at
      when verdict in ('misallocated', 'manual_review') then first_other_at
      else null
    end as sms_timestamp,
    case
      when verdict = 'engine_conflict' and last_status_change is not null and conflict_sms_at is not null
        then round(extract(epoch from (conflict_sms_at - last_status_change)) / 60.0, 2)
      when verdict in ('valid_unlinked', 'manual_review', 'misallocated') and created_at is not null
        then round(extract(epoch from (coalesce(first_unconsumed_at, first_other_at) - created_at)) / 60.0, 2)
      else null
    end as time_delta_minutes,
    case
      when verdict = 'engine_conflict' and conflict_sms_at > last_status_change then 'late SMS'
      when verdict = 'engine_conflict' and conflict_sms_at < created_at then 'SMS predates tx'
      when verdict = 'engine_conflict' then 'operator decline'
      when verdict = 'duplicate_submission' then 'paid sibling transaction'
      when verdict = 'valid_unlinked' then 'one unconsumed SMS on correct wallet'
      when verdict = 'manual_review' and coalesce(unconsumed_count, 0) > 1 then 'multiple SMS candidates'
      when verdict = 'manual_review' then 'SMS already consumed; sender inconclusive'
      when verdict = 'misallocated' then 'SMS consumed by transaction with different sender'
      when verdict = 'correctly_declined' then 'no SMS on correct wallet'
      when verdict = 'already_paid' then 'transaction already paid'
      else 'transaction not found for selected master merchant'
    end as cause,
    sibling_tx_id,
    first_other_tx_id as allocated_to_tx_id,
    coalesce(candidate_count, 0) as candidate_count
  from verdicts
)
select jsonb_build_object(
  'masterMerchant', p_master_merchant,
  'generatedAt', now(),
  'rows', coalesce(jsonb_agg(to_jsonb(shaped) order by array_position(
    array['engine_conflict','valid_unlinked','misallocated','manual_review','duplicate_submission','already_paid','correctly_declined','not_found'],
    verdict
  ), merchant_reference), '[]'::jsonb)
)
from shaped;
$$;

create or replace function public.apply_complaint_investigation_action(
  p_tx_id bigint,
  p_action text,
  p_sms_id bigint default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tx public.maven_transactions%rowtype;
  v_sms public.inbound_sms%rowtype;
  v_actor uuid := auth.uid();
  v_actor_name text := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_reference text;
  v_created timestamptz;
begin
  if v_actor is null or not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  if p_action not in ('approve_paid', 'link_sms', 'reject_complaint') then
    raise exception 'invalid_action';
  end if;

  select * into v_tx from public.maven_transactions where tx_id = p_tx_id for update;
  if not found then raise exception 'transaction_not_found'; end if;
  v_reference := trim(v_tx.raw->>'Reference1');
  v_created := coalesce(
    case when v_tx.created_utc ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}'
      then (replace(left(v_tx.created_utc, 19), 'T', ' ')::timestamp at time zone 'UTC') end,
    v_tx.first_seen_at
  );

  if p_action = 'link_sms' then
    if p_sms_id is null then raise exception 'sms_required'; end if;
    select * into v_sms from public.inbound_sms where id = p_sms_id for update;
    if not found then raise exception 'sms_not_found'; end if;
    if v_sms.consumed_by_tx_id is not null and v_sms.consumed_by_tx_id <> p_tx_id then
      raise exception 'sms_already_consumed';
    end if;
    if v_sms.amount is distinct from v_tx.amount
      or v_sms.receiver_number is distinct from coalesce(nullif(v_tx.receiving_wallet, ''), nullif(v_tx.to_account_number, ''))
      or v_sms.received_at not between v_created - interval '15 minutes' and v_created + interval '90 minutes'
      or (v_sms.sender_number is not null and v_sms.sender_number is distinct from v_tx.sender_number)
    then raise exception 'sms_match_rules_failed'; end if;

    update public.inbound_sms set
      consumed_by_tx_id = p_tx_id,
      matched_transaction_id = p_tx_id,
      matched = true,
      match_status = 'manual',
      review_required = false,
      processed_at = now()
    where id = p_sms_id;
  elsif p_action = 'approve_paid' then
    update public.maven_transactions
      set status = 'PAID', approved_by = v_actor_name, last_status_change = now(), updated_at = now()
      where tx_id = p_tx_id;
    insert into public.browser_jobs (
      tx_id, guid, amount, target_status, source, state, priority,
      operator_id, operator_username, metadata
    )
    select p_tx_id, v_tx.guid, v_tx.amount, 'PAID', 'complaint_investigation', 'pending', 90,
      v_actor, v_actor_name, jsonb_build_object('merchant_reference', v_reference, 'note', p_note)
    where not exists (
      select 1 from public.browser_jobs
      where tx_id = p_tx_id and target_status = 'PAID' and state in ('pending', 'running')
    );
  end if;

  insert into public.complaint_investigation_audit (
    merchant_reference, tx_id, sms_id, action, actor_id, actor_name,
    before_state, after_state, note
  ) values (
    v_reference, p_tx_id, p_sms_id, p_action, v_actor, v_actor_name,
    jsonb_build_object('status', v_tx.status, 'sms_consumed_by', case when p_sms_id is null then null else v_sms.consumed_by_tx_id end),
    jsonb_build_object('status', case when p_action = 'approve_paid' then 'PAID' else v_tx.status end, 'sms_consumed_by', case when p_action = 'link_sms' then p_tx_id else null end),
    nullif(trim(p_note), '')
  );

  return jsonb_build_object('ok', true, 'tx_id', p_tx_id, 'action', p_action, 'actor', v_actor_name, 'recorded_at', now());
end;
$$;

revoke execute on function public.investigate_merchant_complaints(text[], text) from public, anon;
revoke execute on function public.apply_complaint_investigation_action(bigint, text, bigint, text) from public, anon;
grant execute on function public.investigate_merchant_complaints(text[], text) to authenticated;
grant execute on function public.apply_complaint_investigation_action(bigint, text, bigint, text) to authenticated;
