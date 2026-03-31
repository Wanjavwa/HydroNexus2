/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useRef, useState } from 'react'

export const SensorDataContext = createContext(null)

const DEFAULT_API_BASE = 'http://localhost:3001'

function withTimeout(ms, signal) {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t)
          reject(new Error('Request aborted'))
        },
        { once: true },
      )
    }
  })
}

function apiBase() {
  // Allow override via env, but keep a safe default for local dev.
  return import.meta.env.VITE_API_BASE || DEFAULT_API_BASE
}

export function SensorDataProvider({ children }) {
  const [latest, setLatest] = useState(null)
  const [history, setHistory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [recommendations, setRecommendations] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connectionLost, setConnectionLost] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const inFlightRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer = null

    async function pollOnce() {
      if (cancelled || inFlightRef.current) return
      inFlightRef.current = true

      const controller = new AbortController()
      const timeoutMs = 1800

      try {
        const base = apiBase()

        const fetchJson = async (path) => {
          const p = fetch(`${base}${path}`, { signal: controller.signal })
          const r = await Promise.race([p, withTimeout(timeoutMs, controller.signal)])
          if (!r || !('ok' in r)) throw new Error('Invalid fetch response')
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`)
          return r.json()
        }

        const [sensors, hist, al, rec] = await Promise.all([
          fetchJson('/api/sensors'),
          fetchJson('/api/history'),
          fetchJson('/api/alerts'),
          fetchJson('/api/recommendations'),
        ])

        if (cancelled) return

        setLatest(sensors)
        setHistory(Array.isArray(hist) ? hist : [])
        setAlerts(Array.isArray(al) ? al : [])
        setRecommendations(Array.isArray(rec) ? rec : [])

        const ts = sensors?.timestamp
        setLastUpdatedAt(typeof ts === 'number' ? ts : null)

        setError(null)
        setConnectionLost(false)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setConnectionLost(true)
        setError(e?.message || 'Connection failed')
        // Keep existing data (no flicker) once we have something.
        setLoading((prev) => prev && !latest)
      } finally {
        inFlightRef.current = false
        controller.abort()
      }
    }

    pollOnce()
    timer = setInterval(pollOnce, 1000)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      latest,
      history,
      alerts,
      recommendations,
      loading,
      error,
      connectionLost,
      lastUpdatedAt,
    }),
    [latest, history, alerts, recommendations, loading, error, connectionLost, lastUpdatedAt],
  )

  return <SensorDataContext.Provider value={value}>{children}</SensorDataContext.Provider>
}

