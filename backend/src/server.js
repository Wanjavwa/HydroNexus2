const express = require('express')
const cors = require('cors')
const { createSerialReader } = require('./serialReader')
const store = require('./store')

const PORT = Number(process.env.PORT || 3001)
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3'
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD || 9600)

async function main() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // API: latest sensor reading
  app.get('/api/sensors', (req, res) => {
    res.json(store.getLatest())
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

  const reader = createSerialReader({
    portPath: SERIAL_PORT,
    baudRate: SERIAL_BAUD,
  })

  // Start serial reading before/while the HTTP server runs.
  reader.start().catch((err) => {
    console.log('[serial] start failed:', err?.message || err)
  })

  app.listen(PORT, () => {
    console.log(`HydroNexus backend listening on http://localhost:${PORT}`)
    console.log(`Serial config: ${SERIAL_PORT} @ ${SERIAL_BAUD}`)
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

