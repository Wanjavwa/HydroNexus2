import { Droplets, Gauge, Activity, AlertTriangle, Ruler, Volume2 } from 'lucide-react'
import { useMemo } from 'react'
import { AlertsPanel } from '../components/AlertsPanel.jsx'
import { LiveLineChart } from '../components/LiveLineChart.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import PipelineMap from '../components/PipelineMap.jsx'
import { useSensorData } from '../hooks/useSensorData.js'

const page = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function flowStatusToneFromAlerts(alerts) {
  const hasSuddenDrop = alerts?.some((a) => (a.message || '').toLowerCase().includes('sudden flow drop'))
  const hasWarning = alerts?.some((a) => (a.severity || '').toLowerCase() === 'warning' || (a.message || '').toLowerCase().includes('unusual'))

  if (hasSuddenDrop) return { tone: 'danger', label: 'Sudden flow drop detected' }
  if (hasWarning) return { tone: 'warning', label: 'Flow fluctuation warning' }
  return { tone: 'normal', label: 'Flow stable' }
}

function pHTone(pH) {
  if (pH < 6 || pH > 8) return { tone: 'danger', label: 'Out of safe band' }
  if (pH < 6.3 || pH > 7.7) return { tone: 'warning', label: 'Approaching threshold' }
  return { tone: 'normal', label: 'Normal range' }
}

function ultrasonicTone(mm) {
  if (mm < 4.2) return { tone: 'warning', label: 'Wear detected' }
  return { tone: 'normal', label: 'Healthy' }
}

function acousticTone(v) {
  if (v > 78) return { tone: 'warning', label: 'Spike detected' }
  return { tone: 'normal', label: 'Normal' }
}

// Deterministic pseudo-random in [0,1) from a timestamp + salt.
function rand01(ts, salt) {
  const x = (Number(ts) ^ Number(salt)) >>> 0
  // Mix bits (simple but stable).
  const y = Math.imul(x, 1664525) + 1013904223
  return ((y >>> 0) % 4294967295) / 4294967295
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200/70" />
      <div className="mt-4 h-10 w-24 animate-pulse rounded bg-slate-200/70" />
      <div className="mt-4 h-4 w-32 animate-pulse rounded bg-slate-200/70" />
    </div>
  )
}

