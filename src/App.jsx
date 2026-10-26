import { createElement, lazy, Suspense } from 'react'
import { Activity, Bot, Network, Wrench } from 'lucide-react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import AssistantWidget from './components/AssistantWidget.jsx'
import MonitorPage from './pages/MonitorPage.jsx'
import PreventPage from './pages/PreventPage.jsx'
import { SensorDataProvider } from './context/SensorDataContext.jsx'
import { WorkspaceProvider } from './context/WorkspaceContext.jsx'

const DigitalTwinPage = lazy(() => import('./pages/DigitalTwinPage.jsx'))

const navItems = [
  { to: '/monitor-predict', label: 'Monitor & Predict', icon: Activity },
  { to: '/digital-twin', label: 'Digital Twin', icon: Network },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
]

function Navigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <NavLink to="/monitor-predict" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <span className="rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 p-2 text-white"><Activity size={17} /></span>
          HydroNexus
        </NavLink>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-indigo-50 text-indigo-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              {createElement(icon, { size: 16 })}
              {label}
            </NavLink>
          ))}
          <span className="ml-2 hidden items-center gap-1 text-xs font-semibold text-slate-500 sm:inline-flex"><Bot size={14} /> Assistant</span>
        </nav>
      </div>
    </header>
  )
}

function AppShell() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f7f7ff_45%,#f0f9ff_100%)]">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/monitor-predict" replace />} />
          <Route path="/monitor-predict" element={<MonitorPage />} />
          <Route
            path="/digital-twin"
            element={(
              <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-10 text-slate-600">Loading digital twin…</p>}>
                <DigitalTwinPage />
              </Suspense>
            )}
          />
          <Route path="/maintenance" element={<PreventPage />} />
          <Route path="/monitor" element={<Navigate to="/monitor-predict" replace />} />
          <Route path="/predict" element={<Navigate to="/monitor-predict" replace />} />
          <Route path="/analyze" element={<Navigate to="/monitor-predict" replace />} />
          <Route path="/prevent" element={<Navigate to="/maintenance" replace />} />
          <Route path="*" element={<Navigate to="/monitor-predict" replace />} />
        </Routes>
      </main>
      <AssistantWidget />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SensorDataProvider>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </SensorDataProvider>
    </BrowserRouter>
  )
}
