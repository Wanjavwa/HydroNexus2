import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarDays,
  Clock,
  Factory,
  Power,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useSensorData } from '../hooks/useSensorData.js'

const pipeOptions = ['Pipe A', 'Pipe B', 'Pipe C', 'Main Supply']

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatBackendTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function severityTone(sev) {
  const s = String(sev || '').toLowerCase()
  if (s === 'critical' || s === 'danger' || s === 'high') {
    return {
      badge: 'bg-rose-50 border-rose-200 text-rose-700',
      dot: 'bg-rose-500',
      card: 'border-rose-200/70 bg-rose-50/40',
    }
  }
  return {
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
    card: 'border-amber-200/70 bg-amber-50/40',
  }
}

function priorityTone(priority) {
  const p = String(priority || '').toLowerCase()
  if (p === 'high') {
    return { badge: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' }
  }
  if (p === 'medium' || p === 'med') {
    return { badge: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' }
  }
  return { badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' }
}

function StatusPill({ status }) {
  const tone =
    status === 'Completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'In Progress'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-700'

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>
}

function formatISODate(d) {
  const dt = new Date(d)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function PreventPage() {
  const [confirm, setConfirm] = useState({ open: false, action: null, alert: null })
  const [recentActions, setRecentActions] = useState([])

  const { alerts, recommendations, loading, connectionLost } = useSensorData()

  const [taskForm, setTaskForm] = useState(() => ({
    title: 'Maintenance Task',
    date: formatISODate(Date.now() + 24 * 60 * 60 * 1000),
    pipe: 'Pipe B',
    priority: 'Medium',
  }))

  const [scheduledTasks, setScheduledTasks] = useState(() => {
    const today = formatISODate(Date.now())
    const tomorrow = formatISODate(Date.now() + 24 * 60 * 60 * 1000)
    const in3 = formatISODate(Date.now() + 3 * 24 * 60 * 60 * 1000)
    return [
      { id: 't1', title: 'Flush Pipe B (scaling mitigation)', assignedDate: tomorrow, pipe: 'Pipe B', priority: 'High', status: 'Pending' },
      { id: 't2', title: 'Inspect valve alignment (Main Supply)', assignedDate: in3, pipe: 'Main Supply', priority: 'Medium', status: 'In Progress' },
      { id: 't3', title: 'Ultrasonic thickness survey (Pipe A)', assignedDate: today, pipe: 'Pipe A', priority: 'Low', status: 'Completed' },
    ]
  })

  const [filters, setFilters] = useState({
    priority: 'All',
    pipe: 'All',
    date: '',
  })

  const filteredTasks = useMemo(() => {
    return scheduledTasks
      .filter((t) => (filters.priority === 'All' ? true : t.priority === filters.priority))
      .filter((t) => (filters.pipe === 'All' ? true : t.pipe === filters.pipe))
      .filter((t) => (filters.date ? t.assignedDate === filters.date : true))
      .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))
  }, [scheduledTasks, filters])

  const smartSummary = useMemo(() => {
    const hasCritical = alerts?.some((a) => String(a.severity || '').toLowerCase() === 'critical')
    if (hasCritical) {
      return 'Based on current conditions, the system recommends addressing the Zone B leak immediately within 5 days to prevent blockage and potential failure.'
    }
    return 'Based on current conditions, the system recommends prioritizing mineral buildup and pressure stability checks to prevent degradation acceleration.'
  }, [alerts])

  const openConfirm = (alert, action) => {
    setConfirm({ open: true, alert, action })
  }

  const closeConfirm = () => setConfirm((c) => ({ ...c, open: false }))

  const executeImmediateAction = () => {
    if (!confirm.alert || !confirm.action) return
    const actionName = confirm.action
    const alertTitle = confirm.alert.message || confirm.alert.title || 'Alert'
    setRecentActions((prev) => [
      { id: `${Date.now()}-${alertTitle}`, alertTitle, action: actionName, time: nowLabel() },
      ...prev,
    ].slice(0, 6))

    setConfirm({ open: false, action: null, alert: null })
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Prevent</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Real-time action center for smart water infrastructure: respond to critical events, execute recommended maintenance, and track progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <Bell size={14} />
            Live Control Mode
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            <Bot size={14} />
            AI-driven actions
          </span>
        </div>
      </div>

      {/* 1) IMMEDIATE RESPONSE */}
      {connectionLost ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          Connection Lost. Retrying automatically...
        </div>
      ) : null}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">🚨 Immediate Response (Critical Events)</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Active alerts require confirmation before execution.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {loading ? (
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
              Loading live alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
              <p className="text-lg font-bold text-slate-900">No critical events right now</p>
              <p className="mt-1 text-sm text-slate-600">Monitoring remains active for new anomalies.</p>
            </div>
          ) : (
            alerts.map((a) => {
              const tone = severityTone(a.severity)
              return (
                <div key={`${a.message}-${a.timestamp}`} className={`rounded-2xl border ${tone.card} p-5 shadow-[0_10px_35px_rgba(239,68,68,0.10)]`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot} animate-pulse`} />
                        {a.message}
                      </p>
                      <p className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                        <ShieldAlert size={14} />
                        Severity: {a.severity}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <Clock size={14} />
                        Detected at {formatBackendTime(a.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700">Actions</p>
                    <div className="mt-3 grid gap-2">
                      {[
                        'Close Valve',
                        'Shut System',
                        'Notify Team',
                      ].map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => openConfirm(a, action)}
                          className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(239,68,68,0.12)]"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 2) RECOMMENDATIONS */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">🧠 System Recommendations (From Predict)</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">Top recommendations to prevent degradation from progressing.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {loading ? (
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
              Loading recommendations...
            </div>
          ) : (
            recommendations.slice(0, 4).map((r) => {
            const tone = priorityTone(r.priority)
            return (
              <div key={`${r.issue}-${r.priority}`} className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] transition hover:-translate-y-[2px] hover:shadow-[0_18px_45px_rgba(59,130,246,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-600">Issue</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{r.issue}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{r.reason}</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    {r.priority}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Action Buttons</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(r.actions || []).length ? (
                      r.actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => {
                            setRecentActions((prev) => [
                              { id: `${Date.now()}-${action}`, alertTitle: r.issue, action, time: nowLabel() },
                              ...prev,
                            ].slice(0, 6))
                          }}
                          className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(59,130,246,0.10)]"
                        >
                          {action}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">No actions available</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
          )}
        </div>
      </div>

      {/* 3) MAINTENANCE MANAGEMENT */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <Wrench size={18} />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">🛠️ Maintenance Management</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Schedule, track, and complete tasks with filters.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold text-slate-700">Schedule maintenance</p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const id = `t-${Date.now()}`
                setScheduledTasks((prev) => [
                  { id, title: taskForm.title, assignedDate: taskForm.date, pipe: taskForm.pipe, priority: taskForm.priority, status: 'Pending' },
                  ...prev,
                ])
                setTaskForm((f) => ({ ...f, title: 'Maintenance Task' }))
              }}
            >
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-600">Task title</span>
                <input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-600">Assigned date</span>
                <input
                  type="date"
                  value={taskForm.date}
                  onChange={(e) => setTaskForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-600">Pipe / Zone</span>
                <select
                  value={taskForm.pipe}
                  onChange={(e) => setTaskForm((f) => ({ ...f, pipe: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                >
                  {pipeOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-600">Priority</span>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                >
                  {['High', 'Medium', 'Low'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">
                Schedule
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Upcoming tasks</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">Maintenance Timeline</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    <CalendarDays size={14} />
                    {filteredTasks.length} tasks
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-600">Priority</span>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                  >
                    {['All', 'High', 'Medium', 'Low'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-600">Pipe / Zone</span>
                  <select
                    value={filters.pipe}
                    onChange={(e) => setFilters((f) => ({ ...f, pipe: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                  >
                    {['All', ...pipeOptions].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-600">Date</span>
                  <input
                    type="date"
                    value={filters.date}
                    onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-600">
                    No tasks match your filters.
                  </div>
                ) : (
                  filteredTasks.map((t) => {
                    const tone = priorityTone(t.priority)
                    return (
                      <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-[0_18px_45px_rgba(59,130,246,0.10)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                                {t.priority}
                              </span>
                              <StatusPill status={t.status} />
                            </div>
                            <p className="mt-2 text-sm font-bold text-slate-900">{t.title}</p>
                            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <Factory size={14} />
                              {t.pipe}
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <CalendarDays size={14} />
                              {t.assignedDate}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {t.status !== 'Completed' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setScheduledTasks((prev) =>
                                    prev.map((x) => (x.id === t.id ? { ...x, status: x.status === 'Pending' ? 'In Progress' : 'Completed' } : x)),
                                  )
                                }
                                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
                              >
                                {t.status === 'Pending' ? 'Start' : 'Complete'}
                              </button>
                            ) : (
                              <button
                                type="button"
                              onClick={() => setScheduledTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'Pending' } : x)))}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                Reopen
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setScheduledTasks((prev) => prev.filter((x) => x.id !== t.id))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5) SMART INSIGHT PANEL */}
      <div className="mt-8">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">🤖 System Recommendation Summary</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">What to do next</h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <SlidersHorizontal size={14} />
              Strategy
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-700 leading-relaxed">{smartSummary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              <Power size={14} />
              Monitor system stability
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              <Wrench size={14} />
              Validate structural integrity
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              <AlertTriangle size={14} />
              Respond to alerts quickly
            </span>
          </div>
        </div>
      </div>

      {/* 6) NAV LINK */}
      <div className="mt-10 flex items-center justify-center">
        <Link to="/predict" className="text-sm font-bold text-indigo-700 transition hover:underline">
          View Predictions →
        </Link>
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Confirm Immediate Action"
        message={
          confirm.alert && confirm.action
            ? `Are you sure you want to execute “${confirm.action}” for “${confirm.alert.message || confirm.alert.title || 'Alert'}”?`
            : 'Are you sure you want to proceed?'
        }
        confirmText="Execute Action"
        cancelText="Cancel"
        onClose={closeConfirm}
        onConfirm={executeImmediateAction}
      />

      {/* Small recent action strip (demo) */}
      <div className="fixed bottom-4 right-4 z-50 hidden w-80 max-w-full rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.15)] lg:block">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Action Log</p>
          <span className="text-xs font-semibold text-slate-500">{recentActions.length}/6</span>
        </div>
        <div className="mt-3 space-y-2">
          {recentActions.length === 0 ? (
            <p className="text-sm font-semibold text-slate-600">No actions executed yet.</p>
          ) : (
            recentActions.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-2">
                <p className="text-xs font-bold text-slate-900">{a.action}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{a.alertTitle}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{a.time}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

