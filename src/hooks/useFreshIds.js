import { useEffect, useRef, useState } from 'react'

export function useFreshIds(rows, idKey = 'id', ttlMs = 2500) {
  const [freshIds, setFreshIds] = useState(new Set())
  const knownIds = useRef(null)

  useEffect(() => {
    if (!rows) return undefined
    const currentIds = new Set(rows.map((row) => row[idKey]))

    if (knownIds.current === null) {
      knownIds.current = currentIds
      return undefined
    }

    const newlyArrived = rows.filter((row) => !knownIds.current.has(row[idKey])).map((row) => row[idKey])
    knownIds.current = currentIds

    if (newlyArrived.length > 0) {
      setFreshIds((prev) => new Set([...prev, ...newlyArrived]))
      const timer = setTimeout(() => {
        setFreshIds((prev) => {
          const next = new Set(prev)
          newlyArrived.forEach((id) => next.delete(id))
          return next
        })
      }, ttlMs)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [rows, idKey, ttlMs])

  return freshIds
}
