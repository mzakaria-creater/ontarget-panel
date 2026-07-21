import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('ontarget-theme') || 'light')
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const theme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    localStorage.setItem('ontarget-theme', mode)
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [mode, theme])

  const value = useMemo(() => ({
    mode,
    theme,
    setMode,
    toggleTheme: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [mode, theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
