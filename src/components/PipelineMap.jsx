import { useMemo, useState } from 'react'
import { AlertTriangle, Factory } from 'lucide-react'
import { computePipeHealthScore, getRiskFromScore } from '../utils/pipeHealth.js'

function statusToColor(status) {
  if (status === 'green') return { dot: 'bg-emerald-500', pill: 'bg-emerald-50 border-emerald-200 text-emerald-700', ring: 'ring-emerald-500/40' }
  if (status === 'yellow') return { dot: 'bg-amber-500', pill: 'bg-amber-50 border-amber-200 text-amber-700', ring: 'ring-amber-500/40' }
  return { dot: 'bg-rose-500', pill: 'bg-rose-50 border-rose-200 text-rose-700', ring: 'ring-rose-500/40' }
}

function deriveNodeStatus(score) {
  const r = getRiskFromScore(score)
  if (r.severity === 'normal') return 'green'
  if (r.severity === 'warning') return 'yellow'
  return 'red'
}

function formatNum(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

export default function PipelineMap({ latest }) {
  const [selectedId, setSelectedId] = useState('main')

  const nodes = useMemo(() => {
    if (!latest) return []

    const flow = latest.flow
    const pH = latest.pH

    const mkNode = (id, name, nodeFlow, nodePH) => {
      const { score, flowDeviationRatio } = computePipeHealthScore({ flow: nodeFlow, pH: nodePH })
      const status = deriveNodeStatus(score)
      const alerts = []

      if (nodePH < 6) alerts.push('Low pH')
      if (nodePH > 8) alerts.push('High pH')

      if (flowDeviationRatio > 0.3) alerts.push('Flow Instability')

      return {
        id,
        name,
        flow: nodeFlow,
        pH: nodePH,
        health: score,
        status,
        alerts: alerts.slice(0, 3),
      }
    }

    return [
      mkNode('main', 'Main Supply', flow, pH),
      mkNode('dorms', 'Dorms', flow * 0.9, pH - 0.15),
      mkNode('cafeteria', 'Cafeteria', flow * 0.75, pH - 0.05),
      mkNode('gym', 'Gym', flow * 0.95, pH - 0.2),
    ]
  }, [latest])

  const selected = nodes.find((n) => n.id === selectedId) || nodes[0]
  const colors = selected ? statusToColor(selected.status) : statusToColor('green')

  if (!selected) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded bg-slate-200/70" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Pipeline Architecture</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Live Node Status</h2>
          <p className="mt-1 text-sm text-slate-600">Node health is derived from flow deviation + pH thresholds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className={`h-2.5 w-2.5 rounded-full ${statusToColor('green').dot}`} />
            Healthy
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className={`h-2.5 w-2.5 rounded-full ${statusToColor('yellow').dot}`} />
            Warning
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <span className={`h-2.5 w-2.5 rounded-full ${statusToColor('red').dot}`} />
            Critical
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-center gap-5">
            {nodes.map((node, idx) => {
              const c = statusToColor(node.status)
              const active = node.id === selectedId
              return (
                <div key={node.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={`w-40 rounded-2xl border px-3 py-4 text-left transition
                      ${active ? `ring-2 ring-offset-2 ring-cyan-200 ${c.ring}` : 'border-slate-200 hover:border-cyan-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot} ${node.status === 'red' ? 'animate-pulse' : ''}`} />
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${c.pill}`}>
                        {node.status === 'green' ? 'OK' : node.status === 'yellow' ? 'WARN' : 'CRIT'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">{node.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">Health {node.health}%</p>
                  </button>
                  {idx < nodes.length - 1 ? <div className="hidden h-[2px] w-10 bg-slate-300 sm:block" /> : null}
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Factory size={16} className="text-slate-500" />
              Main Supply → Dorms → Cafeteria → Gym
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Selected Node</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h3>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${colors.pill}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
              {selected.status === 'green' ? 'Healthy' : selected.status === 'yellow' ? 'Warning' : 'Critical'}
            </span>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Flow</span>
              <span className="font-bold">{formatNum(selected.flow)} mL/s</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">pH</span>
              <span className="font-bold">{formatNum(selected.pH)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Health score</span>
              <span className="font-bold">{selected.health}%</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700">Alerts</p>
            {selected.alerts.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.alerts.map((a) => {
                  const critical = a === 'Low pH' || a === 'High pH' || a === 'Possible Leak'
                  return (
                    <span
                      key={a}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                        critical ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                    >
                      <AlertTriangle size={14} />
                      {a}
                    </span>
                  )
                })}
              </div>
            ) : (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                No alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

