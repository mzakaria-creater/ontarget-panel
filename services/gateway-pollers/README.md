# Gateway pollers

These services call the existing `gateway-api`; they do not recreate its storage or dedupe logic. Run `node services/gateway-pollers/runner.js` every 1–2 minutes with Node 20 and server-only `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). Provider credentials and endpoints are read from `maven_runtime_config`; optional `POLL_MASTER_MERCHANT` and `POLL_MERCHANT` select the merchant context.

The normalizer accepts common Maven/iGateway response field names and sends every payin/payout to `/ingest`. Re-running a poll is safe because the Gateway owns deduplication by provider, type, and external ID. Before production scheduling, set the provider login/list endpoint keys to the exact paths returned by each provider and run one dry poll against a non-production credential.
