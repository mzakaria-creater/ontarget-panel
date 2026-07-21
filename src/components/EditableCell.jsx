import { useEffect, useRef, useState } from 'react'

export default function EditableCell({ value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  const commit = () => {
    setEditing(false)
    if (String(draft) !== String(value ?? '')) {
      onSave?.(type === 'number' ? Number(draft) : draft)
    }
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        className="w-full rounded border border-gold/50 bg-surface px-2 py-1 text-sm text-text"
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="block cursor-text rounded px-2 py-1 hover:bg-border/30"
      title="اضغط للتعديل"
    >
      {value ?? '—'}
    </span>
  )
}