export default function MonitorPage() {
  const { latest, history, alerts, loading, connectionLost, lastUpdatedAt } = useSensorData()

  const effectiveHistory = useMemo(() => {
    // If the backend has no history yet (e.g., serial not streaming), seed a mock series so charts/cards are not blank.
    if (history.length > 0) return history

    // Use a stable base timestamp to avoid "impure" Date.now() during render.
    const baseTs = latest?.timestamp ?? lastUpdatedAt ?? 1700000000000
    const seedFlow = Number.isFinite(latest?.flow) ? latest.flow : 41.67
    const seedTotal = Number.isFinite(latest?.total) ? latest.total : 0
    const seedPH = Number.isFinite(latest?.pH) ? latest.pH : 7.12

    return Array.from({ length: 60 }).map((_, i) => {
      const ts = baseTs - (60 - 1 - i) * 1000

      const wobble = Math.sin(i / 7) * 0.8
      const n1 = (rand01(ts, 301) - 0.5) * 2.2
      const spike = rand01(ts, 777) < 0.05 ? (rand01(ts, 778) - 0.5) * 16 : 0

      const flow = clamp(seedFlow + wobble + n1 + spike, 10, 65)

      const phDrift = Math.sin(i / 12) * 0.08
      const phNoise = (rand01(ts, 401) - 0.5) * 0.06
      const phSpike = rand01(ts, 888) < 0.03 ? (rand01(ts, 889) < 0.5 ? -2.0 : 2.0) : 0
      const pH = clamp(seedPH + phDrift + phNoise + phSpike, 4.3, 11.2)

      const total = seedTotal + flow * i
      return { flow, pH, total, timestamp: ts }
    })
  }, [history, latest, lastUpdatedAt])

  const displayLatest = latest ?? effectiveHistory[effectiveHistory.length - 1] ?? null

  const chartData = useMemo(() => {
    return effectiveHistory.map((r) => ({
      time: formatTime(r.timestamp),
      flow: r.flow,
      pH: r.pH,
    }))
  }, [effectiveHistory])

  const mockUltrasonicHistory = useMemo(() => {
    if (effectiveHistory.length > 0) {
      // Derived from timestamps (no effect-driven state).
      return effectiveHistory.map((r, i) => {
        const ts = r.timestamp
        const drift = i * -0.002 // slow thinning over time index
        const phWear = Math.max(0, 6.2 - r.pH) * 0.008 // acidic => faster thinning
        const noise = (rand01(ts, 11) - 0.5) * 0.04
        const wobble = Math.sin(i / 8) * 0.012
        const ultrasonic = clamp(4.88 + drift - phWear + noise + wobble, 3.7, 5.2)
        return { timestamp: ts, ultrasonic }
      })
    }

    // Seed curve when backend history hasn't arrived yet.
    const nowTs = displayLatest?.timestamp
    if (!nowTs) return []

    const ph = Number(displayLatest?.pH ?? 7)
    const phWear = Math.max(0, 6.2 - ph) * 0.008

    return Array.from({ length: 60 }).map((_, i) => {
      const ts = nowTs - (60 - 1 - i) * 1000
      const drift = i * -0.002
      const noise = (rand01(ts, 11) - 0.5) * 0.04
      const wobble = Math.sin(i / 8) * 0.012
      const ultrasonic = clamp(4.88 + drift - phWear + noise + wobble, 3.7, 5.2)
      return { timestamp: ts, ultrasonic }
    })
  }, [effectiveHistory, displayLatest?.timestamp, displayLatest?.pH])

  const mockAcousticHistory = useMemo(() => {
    if (effectiveHistory.length > 0) {
      return effectiveHistory.map((r, i) => {
        const ts = r.timestamp
        const baseline = 26 + Math.sin(i / 5) * 3
        const noise = (rand01(ts, 21) - 0.5) * 10
        const spikeChance = rand01(ts, 99)
        const spike = spikeChance < 0.06 ? 35 + rand01(ts, 123) * 20 : 0
        const pHStress = Math.max(0, Math.abs(r.pH - 7) - 0.5) * 2.5
        const acoustic = clamp(baseline + noise + spike + pHStress, 0, 100)
        return { timestamp: ts, acoustic }
      })
    }

    const nowTs = displayLatest?.timestamp
    if (!nowTs) return []

    const ph = Number(displayLatest?.pH ?? 7)
    const pHStress = Math.max(0, Math.abs(ph - 7) - 0.5) * 2.5

    return Array.from({ length: 60 }).map((_, i) => {
      const ts = nowTs - (60 - 1 - i) * 1000
      const baseline = 26 + Math.sin(i / 5) * 3
      const noise = (rand01(ts, 21) - 0.5) * 10
      const spikeChance = rand01(ts, 99)
      const spike = spikeChance < 0.06 ? 35 + rand01(ts, 123) * 20 : 0
      const acoustic = clamp(baseline + noise + spike + pHStress, 0, 100)
      return { timestamp: ts, acoustic }
    })
  }, [effectiveHistory, displayLatest?.timestamp, displayLatest?.pH])

  const flowTone = displayLatest ? flowStatusToneFromAlerts(alerts) : { tone: 'normal', label: '' }
  const ph = displayLatest?.pH ?? 0
  const pHT = displayLatest ? pHTone(ph) : { tone: 'normal', label: '' }

  const lastUpdatedLabel = lastUpdatedAt ? formatTime(lastUpdatedAt) : null

  const ultrasonicLatest = mockUltrasonicHistory[mockUltrasonicHistory.length - 1]?.ultrasonic
  const ultrasonicPrev = mockUltrasonicHistory[mockUltrasonicHistory.length - 2]?.ultrasonic
  const acousticLatest = mockAcousticHistory[mockAcousticHistory.length - 1]?.acoustic
  const acousticPrev = mockAcousticHistory[mockAcousticHistory.length - 2]?.acoustic

  const ultrasonicDelta =
    Number.isFinite(ultrasonicLatest) && Number.isFinite(ultrasonicPrev) ? ultrasonicLatest - ultrasonicPrev : 0
  const acousticDelta = Number.isFinite(acousticLatest) && Number.isFinite(acousticPrev) ? acousticLatest - acousticPrev : 0

  const uTone = Number.isFinite(ultrasonicLatest) ? ultrasonicTone(ultrasonicLatest) : { tone: 'normal', label: '' }
  const aTone = Number.isFinite(acousticLatest) ? acousticTone(acousticLatest) : { tone: 'normal', label: '' }

  return (
    <section className={`${page} py-12`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Monitor</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Live telemetry from your Arduino (REST polling every 1 second).
          </p>
        </div>
        <div className="text-sm font-semibold text-slate-600">
          {connectionLost ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
              <AlertTriangle size={14} />
              Connection Lost
            </span>
          ) : lastUpdatedLabel ? (
            <span>
              Last update: <span className="text-slate-900">{lastUpdatedLabel}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            {loading || !displayLatest ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <MetricCard
                title="Flow Rate"
                icon={Droplets}
                value={displayLatest.flow.toFixed(2)}
                unit="mL/s"
                delta={0}
                statusText={flowTone.label}
                statusTone={flowTone.tone}
              />
            )}
            {loading || !displayLatest ? null : (
              <MetricCard
                title="Total Flow"
                icon={Droplets}
                value={displayLatest.total.toFixed(1)}
                unit="mL"
                delta={0}
                statusText={flowTone.tone === 'danger' ? 'Sudden drop warning' : ''}
                statusTone={flowTone.tone === 'danger' ? 'danger' : 'normal'}
              />
            )}
            {loading || !displayLatest ? null : (
              <MetricCard
                title="pH"
                icon={Gauge}
                value={displayLatest.pH.toFixed(2)}
                unit=""
                delta={0}
                statusText={pHT.label}
                statusTone={pHT.tone}
              />
            )}

            {loading || !displayLatest || ultrasonicLatest === undefined ? (
              <SkeletonCard />
            ) : (
              <MetricCard
                title="Ultrasonic Thickness"
                icon={Ruler}
                value={Number(ultrasonicLatest).toFixed(2)}
                unit="mm"
                delta={ultrasonicDelta}
                statusText={uTone.label}
                statusTone={uTone.tone}
              />
            )}

            {loading || !displayLatest || acousticLatest === undefined ? (
              <SkeletonCard />
            ) : (
              <MetricCard
                title="Acoustic / Vibration"
                icon={Volume2}
                value={Number(acousticLatest).toFixed(0)}
                unit="/100"
                delta={acousticDelta}
                statusText={aTone.label}
                statusTone={aTone.tone}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <AlertsPanel alerts={alerts} />
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Stream Status</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                <Activity size={14} />
                Live Polling
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Health checks:</span> pH thresholds + sudden flow drop detection
              </p>
              <p>
                <span className="font-semibold">Updates:</span> once per second
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-1">
          {loading ? (
            <SkeletonCard />
          ) : (
            <LiveLineChart title="Flow over time" subtitle="Polling every second" data={chartData} dataKey="flow" stroke="#0ea5e9" />
          )}
        </div>
        <div className="lg:col-span-1">
          {loading ? (
            <SkeletonCard />
          ) : (
            <LiveLineChart title="pH over time" subtitle="Threshold-based alerting" data={chartData} dataKey="pH" stroke="#14b8a6" />
          )}
        </div>
      </div>

      <div className="mt-8">
        <PipelineMap latest={latest} />
      </div>
    </section>
  )
}

