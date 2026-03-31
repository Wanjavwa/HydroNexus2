import { useEffect, useMemo, useRef, useState } from 'react'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function round(n, d = 2) {
  const p = 10 ** d
  return Math.round(n * p) / p
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function pickPressureStatus(pressure, prevPressure) {
  const delta = Math.abs(pressure - prevPressure)
  if (pressure > 78 || delta > 7) return { label: 'Critical', severity: 'danger' }
  if (pressure > 68 || delta > 4) return { label: 'Fluctuating', severity: 'warning' }
  return { label: 'Stable', severity: 'normal' }
}

function computeAlerts(next, prev) {
  const alerts = []

  if (next.pH < 5) alerts.push({ type: 'danger', message: 'Low pH Alert' })
  if (next.pH > 10) alerts.push({ type: 'danger', message: 'High pH Alert' })

  const prevAvgFlow = (prev.flowA + prev.flowB) / 2
  const nextAvgFlow = (next.flowA + next.flowB) / 2
  const dropPct = prevAvgFlow > 0 ? (prevAvgFlow - nextAvgFlow) / prevAvgFlow : 0
  if (dropPct > 0.25) alerts.push({ type: 'danger', message: 'Possible Leak' })

  if (next.pressureStatus.severity === 'warning') alerts.push({ type: 'warning', message: 'Pressure Instability' })
  if (next.pressureStatus.severity === 'danger') alerts.push({ type: 'danger', message: 'Pressure Instability' })

  // Structural warnings
  if (next.thickness < 4.2) alerts.push({ type: 'warning', message: 'Wear Detected (Ultrasonic)' })
  if (next.acoustic > 78) alerts.push({ type: 'warning', message: 'Vibration Spike (Acoustic)' })

  return alerts
}

function nextReading(prev, t) {
  // Base realistic ranges (demo):
  // flowA/flowB (mL/s): 30-55
  // pH: 6.2-8.2 normally, with occasional spikes
  // pressure (psi): 55-75, occasional instability
  // thickness (mm): slow drift down
  // acoustic (0-100): baseline low-mid with occasional spikes

  const spike = (Math.random() < 0.06) // occasional anomaly
  const phSpike = Math.random() < 0.04
  const leakDrop = Math.random() < 0.03
  const pressureJitter = Math.random() < 0.08

  let flowA = prev.flowA + (Math.random() - 0.5) * 2.2
  let flowB = prev.flowB + (Math.random() - 0.5) * 2.0
  if (spike) {
    flowA += (Math.random() - 0.5) * 10
    flowB += (Math.random() - 0.5) * 10
  }
  if (leakDrop) {
    const which = Math.random() < 0.5 ? 'A' : 'B'
    if (which === 'A') flowA *= 0.55
    else flowB *= 0.55
  }

  flowA = clamp(flowA, 10, 65)
  flowB = clamp(flowB, 10, 65)

  let pH = prev.pH + (Math.random() - 0.5) * 0.08 + Math.sin(t / 12) * 0.015
  if (phSpike) pH = Math.random() < 0.5 ? 4.6 + Math.random() * 0.3 : 10.6 + Math.random() * 0.4
  pH = clamp(pH, 4.3, 11.2)

  let pressure = prev.pressure + (Math.random() - 0.5) * 1.8
  if (pressureJitter) pressure += (Math.random() - 0.5) * 14
  pressure = clamp(pressure, 45, 85)

  let thickness = prev.thickness - 0.002 + (Math.random() - 0.5) * 0.01
  thickness = clamp(thickness, 3.7, 5.2)

  let acoustic = prev.acoustic + (Math.random() - 0.5) * 6
  if (Math.random() < 0.05) acoustic += 35
  acoustic = clamp(acoustic, 0, 100)

  const pressureStatus = pickPressureStatus(pressure, prev.pressure)

  return {
    time: nowLabel(),
    flowA: round(flowA, 2),
    flowB: round(flowB, 2),
    pH: round(pH, 2),
    pressure: round(pressure, 1),
    pressureStatus,
    thickness: round(thickness, 2),
    acoustic: round(acoustic, 0),
  }
}

export function useSimulatedWaterMonitoring({ intervalMs = 1000, maxPoints = 60 } = {}) {
  const tickRef = useRef(0)
  const [history, setHistory] = useState(() => {
    const seed = {
      time: nowLabel(),
      flowA: 41.67,
      flowB: 38.2,
      pH: 7.12,
      pressure: 64.5,
      pressureStatus: { label: 'Stable', severity: 'normal' },
      thickness: 4.86,
      acoustic: 22,
    }
    return [seed]
  })
  const [activeAlerts, setActiveAlerts] = useState([])

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1
      setHistory((prev) => {
        const last = prev[prev.length - 1]
        const next = nextReading(last, tickRef.current)
        const nextAlerts = computeAlerts(next, last)
        setActiveAlerts(nextAlerts)

        const merged = [...prev, next]
        if (merged.length > maxPoints) merged.splice(0, merged.length - maxPoints)
        return merged
      })
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs, maxPoints])

  const latest = history[history.length - 1]
  const prev = history.length > 1 ? history[history.length - 2] : latest

  const trends = useMemo(() => {
    const delta = (k) => latest[k] - prev[k]
    return {
      flowA: delta('flowA'),
      flowB: delta('flowB'),
      pH: delta('pH'),
      pressure: delta('pressure'),
      thickness: delta('thickness'),
      acoustic: delta('acoustic'),
    }
  }, [latest, prev])

  const averages = useMemo(() => {
    const avg = (key) => history.reduce((acc, r) => acc + r[key], 0) / Math.max(1, history.length)
    // flows are mL/s -> per hour shown as mL/h
    const avgFlowA = avg('flowA') * 3600
    const avgFlowB = avg('flowB') * 3600
    const avgPH = avg('pH')
    return {
      avgFlowA: round(avgFlowA, 0),
      avgFlowB: round(avgFlowB, 0),
      avgPH: round(avgPH, 2),
    }
  }, [history])

  const last10 = useMemo(() => history.slice(-10).reverse(), [history])

  return {
    latest,
    history,
    last10,
    averages,
    activeAlerts,
    trends,
  }
}

