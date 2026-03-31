const { SerialPort } = require('serialport')
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
    return `[serial:${portPath}]`
  }

  async function start() {
    if (reader._running) return
    reader._running = true

    const openPort = async () => {
      if (!reader._running) return

      try {
        if (reader._reconnectTimer) {
          clearTimeout(reader._reconnectTimer)
          reader._reconnectTimer = null
        }

        if (!portPath) throw new Error('Missing portPath (set SERIAL_PORT, e.g. COM3)')

        const port = new SerialPort({
          path: portPath,
          baudRate,
          autoOpen: false,
        })

        reader._port = port

        port.on('open', () => {
          console.log(`${logPrefix()} connected at ${baudRate} baud`)
        })

        port.on('close', () => {
          console.log(`${logPrefix()} disconnected`)
          scheduleReconnect()
        })

        port.on('error', (err) => {
          console.log(`${logPrefix()} error:`, err?.message || err)
          // Do not crash; reconnect on errors.
          scheduleReconnect()
        })

        // Temp buffer for the "text log" format:
        // Flow | Rate: XX mL/s | Total: XX mL
        // pH | Voltage: X.XX V | pH: X.XX
        // ----------------------------
        const frame = {
          flow: undefined,
          total: undefined,
          pH: undefined,
        }

        const resetFrame = () => {
          frame.flow = undefined
          frame.total = undefined
          frame.pH = undefined
        }

        const tryFlushFrame = () => {
          const isFin = (v) => Number.isFinite(v)
          if (isFin(frame.flow) && isFin(frame.total) && isFin(frame.pH)) {
            const accepted = store.pushReading({
              flow: frame.flow,
              total: frame.total,
              pH: frame.pH,
            })
            if (accepted) console.log(`${logPrefix()} text(frame):`, frame)
            resetFrame()
            return accepted
          }
          return false
        }

        const parseArduinoTextLine = (line) => {
          let m = null

          // New text format:
          //   Flow | Rate: XX mL/s | Total: XX mL
          m = line.match(/Flow\s*\|\s*Rate:\s*([+-]?\d+(?:\.\d+)?)\s*mL\/s\s*\|\s*Total:\s*([+-]?\d+(?:\.\d+)?)\s*mL/i)
          if (m) {
            frame.flow = Number(m[1])
            frame.total = Number(m[2])
            tryFlushFrame()
            return
          }

          // Legacy format:
          //   Flow Sensor 1 | Flow Rate: XX mL/s | Total: XX mL
          m = line.match(/Flow\s*Sensor\s*1\s*\|\s*Flow\s*Rate:\s*([+-]?\d+(?:\.\d+)?)\s*mL\/s\s*\|\s*Total:\s*([+-]?\d+(?:\.\d+)?)\s*mL/i)
          if (m) {
            frame.flow = Number(m[1])
            frame.total = Number(m[2])
            tryFlushFrame()
            return
          }

          // New pH format:
          //   pH | Voltage: X.XX V | pH: X.XX
          m = line.match(/pH\s*\|\s*Voltage:\s*([+-]?\d+(?:\.\d+)?)\s*V\s*\|\s*pH:\s*([+-]?\d+(?:\.\d+)?)/i)
          if (m) {
            frame.pH = Number(m[2])
            tryFlushFrame()
            return
          }

          // Legacy pH format:
          //   pH Probe | Voltage: X.XX V | pH: X.XX
          m = line.match(/pH\s*Probe\s*\|\s*Voltage:\s*([+-]?\d+(?:\.\d+)?)\s*V\s*\|\s*pH:\s*([+-]?\d+(?:\.\d+)?)/i)
          if (m) {
            frame.pH = Number(m[2])
            tryFlushFrame()
            return
          }

          // Frame separator
          if (/^\s*-{5,}\s*$/.test(line)) {
            tryFlushFrame()
          }
        }

        let buffer = ''
        port.on('data', (chunk) => {
          buffer += chunk.toString('utf8')

          // 1) Prefer line-delimited JSON (Serial.println style).
          let idx = 0
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 1)
            if (!line) continue

            try {
              const parsed = JSON.parse(line)
              const accepted = store.pushReading(parsed)
              if (accepted) console.log(`${logPrefix()} json:`, parsed)
            } catch {
              // If it isn't JSON, try parsing your Arduino text format.
              parseArduinoTextLine(line)
            }
          }

          // 2) Fallback: parse JSON by balanced braces (works even without '\n').
          // This helps if Arduino prints JSON without newline delimiters.
          let start = buffer.indexOf('{')
          while (start !== -1) {
            let depth = 0
            let end = -1

            for (let i = start; i < buffer.length; i++) {
              const ch = buffer[i]
              if (ch === '{') depth++
              if (ch === '}') depth--
              if (depth === 0) {
                end = i
                break
              }
            }

            if (end === -1) break // need more data

            const candidate = buffer.slice(start, end + 1)
            buffer = buffer.slice(end + 1)
            start = buffer.indexOf('{')

            try {
              const parsed = JSON.parse(candidate)
              const accepted = store.pushReading(parsed)
              if (accepted) console.log(`${logPrefix()} json(frame):`, parsed)
            } catch {
              // If it isn't valid JSON, skip it and continue.
            }
          }
        })

        await new Promise((resolve, reject) => {
          port.open((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      } catch (err) {
        console.log(`${logPrefix()} failed to open:`, err?.message || err)
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (!reader._running) return
      if (reader._reconnectTimer) return

      reader._reconnectTimer = setTimeout(() => {
        reader._reconnectTimer = null
        openPort()
      }, reconnectDelayMs)
    }

    await openPort()
  }

  function stop() {
    reader._running = false
    if (reader._reconnectTimer) clearTimeout(reader._reconnectTimer)
    reader._reconnectTimer = null

    try {
      if (reader._port && reader._port.isOpen) reader._port.close()
    } catch {
      // ignore
    }
  }

  return reader
}

module.exports = { createSerialReader }

