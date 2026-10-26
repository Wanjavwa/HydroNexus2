const OpenAI = require('openai')
const store = require('./store')
const networkStore = require('./networkStore')
const maintenanceStore = require('./maintenanceStore')

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 4
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_measurements',
      description: 'Fetch the latest validated Arduino readings and connection freshness.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_history',
      description: 'Fetch actual recent sensor history, optionally for one configured asset.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 60 },
          assetId: { type: 'string', minLength: 1, maxLength: 64 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_network_assets',
      description: 'List configured water-network assets and connections. The network may be empty.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_anomalies',
      description: 'Fetch current backend-detected anomalies and their evidence timestamp.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_maintenance_recommendations',
      description: 'Fetch recommendations calculated by HydroNexus from available readings and anomalies.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_asset_details',
      description: 'Fetch one configured asset and its associated readings, alerts, and maintenance tasks.',
      parameters: {
        type: 'object',
        properties: { assetId: { type: 'string', minLength: 1, maxLength: 64 } },
        required: ['assetId'],
        additionalProperties: false,
      },
    },
  },
]

function getAssistantStatus() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    provider: 'OpenAI',
  }
}

function validateToolArguments(name, rawArguments) {
  let args
  try {
    args = JSON.parse(rawArguments || '{}')
  } catch {
    throw new Error('Assistant requested invalid tool arguments')
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Assistant tool arguments must be an object')

  const allowed = {
    get_current_measurements: [],
    get_recent_history: ['limit', 'assetId'],
    get_network_assets: [],
    get_active_anomalies: [],
    get_maintenance_recommendations: [],
    get_asset_details: ['assetId'],
  }[name]
  if (!allowed || Object.keys(args).some((key) => !allowed.includes(key))) throw new Error('Assistant requested an unsupported tool')
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 60)) {
    throw new Error('History limit must be an integer between 1 and 60')
  }
  for (const key of ['assetId']) {
    if (args[key] !== undefined && (typeof args[key] !== 'string' || args[key].length < 1 || args[key].length > 64)) {
      throw new Error('Asset id must be between 1 and 64 characters')
    }
  }
  if (name === 'get_asset_details' && typeof args.assetId !== 'string') throw new Error('Asset id is required')
  return args
}

function executeTool(name, args, staleAfterMs) {
  if (name === 'get_current_measurements') {
    return { status: store.getStatus(staleAfterMs), latest: store.getLatest() }
  }
  if (name === 'get_recent_history') {
    if (args.assetId && !networkStore.listNetwork().assets.some((asset) => asset.id === args.assetId)) {
      throw new Error('Asset is not configured in the digital twin')
    }
    const history = args.assetId
      ? store.getAssetReadings(args.assetId, args.limit || 60)
      : store.getHistory().slice(-(args.limit || 60))
    return { status: store.getStatus(staleAfterMs), history }
  }
  if (name === 'get_network_assets') {
    return networkStore.listNetwork()
  }
  if (name === 'get_active_anomalies') {
    return { status: store.getStatus(staleAfterMs), alerts: store.computeActiveAlerts() }
  }
  if (name === 'get_maintenance_recommendations') {
    return { status: store.getStatus(staleAfterMs), recommendations: store.computeRecommendations() }
  }
  if (name === 'get_asset_details') {
    const asset = networkStore.listNetwork().assets.find((item) => item.id === args.assetId)
    if (!asset) throw new Error('Asset is not configured in the digital twin')
    return {
      asset,
      status: store.getStatus(staleAfterMs),
      readings: store.getAssetReadings(asset.id),
      alerts: store.computeActiveAlerts().filter((alert) => alert.assetId === asset.id),
      recommendations: store.computeRecommendations().filter((recommendation) => recommendation.assetId === asset.id),
      maintenance: maintenanceStore.listTasks().filter((task) => task.assetId === asset.id),
    }
  }
  throw new Error('Assistant requested an unsupported tool')
}

async function answerAssistant({ message, messages: conversationMessages, page, selectedAssetId, staleAfterMs = 10000 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('AI assistant is not configured. Set OPENAI_API_KEY in the backend environment.'), { statusCode: 503, code: 'not_configured' })
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let selectedAssetContext = 'No asset is selected.'
  if (selectedAssetId) {
    const selectedAsset = networkStore.listNetwork().assets.find((asset) => asset.id === selectedAssetId)
    selectedAssetContext = selectedAsset
      ? `Selected digital-twin asset: ${JSON.stringify(selectedAsset)}`
      : 'The selected asset id is not in the configured network.'
  }
  const chatMessages = [
    {
      role: 'system',
      content: [
        'You are HydroNexus assistant. You explain readings, detected anomalies, available maintenance recommendations, and application navigation.',
        'For any question about measurements, asset conditions, trends, anomalies, recommendations, or maintenance, call the relevant read-only HydroNexus tools before answering.',
        'Use only tool results as evidence for current sensor values and configured assets. Never invent measurements, assets, network topology, or predictions.',
        'HydroNexus currently has anomaly rules, not a validated future-failure prediction model. Do not give failure probabilities, dates, or claim future failure prediction.',
        'If thickness data exists, explain that ultrasonic thickness requires asset-specific material, baseline, calibration, and inspection conditions to infer wall loss; a value alone does not confirm deterioration.',
        'If data is missing, stale, simulated, or the asset is unconfigured, state that clearly and ask for measurements or a physical inspection where appropriate.',
        'Include the source and timestamp of sensor evidence in answers that use readings, and warn if the data is stale or simulated.',
        `Current application page: ${page}.`,
        selectedAssetContext,
      ].join(' '),
    },
    ...(Array.isArray(conversationMessages)
      ? conversationMessages.filter((item) => ['user', 'assistant'].includes(item.role)).map((item) => ({ role: item.role, content: item.content }))
      : [{ role: 'user', content: message }]),
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      messages: chatMessages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    })
    const assistantMessage = response.choices[0]?.message
    if (!assistantMessage) throw new Error('OpenAI returned an empty response')
    chatMessages.push(assistantMessage)
    if (!assistantMessage.tool_calls?.length) {
      return { answer: assistantMessage.content || 'I could not produce an answer from the available data.', model: response.model }
    }
    if (assistantMessage.tool_calls.length > 6) throw new Error('Assistant requested too many backend tools')

    for (const call of assistantMessage.tool_calls) {
      if (call.type !== 'function') throw new Error('Assistant requested an unsupported tool type')
      const args = validateToolArguments(call.function.name, call.function.arguments)
      const result = executeTool(call.function.name, args, staleAfterMs)
      chatMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })
    }
  }
  throw new Error('Assistant reached the maximum number of data lookups')
}

module.exports = { answerAssistant, getAssistantStatus }
