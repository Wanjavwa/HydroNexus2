require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') })
const express = require('express')
const cors = require('cors')
const { createSerialReader } = require('./serialReader')
const { createDemoSource } = require('./demoSource')
const networkStore = require('./networkStore')
const maintenanceStore = require('./maintenanceStore')
const { answerAssistant, getAssistantStatus } = require('./assistant')
const store = require('./store')

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'
const SERIAL_PORT = process.env.SERIAL_PORT || ''
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD || 9600)
const configuredStaleMs = Number(process.env.READING_STALE_MS || 10000)
const READING_STALE_MS = Number.isFinite(configuredStaleMs) && configuredStaleMs > 0 ? configuredStaleMs : 10000
const DEMO_MODE = String(process.env.DEMO_MODE || '').toLowerCase() === 'true'

async function main() {
  const app = express()
  const assistantRequests = new Map()

  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/sensors', (req, res) => res.json(store.getLatest()))
  app.get('/api/status', (req, res) => res.json(store.getStatus(READING_STALE_MS)))
  app.get('/api/history', (req, res) => res.json(store.getHistory()))
  app.get('/api/alerts', (req, res) => res.json(store.computeActiveAlerts()))
  app.get('/api/recommendations', (req, res) => res.json(store.computeRecommendations()))
  app.get('/api/network', (req, res, next) => {
    try {
      res.json(networkStore.listNetwork())
    } catch (error) {
      next(error)
    }
  })
  app.get('/api/assets/:id', (req, res, next) => {
    try {
      const asset = networkStore.listNetwork().assets.find((item) => item.id === req.params.id)
      if (!asset) return res.status(404).json({ error: 'Asset not found in the configured digital twin' })
      const readings = store.getAssetReadings(asset.id)
      res.json({
        asset,
        readings,
        alerts: store.computeActiveAlerts().filter((alert) => alert.assetId === asset.id),
        recommendations: store.computeRecommendations().filter((recommendation) => recommendation.assetId === asset.id),
        maintenance: maintenanceStore.listTasks().filter((task) => task.assetId === asset.id),
        status: store.getStatus(READING_STALE_MS),
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/assets', (req, res, next) => {
    try {
      res.status(201).json(networkStore.createAsset(req.body))
    } catch (error) {
      next(error)
    }
  })
  app.patch('/api/assets/:id', (req, res, next) => {
    try {
      res.json(networkStore.updateAsset(req.params.id, req.body))
    } catch (error) {
      next(error)
    }
  })
  app.delete('/api/assets/:id', (req, res, next) => {
    try {
      res.json(networkStore.removeAsset(req.params.id))
    } catch (error) {
      next(error)
    }
  })
  app.post('/api/connections', (req, res, next) => {
    try {
      res.status(201).json(networkStore.createConnection(req.body))
    } catch (error) {
      next(error)
    }
  })
  app.delete('/api/connections/:id', (req, res, next) => {
    try {
      res.json(networkStore.removeConnection(req.params.id))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/maintenance', (req, res, next) => {
    try {
      res.json(maintenanceStore.listTasks())
    } catch (error) {
      next(error)
    }
  })
  app.post('/api/maintenance', (req, res, next) => {
    try {
      res.status(201).json(maintenanceStore.createTask(req.body))
    } catch (error) {
      next(error)
    }
  })
  app.patch('/api/maintenance/:id', (req, res, next) => {
    try {
      res.json(maintenanceStore.updateTask(req.params.id, req.body))
    } catch (error) {
      next(error)
    }
  })
  app.delete('/api/maintenance/:id', (req, res, next) => {
    try {
      res.json(maintenanceStore.removeTask(req.params.id))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/assistant/status', (req, res) => res.json(getAssistantStatus()))
  app.post('/api/assistant', async (req, res) => {
    const now = Date.now()
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown'
    const recentRequests = (assistantRequests.get(clientKey) || []).filter((timestamp) => now - timestamp < 60000)
    if (recentRequests.length >= 8) {
      return res.status(429).json({ error: 'Assistant request limit reached. Try again in a minute.' })
    }

    const { message, messages, page, selectedAssetId } = req.body || {}
    const conversation = Array.isArray(messages)
      ? messages.slice(-10).filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.length <= 2000)
      : null
    const prompt = typeof message === 'string' ? message.trim() : conversation?.at(-1)?.content?.trim()
    if (!prompt || prompt.length > 2000) {
      return res.status(400).json({ error: 'Message must be between 1 and 2000 characters.' })
    }
    if (selectedAssetId !== undefined && (typeof selectedAssetId !== 'string' || selectedAssetId.length > 64)) {
      return res.status(400).json({ error: 'Invalid selected asset identifier.' })
    }
    if (page !== undefined && (typeof page !== 'string' || !['monitor-predict', 'digital-twin', 'maintenance'].includes(page))) {
      return res.status(400).json({ error: 'Invalid page context.' })
    }

    assistantRequests.set(clientKey, [...recentRequests, now])
    try {
      const result = await answerAssistant({
        message: prompt,
        messages: conversation,
        page: page || 'monitor-predict',
        selectedAssetId,
        staleAfterMs: READING_STALE_MS,
      })
      return res.json({ ...result, timestamp: Date.now(), source: store.getStatus(READING_STALE_MS) })
    } catch (error) {
      if (error.code === 'not_configured') {
        return res.status(503).json({ error: error.message, code: error.code })
      }
      if (error.status === 401) {
        return res.status(503).json({ error: 'The configured OpenAI API key was rejected. Check the backend configuration.' })
      }
      if (error.status === 429) {
        return res.status(429).json({ error: 'OpenAI rate limit reached. Please retry shortly.' })
      }
      console.error('[assistant] request failed:', error.message || error)
      return res.status(502).json({ error: 'The AI assistant could not reach OpenAI. Sensor monitoring remains available.' })
    }
  })

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400
    res.status(statusCode).json({ error: error.message || 'Request failed' })
  })

  store.setDataSource(DEMO_MODE ? 'demo' : 'arduino')
  if (DEMO_MODE) {
    createDemoSource().start()
    console.warn('[demo] DEMO_MODE is enabled; simulated readings are isolated from Arduino serial input')
  } else {
    const reader = createSerialReader({ portPath: SERIAL_PORT, baudRate: SERIAL_BAUD })
    reader.start().catch((err) => {
      console.error('[serial] start failed:', err?.message || err)
    })
  }

  app.listen(PORT, HOST, () => {
    console.log(`HydroNexus backend listening on http://${HOST}:${PORT}`)
    console.log(DEMO_MODE
      ? 'Data source: DEMO SIMULATION (Arduino serial disabled)'
      : `Serial config: ${SERIAL_PORT || 'not configured'} @ ${SERIAL_BAUD} baud`)
    console.log(`Reading stale after: ${READING_STALE_MS} ms`)
    console.log(`AI assistant: ${getAssistantStatus().configured ? 'configured' : 'not configured'}`)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err)
  })
}

main()
