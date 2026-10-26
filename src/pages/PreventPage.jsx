import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Clock, ExternalLink, Plus, Trash2, Wrench } from 'lucide-react'
import { useSensorData } from '../hooks/useSensorData.js'
import { apiRequest } from '../utils/api.js'

function formatTime(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not available'
}

function dateOnly(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function evidenceText(value, unit = '') {
  return Number.isFinite(value) ? `${value}${unit}` : 'Missing'
}

export default function PreventPage() {
  const { latest, alerts, recommendations, status, connectionLost } = useSensorData()
  const [tasks, setTasks] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [actionLog, setActionLog] = useState([])
  const [task, setTask] = useState({
    title: '',
    assignedDate: dateOnly(Date.now() + 86400000),
    assetId: '',
    priority: 'Medium',
  })

  const liveUnavailable = connectionLost || !status?.connected || status?.stale
  const taskCount = useMemo(() => tasks.filter((item) => item.status !== 'Completed').length, [tasks])

  async function loadMaintenance() {
    setError(null)
    try {
      const [taskList, network] = await Promise.all([
        apiRequest('/api/maintenance'),
        apiRequest('/api/network'),
      ])
      setTasks(Array.isArray(taskList) ? taskList : [])
      setAssets(Array.isArray(network.assets) ? network.assets : [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMaintenance()
  }, [])

  async function createTask(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await apiRequest('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({ ...task, assetId: task.assetId || null, status: 'Pending' }),
      })
      setTasks(updated)
      setTask((current) => ({ ...current, title: '' }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateTaskStatus(item, newStatus) {
    setSaving(true)
    setError(null)
    try {
      const updated = await apiRequest(`/api/maintenance/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setTasks(updated)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask(id) {
    setSaving(true)
    setError(null)
    try {
      const updated = await apiRequest(`/api/maintenance/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setTasks(updated)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function logOperatorAction(alert, action) {
    if (!window.confirm(`Log "${action}" for "${alert.message}"? This records an operator action only; HydroNexus is not connected to valve or pump controls.`)) return
    setActionLog((current) => [
      { id: `${Date.now()}-${action}`, title: alert.message, action, timestamp: Date.now() },
      ...current,
    ].slice(0, 10))
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Maintenance</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-900">Inspections & Workflows</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Recommendations use backend-detected anomalies and actual available readings. Future failure prediction is not configured.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${status?.source === 'demo' ? 'border-amber-200 bg-amber-50 text-amber-900' : liveUnavailable ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {status?.source === 'demo' ? 'DEMO SIMULATION' : liveUnavailable ? 'Data offline or stale' : 'Arduino live data'}
        </span>
      </div>

      {liveUnavailable ? (
        <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {connectionLost ? 'Backend connection lost. Live recommendation status is unavailable.' : !status?.connected ? 'Arduino is disconnected; displayed readings are not live.' : 'Arduino readings are stale; verify the equipment before acting.'}
        </div>
      ) : null}
      {error ? <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div> : null}

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Detected events</h2>
              <p className="mt-1 text-sm text-slate-600">Evidence is linked to the latest valid backend readings.</p>
            </div>
            <AlertTriangle className="text-amber-600" />
          </div>
          {alerts.length ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert, index) => (
                <li key={`${alert.message}-${alert.timestamp}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="font-bold text-slate-900">{alert.message}</p>
                  <p className="mt-1 text-sm text-slate-700">{alert.severity} · {formatTime(alert.timestamp)}</p>
                  {alert.assetId ? <Link to={`/digital-twin?asset=${encodeURIComponent(alert.assetId)}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">Asset {alert.assetId} <ExternalLink size={14} /></Link> : <p className="mt-1 text-xs text-slate-500">Asset not reported by this sensor.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Inspect', 'Notify team'].map((action) => (
                      <button key={action} onClick={() => logOperatorAction(alert, action)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{action}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {liveUnavailable ? 'No current valid evidence; anomaly status cannot be evaluated.' : latest ? 'No backend anomaly is currently detected.' : 'Waiting for actual sensor measurements.'}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Wrench className="text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Evidence-based recommendations</h2>
          </div>
          {recommendations.length ? (
            <ul className="mt-4 space-y-3">
              {recommendations.map((recommendation) => (
                <li key={recommendation.issue} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900">{recommendation.issue}</h3>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-800">{recommendation.priority}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{recommendation.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Evidence: flow {evidenceText(recommendation.evidence?.flow, ' mL/s')} · pH {evidenceText(recommendation.evidence?.pH)} · pressure {evidenceText(recommendation.evidence?.pressure, recommendation.evidence?.pressure === null ? '' : ` ${latest?.pressureUnit || ''}`)} · wall thickness {evidenceText(recommendation.evidence?.thicknessMm, ' mm')}.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Reading time: {formatTime(recommendation.timestamp)} · Failure prediction: unavailable</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(recommendation.actions || []).map((action) => (
                      <button key={action} onClick={() => logOperatorAction(recommendation, action)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">{action}</button>
                    ))}
                    {recommendation.assetId ? <Link to={`/digital-twin?asset=${encodeURIComponent(recommendation.assetId)}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white">Open asset <ExternalLink size={14} /></Link> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {liveUnavailable ? 'Recommendations are unavailable while readings are offline or stale.' : 'No anomaly-based recommendation is available from the current measurements.'}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-emerald-700" />
          <h2 className="text-xl font-bold text-slate-900">Maintenance schedule</h2>
          <span className="ml-auto text-sm text-slate-600">{taskCount} open</span>
        </div>
        <form onSubmit={createTask} className="mt-4 grid gap-3 md:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">Task
            <input required maxLength={160} value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Due date
            <input type="date" required value={task.assignedDate} onChange={(event) => setTask({ ...task, assignedDate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Asset
            <select value={task.assetId} onChange={(event) => setTask({ ...task, assetId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
              <option value="">Unassigned</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.id})</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Priority
            <select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
              {['High', 'Medium', 'Low'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50 md:col-span-5"><Plus size={16} /> Add task</button>
        </form>
        {loading ? <p className="mt-5 text-sm text-slate-500">Loading saved maintenance tasks…</p> : tasks.length ? (
          <ul className="mt-5 divide-y divide-slate-200">
            {tasks.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.assetId ? <Link className="text-indigo-700 underline" to={`/digital-twin?asset=${encodeURIComponent(item.assetId)}`}>{assets.find((asset) => asset.id === item.assetId)?.name || item.assetId}</Link> : 'Unassigned'} · {item.priority} priority · Due {item.assignedDate}</p>
                  <p className="text-xs text-slate-500">Updated {formatTime(item.updatedAt)}</p>
                </div>
                <label className="text-sm font-semibold text-slate-600">Status
                  <select value={item.status} disabled={saving} onChange={(event) => updateTaskStatus(item, event.target.value)} className="ml-2 rounded-lg border border-slate-300 px-2 py-1">
                    {['Pending', 'In Progress', 'Completed'].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <button type="button" aria-label="Delete maintenance task" disabled={saving} onClick={() => deleteTask(item.id)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={17} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No maintenance tasks are saved yet.</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Clock size={18} className="text-slate-600" /><h2 className="font-bold text-slate-900">Operator action log</h2></div>
        <p className="mt-1 text-xs text-slate-500">Actions here are local notes only; HydroNexus does not control pumps or valves.</p>
        {actionLog.length ? (
          <ul className="mt-3 space-y-2">{actionLog.map((entry) => <li key={entry.id} className="text-sm text-slate-700">{formatTime(entry.timestamp)} · {entry.action} · {entry.title}</li>)}</ul>
        ) : <p className="mt-3 text-sm text-slate-500">No operator actions logged this session.</p>}
      </section>
    </section>
  )
}
