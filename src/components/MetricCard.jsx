function trendMeta(delta, dangerHigh = null, dangerLow = null, warnHigh = null, warnLow = null) {
  const up = delta > 0.0001
  const down = delta < -0.0001
  const arrow = up ? '↑' : down ? '↓' : '→'

  let severity = 'normal'
  if ((dangerHigh !== null && dangerHigh) || (dangerLow !== null && dangerLow)) severity = 'danger'
  if (severity !== 'danger' && ((warnHigh !== null && warnHigh) || (warnLow !== null && warnLow))) severity = 'warning'

  const color =
    severity === 'danger' ? 'text-rose-600' : severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'

  return { arrow, color, severity }
}

export function MetricCard({
  title,
  icon: Icon,
  value,
  unit,
  delta = 0,
  statusText,
  statusTone = 'normal', // normal | warning | danger
}) {
  const tone =
    statusTone === 'danger'
      ? 'border-rose-200 bg-rose-50'
      : statusTone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-white/90'

  const meta = trendMeta(delta)

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p key={String(value)} className="text-3xl font-bold text-slate-900 transition duration-200 ease-out">
              {value}
            </p>
            {unit ? <p className="text-sm font-semibold text-slate-500">{unit}</p> : null}
          </div>
          <p className={`mt-2 text-sm font-semibold ${meta.color}`}>{meta.arrow} {Math.abs(delta).toFixed(2)}</p>
          {statusText ? <p className="mt-2 text-sm text-slate-700">{statusText}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 p-2.5 text-white shadow-sm">
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

