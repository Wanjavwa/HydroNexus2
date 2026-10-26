const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const DATA_FILE = path.join(__dirname, '..', 'data', 'network.json')
const ASSET_TYPES = new Set(['source', 'reservoir', 'pump', 'valve', 'junction', 'sensor', 'pipe'])

function readNetwork(filePath = DATA_FILE) {
  try {
    const network = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    validateNetwork(network)
    return network
  } catch (error) {
    if (error.code === 'ENOENT') return { assets: [], connections: [] }
    throw error
  }
}

function validateAsset(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error('Asset must be an object')
  if (typeof asset.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(asset.id)) {
    throw new Error('Asset id must be 1-64 letters, numbers, dots, underscores, colons, or hyphens')
  }
  if (typeof asset.name !== 'string' || !asset.name.trim() || asset.name.trim().length > 120) {
    throw new Error('Asset name must be 1-120 characters')
  }
  if (!ASSET_TYPES.has(asset.type)) throw new Error(`Unsupported asset type: ${asset.type}`)

  const validated = {
    id: asset.id,
    name: asset.name.trim(),
    type: asset.type,
    x: Number(asset.x),
    y: Number(asset.y),
  }
  if (!Number.isFinite(validated.x) || validated.x < 0 || validated.x > 1) throw new Error('Asset x must be between 0 and 1')
  if (!Number.isFinite(validated.y) || validated.y < 0 || validated.y > 1) throw new Error('Asset y must be between 0 and 1')
  if (typeof asset.description === 'string' && asset.description.trim()) validated.description = asset.description.trim().slice(0, 500)
  if (typeof asset.sensorId === 'string' && asset.sensorId.trim()) validated.sensorId = asset.sensorId.trim().slice(0, 64)
  return validated
}

function validateConnection(connection, assetIds) {
  if (!connection || typeof connection !== 'object' || Array.isArray(connection)) throw new Error('Connection must be an object')
  const id = connection.id || randomUUID()
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(id)) throw new Error('Invalid connection id')
  const { source, target } = connection
  if (typeof source !== 'string' || typeof target !== 'string' || source === target) {
    throw new Error('Connection must link two different assets')
  }
  if (!assetIds.has(source) || !assetIds.has(target)) throw new Error('Connection endpoints must refer to existing assets')
  return { id, source, target }
}

function validateNetwork(network) {
  if (!network || typeof network !== 'object' || Array.isArray(network)) throw new Error('Network must be an object')
  if (!Array.isArray(network.assets) || !Array.isArray(network.connections)) {
    throw new Error('Network must contain assets and connections arrays')
  }
  const assets = network.assets.map(validateAsset)
  const ids = new Set()
  for (const asset of assets) {
    if (ids.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`)
    ids.add(asset.id)
  }
  const connections = network.connections.map((connection) => validateConnection(connection, ids))
  const connectionIds = new Set()
  for (const connection of connections) {
    if (connectionIds.has(connection.id)) throw new Error(`Duplicate connection id: ${connection.id}`)
    connectionIds.add(connection.id)
  }
  return { assets, connections }
}

function writeNetwork(network, filePath = DATA_FILE) {
  const validated = validateNetwork(network)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(validated, null, 2), 'utf8')
  fs.renameSync(temporaryPath, filePath)
  return validated
}

function listNetwork() {
  return readNetwork()
}

function createAsset(asset) {
  const network = readNetwork()
  const validated = validateAsset(asset)
  if (network.assets.some((existing) => existing.id === validated.id)) throw new Error(`Asset already exists: ${validated.id}`)
  network.assets.push(validated)
  return writeNetwork(network)
}

function updateAsset(id, changes) {
  const network = readNetwork()
  const index = network.assets.findIndex((asset) => asset.id === id)
  if (index === -1) throw Object.assign(new Error(`Asset not found: ${id}`), { statusCode: 404 })
  network.assets[index] = validateAsset({ ...network.assets[index], ...changes, id })
  return writeNetwork(network)
}

function removeAsset(id) {
  const network = readNetwork()
  const assets = network.assets.filter((asset) => asset.id !== id)
  if (assets.length === network.assets.length) throw Object.assign(new Error(`Asset not found: ${id}`), { statusCode: 404 })
  return writeNetwork({
    assets,
    connections: network.connections.filter((connection) => connection.source !== id && connection.target !== id),
  })
}

function createConnection(connection) {
  const network = readNetwork()
  const validated = validateConnection(connection, new Set(network.assets.map((asset) => asset.id)))
  if (network.connections.some((existing) => existing.id === validated.id)) {
    throw new Error(`Connection already exists: ${validated.id}`)
  }
  network.connections.push(validated)
  return writeNetwork(network)
}

function removeConnection(id) {
  const network = readNetwork()
  const connections = network.connections.filter((connection) => connection.id !== id)
  if (connections.length === network.connections.length) throw Object.assign(new Error(`Connection not found: ${id}`), { statusCode: 404 })
  return writeNetwork({ assets: network.assets, connections })
}

module.exports = {
  listNetwork,
  createAsset,
  updateAsset,
  removeAsset,
  createConnection,
  removeConnection,
}
