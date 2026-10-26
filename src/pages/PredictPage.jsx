import { AlertTriangle, Activity, Clock, Gauge, Waves } from 'lucide-react'
import { LiveLineChart } from '../components/LiveLineChart.jsx'
import { useSensorData } from '../hooks/useSensorData.js'

function formatTimestamp(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not available'
}

function valueOrMissing(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'Missing'
}

function StatusNotice({ status, connectionLost, error }) {
  if (!connectionLost && status?.connected && !status?.stale) return null
  const message = connectionLost
    ? `Backend connection lost${error ? `: ${error}` : ''}.`
    : !status?.connected
      ? 'Arduino is offline. Historical values are not live.'
      : 'Arduino is connected, but the last valid measurement is stale.'

  return (
    <div role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      {message} The analysis below uses only readings returned by the backend.
    </div>
  )
}

export default function PredictPage({ embedded = false }) {
  const { latest, history, alerts, recommendations, status, connectionLost, error, loading } = useSensorData()
  const flowHistory = history
    .filter((reading) => Number.isFinite(reading.flow))
    .map((reading) => ({ time: new Date(reading.timestamp).toLocaleTimeString(), flow: reading.flow }))
  const phHistory = history
    .filter((reading) => Number.isFinite(reading.pH))
    .map((reading) => ({ time: new Date(reading.timestamp).toLocaleTimeString(), pH: reading.pH }))
  const thicknessHistory = history
    .filter((reading) => Number.isFinite(reading.thicknessMm))
    .map((reading) => ({ time: new Date(reading.timestamp).toLocaleTimeString(), thicknessMm: reading.thicknessMm }))
  const missingSensors = [
    ['Flow', latest?.flow],
    ['pH', latest?.pH],
    ['Pressure', latest?.pressure],
    ['Thickness', latest?.thicknessMm],
  ].filter(([, value]) => !Number.isFinite(value)).map(([name]) => name)

  return (
    <section className={embedded ? 'mx-auto mt-2 w-full max-w-6xl border-t border-slate-200 px-4 py-10 sm:px-6 lg:px-8' : 'mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{embedded ? 'Anomaly Analysis' : 'Monitor & Predict'}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Backend anomaly detection from actual Arduino measurements and available valid history. This view does not predict future failures.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 sm:self-auto">
          <Activity size={14} />
          Source: {status?.source === 'demo' ? 'DEMO SIMULATION' : status?.source === 'arduino' ? 'Arduino serial' : 'Unavailable'}
        </span>
      </div>

      <StatusNotice status={status} connectionLost={connectionLost} error={error} />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] lg:col-span-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="text-xl font-bold text-slate-900">Detected anomalies</h2>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-slate-600">Loading readings…</p>
          ) : alerts.length ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert, index) => (
                <li key={`${alert.message}-${alert.timestamp}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="font-semibold text-slate-900">{alert.message}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {alert.severity} · detected {formatTimestamp(alert.timestamp)}
                  </p>
                </li>
              ))}
            </ul>
          ) : latest && status?.connected && !status.stale ? (
            <p className="mt-4 text-sm text-slate-600">No anomalies detected in the available valid readings.</p>
          ) : (
            <p className="mt-4 text-sm font-semibold text-amber-800">No current valid readings; anomaly status is unavailable.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Data quality</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-600">Valid history points</dt><dd className="font-bold text-slate-900">{history.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-600">Last measurement</dt><dd className="text-right font-bold text-slate-900">{formatTimestamp(latest?.timestamp)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-600">{status?.source === 'demo' ? 'Demo source' : 'Serial connection'}</dt><dd className="font-bold text-slate-900">{status?.source === 'demo' ? 'Active (simulated)' : status?.connected ? 'Connected' : 'Offline'}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-amber-800">
            Missing measurements: {missingSensors.length ? missingSensors.join(', ') : 'None'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <LiveLineChart title="Flow history" subtitle="Actual valid flow readings; no generated points" data={flowHistory} dataKey="flow" stroke="#0ea5e9" />
        <LiveLineChart title="pH history" subtitle="Actual valid pH readings; no generated points" data={phHistory} dataKey="pH" stroke="#14b8a6" />
        <LiveLineChart title="Wall thickness history" subtitle="Only reported ultrasonic measurements; no inferred wall loss" data={thicknessHistory} dataKey="thicknessMm" stroke="#f59e0b" />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2">
          <Waves size={18} className="text-sky-600" />
          <h2 className="text-xl font-bold text-slate-900">Latest backend reading</h2>
        </div>
        {latest ? (
          <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Flow</p><p className="font-bold">{valueOrMissing(latest.flow)} {Number.isFinite(latest.flow) ? 'mL/s' : ''}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">pH</p><p className="font-bold">{valueOrMissing(latest.pH)}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Pressure</p><p className="font-bold">{valueOrMissing(latest.pressure)} {Number.isFinite(latest.pressure) ? latest.pressureUnit || '' : ''}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Wall thickness</p><p className="font-bold">{valueOrMissing(latest.thicknessMm)} {Number.isFinite(latest.thicknessMm) ? 'mm' : ''}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Asset / sensor</p><p className="break-words font-bold">{latest.assetId || 'Not reported'} / {latest.sensorId || 'Not reported'}</p></div>
          </div>
          {Number.isFinite(latest.thicknessMm) ? <p className="mt-3 text-sm text-amber-800">A thickness value alone does not establish wall loss; no baseline or material model is configured.</p> : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No valid readings have been received from the backend.</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900">Backend maintenance recommendations</h2>
        </div>
        {recommendations.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {recommendations.map((recommendation) => (
              <li key={recommendation.issue} className="rounded-xl border border-slate-200 p-4">
                <p className="font-bold text-slate-900">{recommendation.issue}</p>
                <p className="mt-1 text-sm text-slate-600">{recommendation.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            {latest ? 'No anomaly-based recommendations are available from the current readings.' : 'Recommendations are unavailable until valid Arduino readings arrive.'}
          </p>
        )}
      </div>
    </section>
  )
}
