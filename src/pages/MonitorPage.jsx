import { Activity, AlertTriangle, Droplets, Gauge, Ruler } from 'lucide-react'
import { AlertsPanel } from '../components/AlertsPanel.jsx'
import { LiveLineChart } from '../components/LiveLineChart.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import { useSensorData } from '../hooks/useSensorData.js'
import PredictPage from './PredictPage.jsx'

const page = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

function formatTime(timestamp) {
  if (!timestamp) return 'Not available'
  return new Date(timestamp).toLocaleString()
}

function flowStatusToneFromAlerts(alerts) {
  const hasSuddenDrop = alerts?.some((alert) => (alert.message || '').toLowerCase().includes('sudden flow drop'))
  const hasWarning = alerts?.some((alert) => (alert.severity || '').toLowerCase() === 'warning')
  if (hasSuddenDrop) return { tone: 'danger', label: 'Sudden flow drop detected' }
  if (hasWarning) return { tone: 'warning', label: 'Flow fluctuation warning' }
  return { tone: 'normal', label: 'No flow anomaly detected' }
}

function pHTone(pH) {
  if (pH < 6 || pH > 8) return { tone: 'danger', label: 'Out of safe band' }
  if (pH < 6.3 || pH > 7.7) return { tone: 'warning', label: 'Approaching threshold' }
  return { tone: 'normal', label: 'Within monitored range' }
}

function SensorCard({ title, icon, value, unit, statusText, statusTone = 'normal' }) {
  return (
    <MetricCard
      title={title}
      icon={icon}
      value={value}
      unit={unit}
      statusText={statusText}
      statusTone={statusTone}
    />
  )
}

function FreshnessNotice({ status, connectionLost, error }) {
  let message = null
  if (connectionLost) message = `Backend connection lost${error ? `: ${error}` : ''}. Retrying automatically.`
  else if (!status?.connected) message = 'Arduino is offline. Displayed measurements are the last readings received, not live data.'
  else if (status.stale) message = 'Arduino is connected, but its last valid measurement is stale. Values shown are not live.'

  if (!message) return null
  return (
    <div role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      {message}
    </div>
  )
}

