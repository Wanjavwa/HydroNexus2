import { Activity, AlertTriangle, BarChart3, Gauge, SlidersHorizontal, Shield, TestTube2, TrendingUp, Wrench } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import MonitorPage from './pages/MonitorPage.jsx'
import PredictPage from './pages/PredictPage.jsx'
import PreventPage from './pages/PreventPage.jsx'
import { SensorDataProvider } from './context/SensorDataContext.jsx'
import whatWeDoVideo from './assets/what-we-do.mp4'

const cls = {
  page: 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8',
  card: 'rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.07)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(59,130,246,0.12)]',
}

function scrollToId(id) {
  const element = document.getElementById(id)
  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function NavBar() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className={`${cls.page} flex h-16 items-center justify-between`}>
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <span className="rounded-md bg-gradient-to-r from-indigo-600 to-sky-500 p-1.5 text-white">
            <Gauge size={16} />
          </span>
          HydroNexus
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          <button className="nav-btn" onClick={() => navigate('/')}>Home</button>
          <button className="nav-btn" onClick={() => navigate('/monitor')}>Monitor</button>
          <button className="nav-btn" onClick={() => navigate('/predict')}>Predict</button>
          <button className="nav-btn" onClick={() => navigate('/prevent')}>Prevent</button>
        </nav>
      </div>
    </header>
  )
}

function HomePage() {
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(99,102,241,0.2),transparent_45%),radial-gradient(circle_at_82%_20%,rgba(14,165,233,0.22),transparent_40%)]" />
        <div className={`${cls.page} relative py-20 text-center sm:py-24`}>
          <p className="mx-auto mb-6 inline-flex items-center rounded-full bg-indigo-50 px-5 py-1.5 text-base font-semibold text-indigo-700">
            Intelligent Pipeline Platform
          </p>
          <h1 className="text-7xl font-black tracking-tight text-slate-900 sm:text-8xl">HYDRONEXUS</h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-relaxed text-slate-600 sm:text-2xl">
            All-in-one water management system to monitor pipelines, predict failures,
            and protect campus infrastructure in real time.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link to="/prevent" className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-sky-200 transition hover:opacity-90">
              Prevent Center
            </Link>
            <button
              type="button"
              onClick={() => scrollToId('monitor')}
              className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-lg font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      <section className={`${cls.page} py-16`}>
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-8 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="reveal-animate" style={{ '--reveal-shift': '-18px' }}>
              <h2 className="text-4xl font-bold text-slate-900">What We Do</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
              HydroNexus is an intelligent water management system that 
              combines smart devices such as sensors, pumps, and switches with an 
              interactive web platform—all working together to monitor real-time conditions,
               analyze system behavior, predict potential failures, and enable proactive action 
               to improve the reliability of Grambling’s water infrastructure across campus.
              </p>
            </div>

            <div className="reveal-animate" style={{ '--reveal-shift': '18px' }}>
              <div className="overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
                <video
                  src={whatWeDoVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="aspect-video w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="monitor" className={`${cls.page} scroll-mt-24 py-16`}>
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-slate-900">01 Monitor</h2>
          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Continuously monitor pipeline conditions through integrated sensing for complete real-time awareness.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className={cls.card}><Activity className="mb-3 text-sky-500" /><h3 className="text-2xl font-semibold text-slate-900">Flow & Pressure</h3><p className="mt-2 text-slate-600">Detect leaks, blockages, and abnormal behavior through flow differentials.</p></div>
          <div className={cls.card}><TestTube2 className="mb-3 text-cyan-500" /><h3 className="text-2xl font-semibold text-slate-900">Water Quality</h3><p className="mt-2 text-slate-600">Measure pH, detect hard water, contamination, and corrosion factors.</p></div>
          <div className={cls.card}><Shield className="mb-3 text-indigo-500" /><h3 className="text-2xl font-semibold text-slate-900">Structural Integrity</h3><p className="mt-2 text-slate-600">Ultrasonic and acoustic sensing for cracks, wear, and damage risk.</p></div>
        </div>
      </section>

      <section id="predict" className={`${cls.page} scroll-mt-24 py-16`}>
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-slate-900">02 Analyze & Predict</h2>
          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Process collected data to evaluate degradation, model decline, and forecast exactly when and how failures will occur.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className={cls.card}>
            <Activity className="mb-3 text-cyan-500" />
            <h3 className="text-2xl font-semibold text-slate-900">External Factors</h3>
            <p className="mt-2 text-slate-600">Assess pH, mineral content, pressure stress, and environmental impacts.</p>
          </div>
          <div className={cls.card}>
            <TrendingUp className="mb-3 text-cyan-500" />
            <h3 className="text-2xl font-semibold text-slate-900">Degradation Modeling</h3>
            <p className="mt-2 text-slate-600">Track performance decline and quantify deterioration rate over time.</p>
          </div>
          <div className={cls.card}>
            <BarChart3 className="mb-3 text-cyan-500" />
            <h3 className="text-2xl font-semibold text-slate-900">Failure Prediction</h3>
            <p className="mt-2 text-slate-600">Predict blockages, corrosion leaks, and pressure-induced bursts.</p>
          </div>
        </div>
      </section>

      <section id="prevent" className={`${cls.page} scroll-mt-24 py-16`}>
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-slate-900">03 Prevent</h2>
          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Convert predictions into actions: respond to critical events, execute recommended workflows, and manage maintenance to stop failures early.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className={cls.card}>
            <AlertTriangle className="mb-3 text-rose-500" />
            <h3 className="text-2xl font-semibold text-slate-900">🚨 Immediate Response</h3>
            <p className="mt-2 text-slate-600">Active critical alerts with action buttons and confirmation before executing shutdowns.</p>
          </div>
          <div className={cls.card}>
            <SlidersHorizontal className="mb-3 text-amber-500" />
            <h3 className="text-2xl font-semibold text-slate-900">🧠 Recommended Actions</h3>
            <p className="mt-2 text-slate-600">Top preventive workflows prioritized by urgency to stop degradation from escalating.</p>
          </div>
          <div className={cls.card}>
            <Wrench className="mb-3 text-emerald-600" />
            <h3 className="text-2xl font-semibold text-slate-900">🛠️ Maintenance Management</h3>
            <p className="mt-2 text-slate-600">Schedule, filter, and track maintenance tasks with clear status updates.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function ShellLayout() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f7f7ff_45%,#f0f9ff_100%)]">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/predict" element={<PredictPage />} />
          <Route path="/analyze" element={<PredictPage />} />
          <Route path="/prevent" element={<PreventPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SensorDataProvider>
        <ShellLayout />
      </SensorDataProvider>
    </BrowserRouter>
  )
}
