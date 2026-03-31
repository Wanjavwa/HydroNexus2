function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export function computePipeHealthScore({ flow, pH }) {
  const f = Number(flow)
  const ph = Number(pH)

  if (![f, ph].every((x) => Number.isFinite(x))) {
    return {
      score: 0,
      flowPenalty: 0,
      phPenalty: 0,
      flow: f,
      pH: ph,
    }
  }

  // In single-sensor mode we can't do imbalance detection. Use deviation from a nominal flow.
  const nominalFlow = 40
  const flowDeviationRatio = nominalFlow > 0 ? Math.abs(f - nominalFlow) / nominalFlow : 0
  const flowPenalty = clamp(Math.round(flowDeviationRatio * 40), 0, 45)

  // pH deviation from neutral (7).
  const pHDeviation = Math.abs(ph - 7)
  const phPenalty = clamp(Math.round(pHDeviation * 12), 0, 60)

  const score = clamp(100 - flowPenalty - phPenalty, 0, 100)
  return { score, flowPenalty, phPenalty, pHDeviation, flowDeviationRatio }
}

export function getRiskFromScore(score) {
  if (score >= 80) return { label: 'Healthy', severity: 'normal' }
  if (score >= 60) return { label: 'Moderate Risk', severity: 'warning' }
  return { label: 'High Risk', severity: 'danger' }
}

export function estimateDaysToFailure(healthPoints) {
  if (!Array.isArray(healthPoints) || healthPoints.length < 2) return null

  const first = healthPoints[0]
  const last = healthPoints[healthPoints.length - 1]
  if (!first || !last) return null

  const dtSeconds = (last.timestamp - first.timestamp) / 1000
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return null

  const deltaHealth = first.health - last.health // positive if degrading
  if (deltaHealth <= 0) return null

  const lossPerDay = (deltaHealth / dtSeconds) * 86400
  if (lossPerDay <= 0) return null

  const days = last.health / lossPerDay
  if (!Number.isFinite(days)) return null

  // Keep UI readable.
  return clamp(Math.round(days), 1, 365)
}

export function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

