import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const apps = [['/monitor', '📊'], ['/smslive', '📨'], ['/crm', '👥'], ['/hub/finance', '💰'], ['/tv', '📺'], ['/settings', '⚙️']]

export default function MacbookDock() {
  const navigate = useNavigate(); const [mode, setMode] = useState(() => localStorage.getItem('ot-view-mode') || 'list')
  useEffect(() => { document.body.dataset.viewMode = mode; localStorage.setItem('ot-view-mode', mode) }, [mode])
  function filter() { document.querySelector('input[placeholder*="Search"], input[placeholder*="بحث"], input[type="search"]')?.focus() }
  return <div className="macbook-dock-wrap"><div className="macbook-dock"><button className="macbook-dock-control" onClick={() => setMode('list')} aria-label="List view">☷<small>List</small></button><button className="macbook-dock-control" onClick={() => setMode('card')} aria-label="Card view">▦<small>Cards</small></button><button className="macbook-dock-control" onClick={filter} aria-label="Focus filters">⌕<small>Filter</small></button><span className="macbook-dock-divider" />{apps.map(([path, icon]) => <button key={path} onClick={() => navigate(path)} className="macbook-app-icon" title={path}>{icon}</button>)}</div></div>
}
