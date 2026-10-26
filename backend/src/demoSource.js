const store = require('./store')

function createDemoSource({ intervalMs = 1000 } = {}) {
  let timer = null
  let previousTimestamp = null
  let total = 0

  function publishReading() {
    const timestamp = Date.now()
    const phase = timestamp / 1000
    const flow = Math.round((40 + Math.sin(phase / 12) * 2) * 100) / 100
    if (previousTimestamp !== null) total += flow * Math.max(0, (timestamp - previousTimestamp) / 1000)
    previousTimestamp = timestamp

    store.pushReading({
      flow,
      total: Math.round(total * 100) / 100,
      pH: Math.round((7.1 + Math.sin(phase / 25) * 0.08) * 100) / 100,
      pressure: Math.round((220 + Math.sin(phase / 17) * 3) * 100) / 100,
      pressureUnit: 'kPa',
      timestamp,
      assetId: 'demo-asset',
      sensorIds: {
        flow: 'demo-flow-sensor',
        pH: 'demo-ph-sensor',
        pressure: 'demo-pressure-sensor',
      },
    })
  }

  return {
    start() {
      if (timer) return
      publishReading()
      timer = setInterval(publishReading, intervalMs)
      timer.unref()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

module.exports = { createDemoSource }
