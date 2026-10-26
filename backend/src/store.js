const MAX_HISTORY = 60

let latestReading = null
let serialConnected = false
let serialError = null
let dataSource = 'arduino'
const history = []

function numericField(reading, aliases) {
  for (const key of aliases) {
    if (!Object.prototype.hasOwnProperty.call(reading, key) || reading[key] === null) continue
    if (typeof reading[key] === 'string' && !reading[key].trim()) continue
    const value = Number(reading[key])
    if (Number.isFinite(value)) return value
  }
  return null
}

function normalizeReading(reading) {
  if (!reading || typeof reading !== 'object' || Array.isArray(reading)) return null

  const normalized = {
    flow: numericField(reading, ['flow', 'flow1', 'flowA']),
    total: numericField(reading, ['total', 'total1', 'totalA']),
    pH: numericField(reading, ['pH', 'ph']),
    pressure: numericField(reading, ['pressure', 'pressurePsi', 'pressureKpa', 'pressure_psi', 'pressure_kpa']),
  }

  if (normalized.flow === null && normalized.pH === null && normalized.pressure === null) return null

  const providedTimestamp = reading.timestamp
  const parsedTimestamp = typeof providedTimestamp === 'number'
    ? providedTimestamp
    : typeof providedTimestamp === 'string'
      ? Date.parse(providedTimestamp)
      : NaN
  const now = Date.now()
  normalized.timestamp = Number.isFinite(parsedTimestamp) && parsedTimestamp > 0 && parsedTimestamp <= now + 60000
    ? parsedTimestamp
    : now

  if (typeof reading.assetId === 'string' && reading.assetId.trim()) normalized.assetId = reading.assetId.trim()
  if (typeof reading.sensorId === 'string' && reading.sensorId.trim()) normalized.sensorId = reading.sensorId.trim()
  if (reading.sensorIds && typeof reading.sensorIds === 'object' && !Array.isArray(reading.sensorIds)) {
    normalized.sensorIds = Object.fromEntries(
      Object.entries(reading.sensorIds).filter(([, value]) => typeof value === 'string' && value.trim()),
    )
  }

  const pressureUnit = reading.pressureUnit
    ?? (reading.pressurePsi !== undefined || reading.pressure_psi !== undefined ? 'psi' : undefined)
    ?? (reading.pressureKpa !== undefined || reading.pressure_kpa !== undefined ? 'kPa' : undefined)
  if (typeof pressureUnit === 'string' && pressureUnit.trim()) normalized.pressureUnit = pressureUnit.trim()

  return normalized
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
  return history.map((reading) => ({ ...reading }))
}

function setSerialStatus({ connected, error = null }) {
  serialConnected = Boolean(connected)
  serialError = error ? String(error) : null
}

function setDataSource(source) {
  if (source !== 'arduino' && source !== 'demo') throw new Error(`Unsupported data source: ${source}`)
  dataSource = source
  if (source === 'demo') {
    serialConnected = true
    serialError = null
  }
}

function getStatus(staleAfterMs = 10000) {
  const lastReadingAt = latestReading?.timestamp ?? null
  const ageMs = lastReadingAt === null ? null : Math.max(0, Date.now() - lastReadingAt)
  return {
    source: dataSource,
    demoMode: dataSource === 'demo',
    connected: dataSource === 'demo' || serialConnected,
    stale: ageMs === null || ageMs > staleAfterMs,
    lastReadingAt,
    ageMs,
    staleAfterMs,
    error: serialError,
  }
}

function computeActiveAlerts() {
  if (!latestReading) return []

  const alerts = []
  const ts = latestReading.timestamp
  const pH = latestReading.pH

  if (pH !== null && pH < 6) alerts.push({ message: 'Extreme Low pH', severity: 'critical', timestamp: ts })
  if (pH !== null && pH > 8) alerts.push({ message: 'Extreme High pH', severity: 'critical', timestamp: ts })

  const previousWith = (field) => {
    for (let index = history.length - 2; index >= 0; index--) {
      if (Number.isFinite(history[index][field])) return history[index]
    }
    return null
  }
  const previousFlow = previousWith('flow')
  const previousPressure = previousWith('pressure')
  if (previousFlow && previousFlow.flow > 0 && latestReading.flow !== null) {
    const flow = latestReading.flow
    const changeRatio = Math.abs(flow - previousFlow.flow) / previousFlow.flow

    if (flow < previousFlow.flow * 0.5) {
      alerts.push({ message: 'Sudden Flow Drop (Possible Leak)', severity: 'critical', timestamp: ts })
    } else if (changeRatio > 0.2) {
      alerts.push({ message: 'Unusual Flow Fluctuation', severity: 'warning', timestamp: ts })
    }
  }

  if (previousPressure && previousPressure.pressure !== 0 && latestReading.pressure !== null) {
    const changeRatio = Math.abs(latestReading.pressure - previousPressure.pressure) / Math.abs(previousPressure.pressure)
    if (changeRatio > 0.25) {
      alerts.push({ message: 'Unusual Pressure Fluctuation', severity: 'warning', timestamp: ts })
    }
  }

  return alerts
}

function computeRecommendations() {
  if (!latestReading) return []

  const recommendations = []
  const pH = latestReading.pH
  const alerts = computeActiveAlerts()
  const hasCriticalFlow = alerts.some((alert) => alert.message.includes('Sudden Flow Drop'))
  const hasFlowWarning = alerts.some((alert) => alert.message.includes('Flow Fluctuation'))
  const hasPressureWarning = alerts.some((alert) => alert.message.includes('Pressure Fluctuation'))

  if (pH !== null && (pH < 6 || pH > 8)) {
    recommendations.push({
      issue: 'pH out of safe range',
      reason: `pH=${pH.toFixed(2)} detected outside 6–8. This can accelerate corrosion/scaling.`,
      priority: 'high',
      actions: ['Adjust chemical dosing', 'Inspect pH probe calibration', 'Verify water treatment settings'],
    })
  }

  if (hasCriticalFlow) {
    recommendations.push({
      issue: 'Sudden flow drop detected',
      reason: `Flow=${latestReading.flow.toFixed(2)} mL/s dropped sharply compared to the previous valid reading.`,
      priority: 'high',
      actions: ['Inspect flow meter output', 'Perform a leak investigation'],
    })
  } else if (hasFlowWarning) {
    recommendations.push({
      issue: 'Flow instability warning',
      reason: 'A change in valid flow measurements was detected; verify the meter and inspect the affected line.',
      priority: 'medium',
      actions: ['Inspect pumps and filters', 'Check for developing blockage', 'Monitor subsequent readings'],
    })
  }

  if (hasPressureWarning) {
    recommendations.push({
      issue: 'Pressure fluctuation detected',
      reason: 'Consecutive pressure readings changed by more than 25%; verify the pressure sensor and system conditions.',
      priority: 'medium',
      actions: ['Verify pressure sensor output', 'Inspect the associated line and controls'],
    })
  }

  return recommendations
}

module.exports = {
  pushReading,
  getLatest,
  getHistory,
  getStatus,
  setSerialStatus,
  setDataSource,
  computeActiveAlerts,
  computeRecommendations,
}