export default function MonitorPage() {
  const { latest, history, alerts, loading, connectionLost, error, lastUpdatedAt, status } = useSensorData()
  const isStale = !status?.connected || status?.stale || connectionLost
  const flowTone = flowStatusToneFromAlerts(alerts)
  const phTone = Number.isFinite(latest?.pH) ? pHTone(latest.pH) : { tone: 'normal', label: 'Measurement missing' }
  const chartData = history.map((reading) => ({
    time: new Date(reading.timestamp).toLocaleTimeString(),
    flow: Number.isFinite(reading.flow) ? reading.flow : null,
    pH: Number.isFinite(reading.pH) ? reading.pH : null,
    pressure: Number.isFinite(reading.pressure) ? reading.pressure : null,
    thicknessMm: Number.isFinite(reading.thicknessMm) ? reading.thicknessMm : null,
  }))
  const sourceLabel = status?.source === 'demo'
    ? 'DEMO SIMULATION'
    : status?.source === 'arduino'
      ? 'Arduino serial'
      : 'Backend status unavailable'
  const connectionLabel = status?.source === 'demo'
    ? 'Demo active'
    : status?.connected
      ? 'Connected'
      : 'Offline'
  const pressureUnit = latest?.pressureUnit ? ` ${latest.pressureUnit}` : ''

  return (
    <>
    <section className={`${page} py-12`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Monitor & Predict</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Measurements received from the connected Arduino and polled from the backend every second.
          </p>
        </div>
        <div className="flex flex-col gap-1 text-sm font-semibold text-slate-600 sm:items-end">
          <span>Data source: <span className="text-slate-900">{sourceLabel}</span></span>
          <span>Connection: <span className={status?.connected ? 'text-emerald-700' : 'text-rose-700'}>{connectionLabel}</span></span>
          <span>Last measurement: <span className="text-slate-900">{formatTime(lastUpdatedAt)}</span></span>
        </div>
      </div>

      <FreshnessNotice status={status} connectionLost={connectionLost} error={error} />

      {loading && !latest ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Waiting for backend readings…</div>
      ) : !latest ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
          No valid Arduino readings have been received. Check the serial connection and message format.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SensorCard
              title="Flow Rate"
              icon={Droplets}
              value={Number.isFinite(latest.flow) ? latest.flow.toFixed(2) : 'Missing'}
              unit={Number.isFinite(latest.flow) ? 'mL/s' : ''}
              statusText={Number.isFinite(latest.flow) ? flowTone.label : 'Flow measurement missing'}
              statusTone={isStale ? 'warning' : flowTone.tone}
            />
            <SensorCard
              title="Total Flow"
              icon={Droplets}
              value={Number.isFinite(latest.total) ? latest.total.toFixed(1) : 'Missing'}
              unit={Number.isFinite(latest.total) ? 'mL' : ''}
              statusText={Number.isFinite(latest.total) ? 'Arduino-reported total' : 'Total measurement missing'}
              statusTone={isStale ? 'warning' : 'normal'}
            />
            <SensorCard
              title="pH"
              icon={Gauge}
              value={Number.isFinite(latest.pH) ? latest.pH.toFixed(2) : 'Missing'}
              statusText={phTone.label}
              statusTone={isStale ? 'warning' : phTone.tone}
            />
            <SensorCard
              title="Pressure"
              icon={Activity}
              value={Number.isFinite(latest.pressure) ? latest.pressure.toFixed(2) : 'Missing'}
              unit={Number.isFinite(latest.pressure) ? pressureUnit : ''}
              statusText={Number.isFinite(latest.pressure) ? 'Arduino-reported measurement' : 'Pressure sensor reading unavailable'}
              statusTone={isStale ? 'warning' : 'normal'}
            />
            <SensorCard
              title="Wall Thickness"
              icon={Ruler}
              value={Number.isFinite(latest.thicknessMm) ? latest.thicknessMm.toFixed(2) : 'Missing'}
              unit={Number.isFinite(latest.thicknessMm) ? 'mm' : ''}
              statusText={Number.isFinite(latest.thicknessMm) ? 'Reported ultrasonic measurement' : 'Thickness reading unavailable'}
              statusTone={isStale ? 'warning' : 'normal'}
            />
          </div>
          {Number.isFinite(latest.thicknessMm) ? (
            <p className="mt-3 text-sm text-amber-800">Thickness is the reported measurement only. A baseline, material, calibration, and inspection context are required to assess wall loss.</p>
          ) : null}

          {isStale ? (
            <p className="mt-3 text-sm font-semibold text-amber-700">
              Values above are the last valid measurements received at {formatTime(latest.timestamp)}.
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <LiveLineChart title="Flow history" subtitle="Backend readings only" data={chartData} dataKey="flow" stroke="#0ea5e9" />
                <LiveLineChart title="pH history" subtitle="Backend readings only" data={chartData} dataKey="pH" stroke="#14b8a6" />
                <LiveLineChart title="Pressure history" subtitle="Only present when reported by the Arduino" data={chartData} dataKey="pressure" stroke="#6366f1" />
                <LiveLineChart title="Wall thickness history" subtitle="Only present when reported by an ultrasonic sensor" data={chartData} dataKey="thicknessMm" stroke="#f59e0b" />
              </div>
            </div>
            <div className="space-y-4">
              <AlertsPanel alerts={alerts} status={status} hasReadings={Boolean(latest)} />
              <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                <p className="text-sm font-semibold text-slate-900">Stream Status</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Source:</span> {sourceLabel}</p>
                  <p><span className="font-semibold">{status?.source === 'demo' ? 'Demo source:' : 'Serial connection:'}</span> {status?.source === 'demo' ? 'Active (simulated readings)' : status?.connected ? 'Connected' : 'Offline'}</p>
                  <p><span className="font-semibold">Freshness:</span> {status?.stale ? 'Stale' : 'Current'}</p>
                  <p><span className="font-semibold">Asset ID:</span> {latest.assetId || 'Not reported'}</p>
                  <p><span className="font-semibold">Sensor IDs:</span> {latest.sensorId || (latest.sensorIds ? Object.values(latest.sensorIds).join(', ') : 'Not reported')}</p>
                  <p><span className="font-semibold">Polling:</span> every second</p>
                </div>
              </div>
            </div>
          </div>

        </>
      )}
    </section>
    <PredictPage embedded />
    </>
  )
}
