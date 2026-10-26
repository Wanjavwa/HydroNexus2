import { AlertTriangle, Factory } from 'lucide-react'

function formatMeasurement(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'Missing'
}

export default function PipelineMap({ latest, status }) {
  const connected = Boolean(status?.connected && !status?.stale)
  const demoMode = status?.source === 'demo'
  const assetName = latest?.assetId || 'Connected Arduino asset'

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div>
        <p className="text-sm font-semibold text-slate-500">Network Visualization</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Observed Sensor Node</h2>
        <p className="mt-1 text-sm text-slate-600">
          {demoMode
            ? 'This node displays simulated demo readings and is not connected hardware.'
            : 'Only the connected Arduino asset is shown; no unmeasured branch values are estimated.'}
        </p>
      </div>

      {!connected ? (
        <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <AlertTriangle size={16} />
          Arduino is offline or the most recent reading is stale.
        </div>
      ) : null}

      <div className="mt-5 flex flex-col items-center">
        <div className={`w-full max-w-md rounded-2xl border p-5 ${connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`rounded-xl p-2 text-white ${connected ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                <Factory size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observed asset</p>
                <h3 className="font-bold text-slate-900">{assetName}</h3>
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${connected ? 'border-emerald-200 bg-white text-emerald-700' : 'border-amber-200 bg-white text-amber-800'}`}>
              {demoMode ? 'DEMO SIMULATION' : connected ? 'ONLINE' : 'OFFLINE / STALE'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Flow</p>
              <p className="mt-1 font-bold text-slate-900">{formatMeasurement(latest?.flow)}</p>
              <p className="text-xs text-slate-500">mL/s</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">pH</p>
              <p className="mt-1 font-bold text-slate-900">{formatMeasurement(latest?.pH)}</p>
              <p className="text-xs text-slate-500">pH</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Pressure</p>
              <p className="mt-1 font-bold text-slate-900">{formatMeasurement(latest?.pressure)}</p>
              <p className="text-xs text-slate-500">{latest?.pressureUnit || 'unit not reported'}</p>
            </div>
          </div>

          <p className="mt-4 text-xs font-medium text-slate-600">
            Last measurement: {latest?.timestamp ? new Date(latest.timestamp).toLocaleString() : 'Not available'}
          </p>
        </div>
      </div>
    </div>
  )
}
