import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function LiveLineChart({ title, subtitle, data, dataKey, stroke }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} width={38} />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

