const assert = require('node:assert/strict')
const test = require('node:test')
const { createArduinoParser } = require('./arduinoParser')
const store = require('./store')

test('parses current Arduino text frames into backend readings', () => {
  const parser = createArduinoParser({
    onReading: (reading) => store.pushReading(reading),
    onMalformed: (message) => assert.fail(message),
  })

  parser.feed(Buffer.from('Flow | Rate: 12.34 mL/s | Total: 1234.00 mL\r\n'))
  parser.feed(Buffer.from('pH | Voltage: 2.50 V | pH: 7.10\r\n'))

  assert.equal(store.getLatest().flow, 12.34)
  assert.equal(store.getLatest().total, 1234)
  assert.equal(store.getLatest().pH, 7.1)
  assert.equal(store.getLatest().pressure, null)
})

test('preserves optional JSON pressure, timestamp, and identifiers', () => {
  const now = Date.now()
  const parser = createArduinoParser({
    onReading: (reading) => store.pushReading(reading),
    onMalformed: (message) => assert.fail(message),
  })
  const payload = JSON.stringify({
    flow: 18.75,
    pH: 7.2,
    pressure: 42.5,
    pressureUnit: 'kPa',
    timestamp: now,
    assetId: 'main-supply',
    sensorIds: { flow: 'flow-1', pH: 'ph-1', pressure: 'pressure-1' },
  })

  parser.feed(Buffer.from(payload.slice(0, 28)))
  parser.feed(Buffer.from(payload.slice(28)))

  assert.deepEqual(store.getLatest(), {
    flow: 18.75,
    total: null,
    pH: 7.2,
    pressure: 42.5,
    thicknessMm: null,
    timestamp: now,
    assetId: 'main-supply',
    sensorIds: { flow: 'flow-1', pH: 'ph-1', pressure: 'pressure-1' },
    pressureUnit: 'kPa',
  })
})

test('accepts ultrasonic thickness as a standalone sensor reading', () => {
  const parser = createArduinoParser({
    onReading: (reading) => store.pushReading(reading),
    onMalformed: (message) => assert.fail(message),
  })

  parser.feed(Buffer.from('{"thicknessMm":8.75,"assetId":"main-pipe","sensorId":"ut-1"}\n'))

  assert.equal(store.getLatest().thicknessMm, 8.75)
  assert.equal(store.getLatest().assetId, 'main-pipe')
  assert.equal(store.getLatest().sensorId, 'ut-1')
})

test('retains an available partial text reading when another sensor is absent', () => {
  const parser = createArduinoParser({
    onReading: (reading) => store.pushReading(reading),
    onMalformed: (message) => assert.fail(message),
  })

  parser.feed(Buffer.from('Flow Sensor 1 | Flow Rate: 9.5 mL/s | Total: 55 mL\r\n-----\r\n'))

  assert.equal(store.getLatest().flow, 9.5)
  assert.equal(store.getLatest().pH, null)
})

test('ignores malformed messages without replacing the last valid reading', () => {
  const before = store.getLatest()
  const malformed = []
  const parser = createArduinoParser({
    onReading: (reading) => {
      if (!store.pushReading(reading)) malformed.push('invalid reading')
    },
    onMalformed: (message) => malformed.push(message),
  })

  parser.feed(Buffer.from('{"flow":"not-a-number"}\nnot an Arduino message\n'))

  assert.equal(store.getLatest(), before)
  assert.equal(malformed.length, 2)
})

test('marks disconnected and old readings offline or stale', () => {
  store.pushReading({ pH: 7, timestamp: Date.now() - 5000 })
  store.setSerialStatus({ connected: true })
  assert.equal(store.getStatus(1000).stale, true)

  store.setSerialStatus({ connected: false, error: 'port closed' })
  const status = store.getStatus(1000)
  assert.equal(status.connected, false)
  assert.equal(status.stale, true)
  assert.equal(status.error, 'port closed')
})

test('demo mode is identified as a separate data source', async () => {
  const { createDemoSource } = require('./demoSource')
  store.setDataSource('demo')
  const demo = createDemoSource({ intervalMs: 60000 })
  demo.start()

  const status = store.getStatus(10000)
  assert.equal(status.source, 'demo')
  assert.equal(status.demoMode, true)
  assert.equal(status.connected, true)
  assert.equal(store.getLatest().assetId, 'demo-asset')

  demo.stop()
  store.setDataSource('arduino')
  store.setSerialStatus({ connected: false })
})
