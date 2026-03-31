import { useMemo } from 'react'
import {
  Activity,
  Gauge,
  Radar,
  Ruler,
  Siren,
  ThermometerSnowflake,
  TriangleAlert,
  Volume2,
  Waves,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSensorData } from '../hooks/useSensorData.js'
import { estimateDaysToFailure, formatTime } from '../utils/pipeHealth.js'

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const round = (n, d = 2) => {
  const p = 10 ** d
  return Math.round(n * p) / p
}

function formatPercent(n) {
  const abs = Math.abs(n).toFixed(0)
  return n < 0 ? `-${abs}%` : `+${abs}%`
}

function severityTone(sev) {
  if (sev === 'danger') return { badge: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' }
  if (sev === 'warning') return { badge: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' }
  return { badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' }
}

function computeImpacts({ flowStabilityPct, pressureVarPct, pHDeviation, thickness, acoustic }) {
  // Impacts are negative percentages (damage contribution).
  const flowImpact = -clamp(Math.round(flowStabilityPct * 0.7), 2, 18)
  const pressureImpact = -clamp(Math.round(pressureVarPct * 0.6), 2, 14)
  const phImpact = -clamp(Math.round(pHDeviation * 1.0), 1, 15)

  // Ultrasonic wall thinning -> buildup risk
  const buildupImpact = -clamp(Math.round((4.9 - thickness) * 55), 1, 12)

  // Acoustic anomalies -> structural risk
  const structuralImpact = -clamp(Math.round((acoustic - 55) * 0.25), 1, 10)

  const total = Math.abs(flowImpact) + Math.abs(pressureImpact) + Math.abs(phImpact) + Math.abs(buildupImpact) + Math.abs(structuralImpact)
  const normalizeTo = 37
  const scale = total > 0 ? normalizeTo / total : 1

  const impacts = {
    flow: round(flowImpact * scale, 0),
    pressure: round(pressureImpact * scale, 0),
    waterQuality: round(phImpact * scale, 0),
    buildup: round(buildupImpact * scale, 0),
    structural: round(structuralImpact * scale, 0),
  }

  return impacts
}

function buildAlertEvents({ pH, flowDelta, pressureStatus, suddenDrop, idx }) {
  const events = []
  if (pH < 6) events.push({ idx, type: 'pH_low', color: '#f97316', label: 'Low pH Alert' })
  if (pH > 8) events.push({ idx, type: 'pH_high', color: '#ef4444', label: 'High pH Alert' })
  if (flowDelta < -0.5) events.push({ idx, type: 'leak', color: '#dc2626', label: 'Possible Leak' })
  if (pressureStatus.severity !== 'normal') events.push({ idx, type: 'pressure', color: '#f59e0b', label: 'Pressure Instability' })
  if (suddenDrop) events.push({ idx, type: 'drop', color: '#ef4444', label: 'Sudden Flow Drop' })

  // Deduplicate by idx+type (simple)
  return events.filter((e, i) => events.findIndex((x) => x.idx === e.idx && x.type === e.type) === i)
}

function usePredictiveSimulation({ intervalMs = 1000 } = {}) {
  const { latest: sensorsLatest, history: backendHistory } = useSensorData()

  const thickness = 4.85 // placeholder (backend currently only streams flow + pH)
  const acoustic = 22 // placeholder (backend currently only streams flow + pH)

  const healthSeries = useMemo(() => {
    const nominalFlow = 40
    const windowSize = 10

    return (backendHistory || []).map((r, i) => {
      const sliceStart = Math.max(0, i - windowSize + 1)
      const win = (backendHistory || []).slice(sliceStart, i + 1).map((x) => Number(x.flow)).filter((v) => Number.isFinite(v))

      const mean = win.length ? win.reduce((a, b) => a + b, 0) / win.length : Number(r.flow)
      const variance = win.length ? win.reduce((acc, v) => acc + (v - mean) ** 2, 0) / win.length : 0
      const stddev = Math.sqrt(variance)

      const stabilityPenalty = nominalFlow > 0 ? (stddev / nominalFlow) * 50 : 0
      const pHDeviation = Math.abs(Number(r.pH) - 7)
      const pHPenalty = pHDeviation * 12

      const health = clamp(100 - stabilityPenalty - pHPenalty, 0, 100)

      return { timestamp: r.timestamp, time: formatTime(r.timestamp), health, pH: r.pH, flow: r.flow }
    })
  }, [backendHistory])

  const latest = useMemo(() => {
    if (!sensorsLatest) return null
    const nominalFlow = 40
    const windowSize = 10
    const win = (backendHistory || []).slice(Math.max(0, (backendHistory || []).length - windowSize)).map((x) => Number(x.flow)).filter((v) => Number.isFinite(v))
    const mean = win.length ? win.reduce((a, b) => a + b, 0) / win.length : Number(sensorsLatest.flow)
    const variance = win.length ? win.reduce((acc, v) => acc + (v - mean) ** 2, 0) / win.length : 0
    const stddev = Math.sqrt(variance)

    const flowStabilityPct = nominalFlow > 0 ? clamp((stddev / nominalFlow) * 100, 0, 100) : 0
    // Backend only streams flow + pH, so keep "pressure" neutral for predictions/alerts.
    const pressureStatus = { label: 'Stable', severity: 'normal' }

    const lastHealth = healthSeries?.[healthSeries.length - 1]?.health ?? 0

    return {
      health: lastHealth,
      pH: sensorsLatest.pH,
      flow: sensorsLatest.flow,
      pressure: 0,
      thickness,
      acoustic,
      pressureStatus,
      _flowStabilityPct: flowStabilityPct,
      _pHDeviation: Math.abs(Number(sensorsLatest.pH) - 7),
    }
  }, [sensorsLatest, backendHistory, healthSeries])

  const pressureStatus = useMemo(() => latest?.pressureStatus || { label: 'Stable', severity: 'normal' }, [latest])

  const impacts = useMemo(() => {
    if (!latest) return { flow: -12, pressure: 0, waterQuality: -7, buildup: 0, structural: 0 }

    // Map backend signals into the existing ImpactBreakdown model.
    const flowStabilityPct = latest._flowStabilityPct ?? 0
    const pressureVarPct = 0
    const pHDeviation = latest._pHDeviation ?? Math.abs(latest.pH - 7)

    return computeImpacts({
      flowStabilityPct,
      pressureVarPct,
      pHDeviation,
      thickness: latest.thickness,
      acoustic: latest.acoustic,
    })
  }, [latest])

  const riskLevel = latest?.health >= 80 ? 'LOW' : latest?.health >= 60 ? 'MODERATE' : 'HIGH'
  const riskSeverity = riskLevel === 'LOW' ? 'normal' : riskLevel === 'MODERATE' ? 'warning' : 'danger'

  const predictedFailureType = useMemo(() => {
    if (!latest) return '—'
    const pH = Number(latest.pH)
    const flowStabilityPct = latest._flowStabilityPct ?? 0

    if (pH < 6 || pH > 8) return 'Corrosion leak'
    if (flowStabilityPct > 35) return 'Blockage'
    if (flowStabilityPct > 20) return 'Flow instability'
    return 'Minor degradation'
  }, [latest])

  const confidence = useMemo(() => {
    if (!latest) return 0
    const absImp = Math.abs(impacts.flow) + Math.abs(impacts.waterQuality)
    return clamp(Math.round(55 + (absImp / 33) * 40 + (pressureStatus.severity !== 'normal' ? 5 : 0)), 50, 96)
  }, [latest, impacts, pressureStatus.severity])

  const estimatedDaysToFailure = useMemo(() => {
    const days = estimateDaysToFailure(healthSeries)
    return days ?? 14
  }, [healthSeries])

  const rulDaysStart = 14
  const rulDays = clamp(Math.round((rulDaysStart * (latest?.health ?? 80)) / 100), 0, rulDaysStart)
  const rulProgress = rulDaysStart > 0 ? clamp(((rulDaysStart - rulDays) / rulDaysStart) * 100, 0, 100) : 0

  const timeline = useMemo(() => {
    const pHsev = latest?.pH < 6 ? 'danger' : latest?.pH > 8 ? 'danger' : latest?.pH < 6.3 || latest?.pH > 7.7 ? 'warning' : 'normal'
    const flowSev = (latest?._flowStabilityPct ?? 0) > 35 ? 'danger' : (latest?._flowStabilityPct ?? 0) > 15 ? 'warning' : 'normal'

    return [
      { time: '06:00', label: 'Stable', severity: 'normal' },
      { time: '10:00', label: flowSev === 'normal' ? 'Flow steady' : 'Flow variability detected', severity: flowSev === 'normal' ? 'normal' : flowSev },
      { time: '13:00', label: pHsev === 'normal' ? 'pH stable' : 'pH shift', severity: pHsev === 'normal' ? 'normal' : pHsev },
      { time: '15:00', label: 'Degradation accelerates', severity: latest?.health !== undefined && latest.health < 60 ? 'danger' : latest?.health < 80 ? 'warning' : 'normal' },
    ]
  }, [latest])

  const chartData = useMemo(() => {
    const actual = healthSeries.map((p) => ({ time: p.time, healthActual: p.health, healthProjected: null }))

    const recent = healthSeries.slice(-4)
    const slope =
      recent.length >= 2 ? (recent[recent.length - 1].health - recent[0].health) / Math.max(1, recent.length - 1) : -0.8

    const anchorTs = healthSeries[healthSeries.length - 1]?.timestamp ?? sensorsLatest?.timestamp ?? 0
    const anchorHealth = latest?.health ?? healthSeries[healthSeries.length - 1]?.health ?? 80

    const projected = Array.from({ length: 6 }).map((_, i) => {
      const futureTs = anchorTs + (i + 1) * intervalMs
      const time = formatTime(futureTs)
      const futureHealth = clamp(anchorHealth + slope * (i + 1) * 0.9, 0, 100)
      return { time, healthActual: null, healthProjected: futureHealth }
    })

    return [...actual, ...projected]
  }, [healthSeries, latest?.health, intervalMs, sensorsLatest?.timestamp])

  const alertPoints = useMemo(() => {
    if (!latest) return []
    const prev = healthSeries.length >= 2 ? healthSeries[healthSeries.length - 2] : null
    const prevFlow = prev?.flow
    const nowFlow = latest.flow
    const flowDelta = prevFlow && prevFlow > 0 ? (nowFlow - prevFlow) / prevFlow : 0
    // Sudden degradation step is now derived from flow baseline tracking.
    const suddenDrop = prevFlow && nowFlow < prevFlow * 0.5
    const idx = healthSeries.length - 1

    const events = buildAlertEvents({ pH: latest.pH, flowDelta, pressureStatus, suddenDrop, idx })
    return events.map((e) => ({
      time: formatTime(healthSeries[healthSeries.length - 1]?.timestamp ?? sensorsLatest?.timestamp ?? 0),
      health: latest.health,
      color: e.color,
      type: e.type,
      label: e.label,
    }))
  }, [latest, healthSeries, pressureStatus, sensorsLatest?.timestamp])

  const dropPoints = useMemo(() => {
    const pts = []
    for (let i = 1; i < healthSeries.length; i++) {
      const prev = healthSeries[i - 1]
      const cur = healthSeries[i]
      if (prev.health - cur.health > 1.8) pts.push({ time: cur.time, health: cur.health })
    }
    return pts
  }, [healthSeries])

  return {
    latest: latest || { health: 0, pH: 7, flow: 0, pressure: 0, thickness, acoustic, pressureStatus, _flowStabilityPct: 0, _pHDeviation: Math.abs(7 - 7) },
    impacts,
    pressureStatus,
    riskLevel,
    riskSeverity,
    predictedFailureType,
    confidence,
    estimatedDaysToFailure,
    chartData,
    alertPoints,
    dropPoints,
    rulDays,
    rulProgress,
    timeline,
    predictedDegradationRateText: 'Degrading based on flow + pH',
  }
}

function RiskGauge({ level, severity }) {
  const tone = severityTone(severity)
  const pct = level === 'LOW' ? 25 : level === 'MODERATE' ? 55 : 82
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Risk Level</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{level}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          {severity === 'danger' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Normal'}
        </span>
      </div>
      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              severity === 'danger' ? 'bg-rose-500' : severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-600">Risk score: {pct}/100</p>
      </div>
    </div>
  )
}

function ImpactBreakdown({ impacts }) {
  const items = [
    { key: 'flow', label: 'Flow Stability Impact', value: impacts.flow, tone: impacts.flow < -10 ? 'danger' : impacts.flow < -7 ? 'warning' : 'normal', icon: <Waves size={16} /> },
    { key: 'pressure', label: 'Pressure Variability Impact', value: impacts.pressure, tone: impacts.pressure < -9 ? 'danger' : impacts.pressure < -6 ? 'warning' : 'normal', icon: <Gauge size={16} /> },
    { key: 'waterQuality', label: 'pH / Water Quality Impact', value: impacts.waterQuality, tone: impacts.waterQuality < -9 ? 'danger' : impacts.waterQuality < -6 ? 'warning' : 'normal', icon: <ThermometerSnowflake size={16} /> },
    { key: 'buildup', label: 'Buildup Risk (Ultrasonic)', value: impacts.buildup, tone: impacts.buildup < -6 ? 'danger' : impacts.buildup < -4 ? 'warning' : 'normal', icon: <Ruler size={16} /> },
    { key: 'structural', label: 'Structural Risk (Acoustic)', value: impacts.structural, tone: impacts.structural < -5 ? 'danger' : impacts.structural < -3 ? 'warning' : 'normal', icon: <Volume2 size={16} /> },
  ]

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Pipe Health Breakdown</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">Contributing impacts</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
          <Activity size={14} />
          Model view
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it) => {
          const tone = severityTone(it.tone)
          const magnitude = Math.abs(it.value)
          const width = clamp((magnitude / 18) * 100, 10, 100)
          return (
            <div key={it.key} className="rounded-xl border border-slate-200/70 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center rounded-lg border px-2 py-1 ${tone.badge}`}>
                    {it.icon}
                  </span>
                  <p className="text-sm font-semibold text-slate-800">{it.label}</p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${tone.badge}`}>
                  <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  {formatPercent(it.value)}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    it.tone === 'danger' ? 'bg-rose-500' : it.tone === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FailurePredictionCard({ failureType, confidence, days }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Failure Prediction</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">Predicted Failure Type</h3>
          <p className="mt-2 text-3xl font-black text-indigo-700">{failureType}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Siren size={14} />
            Confidence {confidence}%
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-600">Estimated Time to Failure</p>
          <p className="text-2xl font-black text-slate-900">{days} days</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-700">What this means</p>
        <p className="mt-1 text-sm text-slate-600">
          Forecast combines pH drift, flow stability, pressure variability, and structural signals to estimate an actionable window.
        </p>
      </div>
    </div>
  )
}

function RulCard({ rulDays, progressPct }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Remaining Useful Life (RUL)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">Estimated Remaining Life</p>
          <p className="mt-1 text-4xl font-black text-emerald-700">{rulDays} days</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <Gauge size={14} />
          Time decay
        </span>
      </div>
      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-600">{progressPct.toFixed(0)}% of window elapsed</p>
      </div>
    </div>
  )
}

function DriversList({ latest, pressureStatus }) {
  const items = [
    {
      icon: <ThermometerSnowflake size={18} />,
      title: 'pH trend',
      severity: latest.pH < 6.6 ? 'danger' : latest.pH < 7.2 ? 'warning' : 'normal',
      explanation: 'Increasing acidity accelerating corrosion.',
      tip: 'pH below/above safe thresholds increases chemical wear and corrosion rate.',
    },
    {
      icon: <Waves size={18} />,
      title: 'Flow stability variance',
      severity: (latest._flowStabilityPct ?? 0) > 35 ? 'danger' : (latest._flowStabilityPct ?? 0) > 20 ? 'warning' : 'normal',
      explanation: 'Higher flow variability increases uncertainty and risk of partial restriction.',
      tip: 'Frequent fluctuations can indicate transient blockage, pump cycling, or valve behavior.',
    },
    {
      icon: <Gauge size={18} />,
      title: 'Pressure fluctuation',
      severity: pressureStatus.severity === 'danger' ? 'danger' : pressureStatus.severity === 'warning' ? 'warning' : 'normal',
      explanation: 'Suggests system instability.',
      tip: 'Large pressure variance increases mechanical stress and risk of burst.',
    },
    {
      icon: <Ruler size={18} />,
      title: 'Ultrasonic thickness',
      severity: latest.thickness < 4.2 ? 'danger' : latest.thickness < 4.55 ? 'warning' : 'normal',
      explanation: 'Wall thinning detected.',
      tip: 'Reduced thickness increases structural vulnerability under pressure loads.',
    },
    {
      icon: <Volume2 size={18} />,
      title: 'Acoustic signals',
      severity: latest.acoustic > 78 ? 'danger' : latest.acoustic > 60 ? 'warning' : 'normal',
      explanation: 'Minor vibration anomalies detected.',
      tip: 'Acoustic anomalies can indicate flow turbulence, leaks, or early damage.',
    },
  ]

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Key Degradation Drivers</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">What’s driving the risk</h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          <Radar size={14} />
          Drivers
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const tone = severityTone(it.severity)
          return (
            <div key={it.title} className="group relative rounded-2xl border border-slate-200 bg-white p-3 transition hover:shadow-[0_18px_45px_rgba(59,130,246,0.12)]">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${tone.badge}`}>
                  {it.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{it.title}</p>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${tone.badge}`}>
                      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      {it.severity === 'danger' ? 'Critical' : it.severity === 'warning' ? 'Warning' : 'Normal'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{it.explanation}</p>
                </div>
              </div>
              <div className="pointer-events-none absolute left-3 top-16 z-10 hidden w-[280px] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg group-hover:block">
                {it.tip}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InsightsPanel({ latest }) {
  const flowDropPct = useMemo(() => {
    const pct = 12 + (latest._flowStabilityPct ?? 0) * 0.25
    return clamp(pct, 12, 35)
  }, [latest._flowStabilityPct])

  const prevPH = clamp(latest.pH + 1.0, 6.6, 8.4)
  const phDropText = `${prevPH.toFixed(1)} → ${latest.pH.toFixed(1)}`

  const acousticTrend = latest.acoustic > 55 ? 'increased slightly' : 'stable'

  const conclusion =
    latest.pH < 6.6 && latest.thickness < 4.6
      ? 'Likely mineral buildup causing partial blockage and early-stage pipe stress.'
      : latest.pressureStatus?.severity === 'danger'
        ? 'Pressure instability suggests elevated mechanical stress and an increased burst likelihood.'
        : 'Chemical drift and flow variability indicate developing corrosion/partial restriction risk.'

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Insights & Reasoning</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">Why the system is degrading</h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          <TriangleAlert size={14} />
          Insight
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">Based on sensor data:</span>
        </p>
        <div className="mt-3 space-y-2 text-sm font-semibold text-slate-800">
          <div>• Flow variability index is {Math.round(flowDropPct)}%</div>
          <div>• pH has dropped from {phDropText}</div>
          <div>• Acoustic vibration has {acousticTrend}</div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">Conclusion:</p>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{conclusion}</p>
        </div>
      </div>
    </div>
  )
}

function MiniTimeline({ timeline }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <p className="text-sm font-semibold text-slate-500">Mini Timeline</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-900">Degradation progression</h3>

      <div className="mt-4 space-y-4">
        {timeline.map((t) => {
          const tone = severityTone(t.severity)
          return (
            <div key={t.time} className="flex items-start gap-3">
              <span className={`mt-1 h-3.5 w-3.5 rounded-full ${tone.dot} shadow`}></span>
              <div>
                <p className="text-sm font-bold text-slate-900">{t.time}</p>
                <p className="mt-0.5 text-sm text-slate-600">{t.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PredictPage() {
  const {
    latest,
    impacts,
    pressureStatus,
    riskLevel,
    riskSeverity,
    predictedFailureType,
    confidence,
    estimatedDaysToFailure,
    chartData,
    alertPoints,
    dropPoints,
    rulDays,
    rulProgress,
    timeline,
    predictedDegradationRateText,
  } = usePredictiveSimulation({ intervalMs: 1000 })

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Predict & Analyze</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Explain what’s happening, why it’s happening, and what will happen next—powered by simulated predictive maintenance signals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            <Activity size={14} />
            Live inference
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Siren size={14} />
            Streaming updates
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
            <p className="text-sm font-semibold text-slate-500">Pipe Health Score</p>
            <p className="mt-2 text-6xl font-black text-indigo-700">{latest ? `${Math.round(latest.health)}%` : '—'}</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {riskLevel === 'LOW' ? 'Healthy' : riskLevel === 'MODERATE' ? 'Moderate Risk' : 'High Risk'}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-700">Pressure status</p>
              <p className="mt-1 text-sm text-slate-600">{pressureStatus.label}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Enhanced Degradation Graph</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Past + Projected Health Trend</h2>
              </div>
              <div className="text-sm font-semibold text-slate-600">{predictedDegradationRateText}</div>
            </div>

            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, borderColor: '#e2e8f0' }}
                    formatter={(value) => [`${value}%`, 'health']}
                  />
                  <Line
                    type="monotone"
                    dataKey="healthActual"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={false}
                    name="Actual"
                  />
                  <Line
                    type="monotone"
                    dataKey="healthProjected"
                    stroke="#0ea5e9"
                    strokeWidth={3}
                    dot={false}
                    strokeDasharray="6 6"
                    name="Projected"
                  />
                  {alertPoints.map((p, i) => (
                    <Scatter
                      // One scatter per point for color control; small N so acceptable.
                      key={`${p.type}-${i}`}
                      data={[{ time: p.time, health: p.health }]}
                      fill={p.color}
                      dataKey="health"
                      shape="circle"
                    />
                  ))}
                  {dropPoints.map((p, i) => (
                    <Scatter
                      key={`drop-${i}`}
                      data={[{ time: p.time, health: p.health }]}
                      fill="#ef4444"
                      dataKey="health"
                      shape="triangle"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                Actual health
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Projected trend (dashed)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Sudden drops / alerts
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FailurePredictionCard failureType={predictedFailureType} confidence={confidence} days={estimatedDaysToFailure} />
        </div>
        <div className="lg:col-span-2">
          <ImpactBreakdown impacts={impacts} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DriversList latest={{ ...latest, pressureStatus }} pressureStatus={pressureStatus} />
        </div>
        <div className="lg:col-span-1">
          <RiskGauge level={riskLevel} severity={riskSeverity} />
          <div className="mt-5">
            <RulCard rulDays={rulDays} progressPct={rulProgress} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InsightsPanel latest={{ ...latest, pressureStatus }} />
        </div>
        <div className="lg:col-span-1">
          <MiniTimeline timeline={timeline} />
        </div>
      </div>
    </section>
  )
}

