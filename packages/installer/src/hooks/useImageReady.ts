import { useState, useEffect } from 'react'

export function useImageReady(idx: number) {
  const [ready, setReady] = useState(true)
  useEffect(() => {
    setReady(false)
    const t = setTimeout(() => setReady(true), 60)
    return () => clearTimeout(t)
  }, [idx])
  return { ready }
}
