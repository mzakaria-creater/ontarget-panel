export function isPlaceholderClientName(value) {
  return /^john$/i.test(String(value || '').trim())
}

export function displayClientName(...values) {
  return values.find((value) => value && !isPlaceholderClientName(value)) || ''
}

export function displayClientPhone(row = {}) {
  const walletNumbers = new Set([row.to_account_number, row.wallet_number, row.wallet, row.receiver_number, row.confirmed_wallet_number].filter(Boolean).map(String))
  const candidates = [row.matchedSms?.sender_number, row.sender_number, row.client_phone, row.user_phone_number, row.phone].filter(Boolean).map(String)
  return candidates.find((value) => !walletNumbers.has(value)) || ''
}
