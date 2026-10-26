const MAX_BUFFER_LENGTH = 65536

function createArduinoParser({ onReading, onMalformed }) {
  let buffer = ''
  const frame = { flow: null, total: null, pH: null }

  function resetFrame() {
    frame.flow = null
    frame.total = null
    frame.pH = null
  }

  function flushFrame(force = false) {
    const hasMeasurement = frame.flow !== null || frame.pH !== null
    const hasFlowAndPH = frame.flow !== null && frame.pH !== null
    if (!hasMeasurement || (!force && !hasFlowAndPH)) return

    onReading({ ...frame }, 'text(frame)')
    resetFrame()
  }

  function parseTextLine(line) {
    let match = line.match(/Flow\s*\|\s*Rate:\s*([+-]?\d+(?:\.\d+)?)\s*mL\/s\s*\|\s*Total:\s*([+-]?\d+(?:\.\d+)?)\s*mL/i)
    if (!match) {
      match = line.match(/Flow\s*Sensor\s*1\s*\|\s*Flow\s*Rate:\s*([+-]?\d+(?:\.\d+)?)\s*mL\/s\s*\|\s*Total:\s*([+-]?\d+(?:\.\d+)?)\s*mL/i)
    }
    if (match) {
      if (frame.flow !== null) flushFrame(true)
      frame.flow = Number(match[1])
      frame.total = Number(match[2])
      flushFrame()
      return true
    }

    match = line.match(/pH\s*\|\s*Voltage:\s*([+-]?\d+(?:\.\d+)?)\s*V\s*\|\s*pH:\s*([+-]?\d+(?:\.\d+)?)/i)
    if (!match) {
      match = line.match(/pH\s*Probe\s*\|\s*Voltage:\s*([+-]?\d+(?:\.\d+)?)\s*V\s*\|\s*pH:\s*([+-]?\d+(?:\.\d+)?)/i)
    }
    if (match) {
      if (frame.pH !== null) flushFrame(true)
      frame.pH = Number(match[2])
      flushFrame()
      return true
    }

    if (/^\s*-{5,}\s*$/.test(line)) {
      flushFrame(true)
      return true
    }

    return false
  }

  function parseJson(message) {
    let parsed
    try {
      parsed = JSON.parse(message)
    } catch {
      return false
    }

    flushFrame(true)
    onReading(parsed, 'json')
    return true
  }

  function processLine(line) {
    if (!line) return
    if (parseJson(line) || parseTextLine(line)) return
    onMalformed(`ignored malformed or unsupported message: ${line}`)
  }

  function feed(chunk) {
    buffer += chunk.toString('utf8')
    if (buffer.length > MAX_BUFFER_LENGTH) {
      onMalformed('discarded oversized incomplete serial message')
      buffer = ''
      resetFrame()
      return
    }

    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      processLine(line)
    }

    let startIndex = buffer.indexOf('{')
    while (startIndex !== -1) {
      let depth = 0
      let endIndex = -1
      for (let index = startIndex; index < buffer.length; index++) {
        if (buffer[index] === '{') depth++
        if (buffer[index] === '}') depth--
        if (depth === 0) {
          endIndex = index
          break
        }
      }
      if (endIndex === -1) break

      const candidate = buffer.slice(startIndex, endIndex + 1)
      buffer = buffer.slice(endIndex + 1)
      startIndex = buffer.indexOf('{')
      if (!parseJson(candidate)) onMalformed('ignored malformed JSON serial message')
    }
  }

  return {
    feed,
    finish() {
      if (buffer.trim()) processLine(buffer.trim())
      buffer = ''
      flushFrame(true)
    },
  }
}

module.exports = { createArduinoParser }
