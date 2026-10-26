const { SerialPort } = require('serialport')
const { createArduinoParser } = require('./arduinoParser')
const store = require('./store')

const DEFAULT_BAUD = 9600

function createSerialReader({
  portPath,
  baudRate = DEFAULT_BAUD,
  reconnectDelayMs = 2500,
} = {}) {
  const reader = {
    _port: null,
    _reconnectTimer: null,
    _running: false,
    start,
    stop,
  }

  function logPrefix() {
    return `[serial:${portPath || 'unconfigured'}]`
  }

  async function start() {
    if (reader._running) return
    reader._running = true

    const openPort = async () => {
      if (!reader._running) return

      if (!portPath) {
        const error = 'Missing portPath; set SERIAL_PORT to the connected Arduino port'
        store.setSerialStatus({ connected: false, error })
        console.error(`${logPrefix()} ${error}`)
        return
      }

      try {
        if (reader._reconnectTimer) {
          clearTimeout(reader._reconnectTimer)
          reader._reconnectTimer = null
        }

        const port = new SerialPort({ path: portPath, baudRate, autoOpen: false })
        reader._port = port
        const parser = createArduinoParser({
          onReading(reading, format) {
            if (!store.pushReading(reading)) {
              console.warn(`${logPrefix()} ignored ${format} without a valid flow, pH, or pressure reading`)
              return
            }
            console.log(`${logPrefix()} ${format}:`, reading)
          },
          onMalformed(message) {
            console.warn(`${logPrefix()} ${message}`)
          },
        })

        port.on('open', () => {
          store.setSerialStatus({ connected: true })
          console.log(`${logPrefix()} connected at ${baudRate} baud`)
        })

        port.on('data', (chunk) => parser.feed(chunk))
        port.on('close', () => {
          parser.finish()
          store.setSerialStatus({ connected: false, error: 'Serial port disconnected' })
          console.log(`${logPrefix()} disconnected`)
          scheduleReconnect()
        })
        port.on('error', (err) => {
          const message = err?.message || String(err)
          store.setSerialStatus({ connected: false, error: message })
          console.error(`${logPrefix()} error:`, message)
          scheduleReconnect()
        })

        await new Promise((resolve, reject) => {
          port.open((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      } catch (err) {
        const message = err?.message || String(err)
        store.setSerialStatus({ connected: false, error: message })
        console.error(`${logPrefix()} failed to open:`, message)
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (!reader._running || reader._reconnectTimer) return
      reader._reconnectTimer = setTimeout(() => {
        reader._reconnectTimer = null
        openPort()
      }, reconnectDelayMs)
    }

    await openPort()
  }

  function stop() {
    reader._running = false
    store.setSerialStatus({ connected: false, error: 'Serial reader stopped' })
    if (reader._reconnectTimer) clearTimeout(reader._reconnectTimer)
    reader._reconnectTimer = null

    if (reader._port && reader._port.isOpen) {
      reader._port.close((err) => {
        if (err) console.error(`${logPrefix()} failed to close:`, err.message || err)
      })
    }
  }

  return reader
}

module.exports = { createSerialReader }
