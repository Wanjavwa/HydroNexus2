const MAX_HISTORY = 60

let latestReading = null
const history = []

function normalizeReading(reading) {
  if (!reading || typeof reading !== 'object') return null

  // Accept multiple key aliases to make backend resilient to Arduino format changes.
  // Primary schema (current):
  //   { flow, total, pH, timestamp }
  // Legacy aliases we may still see during migration:
  //   { flow1, total1, pH } or { flowA, totalA, pH } or { flow1, total1, ph }.
  const flow = Number(reading.flow ?? reading.flow1 ?? reading.flowA)
  const total = Number(reading.total ?? reading.total1 ?? reading.totalA)
  const pH = Number(reading.pH ?? reading.ph)

  const isNum = (v) => Number.isFinite(v)

  const ok = isNum(flow) && isNum(total) && isNum(pH)

  if (!ok) return null

  const ts =
    typeof reading.timestamp === 'number' && Number.isFinite(reading.timestamp) ? reading.timestamp : Date.now()

  return { flow, total, pH, timestamp: ts }
}

function pushReading(reading) {
  const normalized = normalizeReading(reading)
  if (!normalized) return false

  latestReading = normalized
  history.push(normalized)
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY)

  return true
}

function getLatest() {
  return latestReading
}

function getHistory() {
  return history.map((r) => ({ flow: r.flow, pH: r.pH, timestamp: r.timestamp }))
}

function computeActiveAlerts() {
  if (!latestReading) return []

  const alerts = []
  const ts = latestReading.timestamp
  const pH = latestReading.pH

  // Extreme pH-based alerts
  if (pH < 6) alerts.push({ message: 'Extreme Low pH', severity: 'critical', timestamp: ts })
  if (pH > 8) alerts.push({ message: 'Extreme High pH', severity: 'critical', timestamp: ts })

  // Baseline tracking: sudden drop vs previous reading
  const prev = history.length > 1 ? history[history.length - 2] : null
  if (prev && Number.isFinite(prev.flow) && prev.flow > 0) {
    const prevFlow = prev.flow
    const flow = latestReading.flow
    const dropRatio = flow / prevFlow // < 1 means drop
    const absDeltaRatio = Math.abs(flow - prevFlow) / prevFlow

    // Sudden drop (>= 50% drop)
    if (flow < prevFlow * 0.5) {
      alerts.push({ message: 'Sudden Flow Drop (Possible Leak)', severity: 'critical', timestamp: ts })
    } else if (absDeltaRatio > 0.2) {
      // Unusual fluctuation
      alerts.push({ message: 'Unusual Flow Fluctuation', severity: 'warning', timestamp: ts })
    }
  }

  return alerts
}

function computeRecommendations() {
  if (!latestReading) return []

  const recs = []

  const pH = latestReading.pH
  const alerts = computeActiveAlerts()
  const hasCriticalFlow = alerts.some((a) => a.message.includes('Sudden Flow Drop'))
  const hasCriticalPH = alerts.some((a) => a.message.includes('Extreme'))

  if (pH < 6 || pH > 8 || hasCriticalPH) {
    recs.push({
      issue: 'pH out of safe range',
      reason: `pH=${pH.toFixed(2)} detected outside 6–8. This can accelerate corrosion/scaling.`,
      priority: 'high',
      actions: ['Adjust chemical dosing', 'Inspect pH probe calibration', 'Verify water treatment settings'],
    })
  }

  if (hasCriticalFlow) {
    recs.push({
      issue: 'Sudden flow drop detected',
      reason: `Flow=${latestReading.flow.toFixed(2)} mL/s dropped sharply compared to the previous baseline reading.`,
      priority: 'high',
      actions: ['Close Valve', 'Inspect flow meter output', 'Perform leak investigation on affected section'],
    })
  } else if (alerts.some((a) => a.severity === 'warning')) {
    recs.push({
      issue: 'Flow instability warning',
      reason: 'Unusual flow fluctuation suggests developing blockage or transient pump/valve behavior.',
      priority: 'medium',
      actions: ['Inspect pumps/filters', 'Check for developing blockage', 'Monitor trend for escalation'],
    })
  }

  if (recs.length === 0) {
    recs.push({
      issue: 'System operating normally',
      reason: 'pH is within safe band and flow is stable vs baseline.',
      priority: 'low',
      actions: ['Continue monitoring', 'Run routine inspections on schedule'],
    })
  }

  return recs
}

module.exports = {
  pushReading,
  getLatest,
  getHistory,
  computeActiveAlerts,
  computeRecommendations,
}

