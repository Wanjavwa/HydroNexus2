const express = require('express')
const cors = require('cors')
const { createSerialReader } = require('./serialReader')
const { createDemoSource } = require('./demoSource')
const store = require('./store')

const PORT = Number(process.env.PORT || 3001)
const SERIAL_PORT = process.env.SERIAL_PORT || ''
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD || 9600)
const configuredStaleMs = Number(process.env.READING_STALE_MS || 10000)
const READING_STALE_MS = Number.isFinite(configuredStaleMs) && configuredStaleMs > 0 ? configuredStaleMs : 10000
const DEMO_MODE = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'

async function main() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // API: latest sensor reading
  app.get('/api/sensors', (req, res) => {
    res.json(store.getLatest())
  })

  // API: Arduino connection state and reading freshness
  app.get('/api/status', (req, res) => {
    res.json(store.getStatus(READING_STALE_MS))
  })

  // API: last 60 readings
  app.get('/api/history', (req, res) => {
    res.json(store.getHistory())
  })

  // API: active alerts derived from latest reading
  app.get('/api/alerts', (req, res) => {
    res.json(store.computeActiveAlerts())
  })

  // API: recommendations derived from latest reading
  app.get('/api/recommendations', (req, res) => {
    res.json(store.computeRecommendations())
  })

  store.setDataSource(DEMO_MODE ? 'demo' : 'arduino')
  if (DEMO_MODE) {
    createDemoSource().start()
    console.warn('[demo] DEMO_MODE is enabled; simulated readings are isolated from Arduino serial input')
  } else {
    const reader = createSerialReader({
      portPath: SERIAL_PORT,
      baudRate: SERIAL_BAUD,
    })

    // Start serial reading before/while the HTTP server runs.
    reader.start().catch((err) => {
      console.error('[serial] start failed:', err?.message || err)
    })
  }

  app.listen(PORT, () => {
    console.log(`HydroNexus backend listening on http://localhost:${PORT}`)
    console.log(DEMO_MODE
      ? 'Data source: DEMO SIMULATION (Arduino serial disabled)'
      : `Serial config: ${SERIAL_PORT || 'not configured'} @ ${SERIAL_BAUD} baud`)
    console.log(`Reading stale after: ${READING_STALE_MS} ms`)
  })

  // Ensure we don't crash on unhandled errors (we still log them).
  process.on('unhandledRejection', (reason) => {
    console.log('[unhandledRejection]', reason)
  })
  process.on('uncaughtException', (err) => {
    console.log('[uncaughtException]', err)
  })
}

main()
