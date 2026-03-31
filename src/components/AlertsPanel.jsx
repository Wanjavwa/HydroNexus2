export function AlertsPanel({ alerts }) {
  const visible = alerts?.length ? alerts : []

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Active Alerts</p>
        <p className="text-xs font-semibold text-slate-500">{visible.length ? `${visible.length} active` : 'All clear'}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visible.length === 0 ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Normal conditions
          </span>
        ) : (
          visible.map((a, i) => (
            <span
              key={`${a.message}-${i}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                a.severity === 'critical' || a.severity === 'danger' || a.type === 'danger' || a.type === 'critical'
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {a.message}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

