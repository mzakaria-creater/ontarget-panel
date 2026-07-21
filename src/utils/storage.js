const PREFIX = 'ontarget-panel:filters:'

export function loadFilters(pageKey, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + pageKey)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function saveFilters(pageKey, filters) {
  try {
    localStorage.setItem(PREFIX + pageKey, JSON.stringify(filters))
  } catch {
    // localStorage unavailable — ignore
  }
}
