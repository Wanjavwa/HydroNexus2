import { useCallback, useEffect, useMemo, useState } from 'react'
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../hooks/useWorkspace.js'
import { useSensorData } from '../hooks/useSensorData.js'
import { apiRequest } from '../utils/api.js'

const TYPE_LABELS = {
  source: 'Water source',
  reservoir: 'Reservoir',
  pump: 'Pump',
  valve: 'Valve',
  junction: 'Junction',
  sensor: 'Sensor',
  pipe: 'Pipe',
}
const NODE_WIDTH = 760
const NODE_HEIGHT = 440

function formatReading(value, unit = '') {
  return Number.isFinite(value) ? `${value} ${unit}`.trim() : 'Missing'
}

function createNode(asset, reading = null, stale = false) {
  const readingKey = JSON.stringify([
    asset.name,
    asset.type,
    reading?.flow ?? null,
    reading?.pH ?? null,
    reading?.pressure ?? null,
    reading?.pressureUnit || '',
    reading?.thicknessMm ?? null,
    stale,
  ])
  return {
    id: asset.id,
    type: 'default',
    position: { x: asset.x * NODE_WIDTH, y: asset.y * NODE_HEIGHT },
    data: {
      readingKey,
      label: (
        <div className="min-w-40 text-left">
          <p className="font-bold">{asset.name}</p>
          <p className="text-xs">{TYPE_LABELS[asset.type] || asset.type}</p>
          {reading ? (
            <p className="mt-1 text-xs">
              Flow {formatReading(reading.flow, 'mL/s')} · pH {formatReading(reading.pH)}
              <br />
              Pressure {formatReading(reading.pressure, reading.pressureUnit || '')}
              <br />
              Thickness {formatReading(reading.thicknessMm, 'mm')}
              {stale ? <><br /><span className="font-semibold text-amber-700">Stale reading</span></> : null}
            </p>
          ) : <p className="mt-1 text-xs">No readings for this asset</p>}
        </div>
      ),
    },
  }
}

function formatValue(value, unit = '') {
  return Number.isFinite(value) ? `${value} ${unit}`.trim() : 'Missing'
}

export default function DigitalTwinPage() {
  const [network, setNetwork] = useState({ assets: [], connections: [] })
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [assetDetails, setAssetDetails] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [searchParams] = useSearchParams()
  const { setSelectedAssetId } = useWorkspace()
  const { status, history, alerts, recommendations } = useSensorData()
  const [newAsset, setNewAsset] = useState({ id: '', name: '', type: 'pipe', sensorId: '' })
  const [editAsset, setEditAsset] = useState({ name: '', type: 'pipe', sensorId: '' })
  const [connection, setConnection] = useState({ source: '', target: '' })
  const selectedAssetId = selectedAsset?.id

  const readings = useMemo(() => {
    if (!selectedAsset) return []
    return history.filter((reading) => reading.assetId === selectedAsset.id).slice(-10).reverse()
  }, [history, selectedAsset])
  const latestReading = readings[0] || null
  const assetAlerts = useMemo(
    () => alerts.filter((alert) => alert.assetId === selectedAsset?.id),
    [alerts, selectedAsset],
  )
  const assetRecommendations = useMemo(
    () => recommendations.filter((recommendation) => recommendation.assetId === selectedAsset?.id),
    [recommendations, selectedAsset],
  )

  const loadNetwork = useCallback(async () => {
    setError(null)
    try {
      const networkData = await apiRequest('/api/network')
      const validNetwork = {
        assets: Array.isArray(networkData.assets) ? networkData.assets : [],
        connections: Array.isArray(networkData.connections) ? networkData.connections : [],
      }
      setNetwork(validNetwork)
      setNodes(validNetwork.assets.map(createNode))
      setEdges(validNetwork.connections.map((edge) => ({ ...edge, animated: true })))
      const requestedId = searchParams.get('asset')
      const requested = validNetwork.assets.find((asset) => asset.id === requestedId)
      setSelectedAsset((current) => requested || validNetwork.assets.find((asset) => asset.id === current?.id) || null)
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [searchParams, setEdges, setNodes])

  useEffect(() => {
    loadNetwork()
  }, [loadNetwork])

  useEffect(() => {
    const latestByAsset = new Map()
    for (const reading of history) {
      if (reading.assetId) latestByAsset.set(reading.assetId, reading)
    }
    setNodes((current) => current.map((node) => {
      const asset = network.assets.find((item) => item.id === node.id)
      if (!asset) return node
      const reading = latestByAsset.get(asset.id) || null
      const updatedNode = createNode(asset, reading, Boolean(status?.stale || !status?.connected))
      if (node.data.readingKey === updatedNode.data.readingKey) return node
      return {
        ...node,
        data: updatedNode.data,
      }
    }))
  }, [history, network.assets, setNodes, status?.connected, status?.stale])

  useEffect(() => {
    if (!selectedAsset) {
      setEditAsset({ name: '', type: 'pipe', sensorId: '' })
      setSelectedAssetId(null)
      return
    }
    setEditAsset({
      name: selectedAsset.name,
      type: selectedAsset.type,
      sensorId: selectedAsset.sensorId || '',
    })
    setSelectedAssetId(selectedAsset.id)
  }, [selectedAsset, setSelectedAssetId])

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetDetails(null)
      return undefined
    }
    let cancelled = false
    apiRequest(`/api/assets/${encodeURIComponent(selectedAssetId)}`)
      .then((details) => {
        if (!cancelled) setAssetDetails(details)
      })
      .catch((detailsError) => {
        if (!cancelled) setError(detailsError.message)
      })
    return () => {
      cancelled = true
    }
  }, [selectedAssetId])

  const handleNodeClick = useCallback((_, node) => {
    const asset = network.assets.find((item) => item.id === node.id)
    if (asset) setSelectedAsset(asset)
  }, [network.assets])

  const handleConnect = useCallback(async (params) => {
    if (!params.source || !params.target || params.source === params.target) return
    setSaving(true)
    setError(null)
    try {
      await apiRequest('/api/connections', {
        method: 'POST',
        body: JSON.stringify({ id: crypto.randomUUID(), source: params.source, target: params.target }),
      })
      await loadNetwork()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }, [loadNetwork])

  async function addAsset(event) {
    event.preventDefault()
    const base = newAsset.id.trim() || newAsset.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '')
    const id = base || `asset-${Date.now()}`
    setSaving(true)
    setError(null)
    try {
      const index = network.assets.length
      await apiRequest('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: newAsset.name,
          type: newAsset.type,
          sensorId: newAsset.sensorId || undefined,
          x: 0.12 + (index % 4) * 0.23,
          y: 0.2 + Math.floor(index / 4) * 0.42,
        }),
      })
      setNewAsset({ id: '', name: '', type: 'pipe', sensorId: '' })
      await loadNetwork()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveAsset(event) {
    event.preventDefault()
    if (!selectedAsset) return
    setSaving(true)
    setError(null)
    try {
      await apiRequest(`/api/assets/${encodeURIComponent(selectedAsset.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(editAsset),
      })
      await loadNetwork()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelectedAsset() {
    if (!selectedAsset || !confirm(`Remove ${selectedAsset.name} and its connected edges?`)) return
    setSaving(true)
    setError(null)
    try {
      await apiRequest(`/api/assets/${encodeURIComponent(selectedAsset.id)}`, { method: 'DELETE' })
      setSelectedAsset(null)
      await loadNetwork()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function addConnection(event) {
    event.preventDefault()
    if (!connection.source || !connection.target) return
    await handleConnect(connection)
    setConnection({ source: '', target: '' })
  }

  async function removeConnection(id) {
    setSaving(true)
    setError(null)
    try {
      await apiRequest(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await loadNetwork()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveNodePosition(node) {
    setSaving(true)
    setError(null)
    try {
      const asset = network.assets.find((item) => item.id === node.id)
      if (!asset) return
      const position = {
        x: Math.max(0, Math.min(1, node.position.x / NODE_WIDTH)),
        y: Math.max(0, Math.min(1, node.position.y / NODE_HEIGHT)),
      }
      const updated = await apiRequest(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(position),
      })
      setNetwork(updated)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Digital Twin</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-900">Water Network</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Construct and persist the installed network. No assets or connections are assumed.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${status?.connected && !status?.stale ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {status?.source === 'demo' ? 'DEMO SIMULATION' : status?.connected && !status?.stale ? 'Arduino connected' : 'Arduino offline or stale'}
        </span>
      </div>

      {error ? <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div> : null}
      {saving ? <p className="mt-3 text-sm text-slate-500">Saving network changes…</p> : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-[34rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {nodes.length === 0 ? (
            <div className="flex min-h-[34rem] flex-col items-center justify-center px-6 text-center">
              <p className="text-xl font-bold text-slate-900">No network configured</p>
              <p className="mt-2 max-w-md text-sm text-slate-600">Add the installed water-network components using the form. Connect the components only after confirming the physical topology.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodeDragStop={(_, node) => saveNodePosition(node)}
              onConnect={handleConnect}
              fitView
              nodesConnectable
              elementsSelectable
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          )}
        </div>

        <aside className="space-y-5">
          <form onSubmit={addAsset} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold text-slate-900">Add network component</h2>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Name
              <input required maxLength={120} value={newAsset.name} onChange={(event) => setNewAsset({ ...newAsset, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Asset ID
              <input maxLength={64} value={newAsset.id} onChange={(event) => setNewAsset({ ...newAsset, id: event.target.value })} placeholder="Generated from name if blank" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Component type
              <select value={newAsset.type} onChange={(event) => setNewAsset({ ...newAsset, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Sensor ID (if applicable)
              <input maxLength={64} value={newAsset.sensorId} onChange={(event) => setNewAsset({ ...newAsset, sensorId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50"><Plus size={16} /> Add component</button>
          </form>

          {selectedAsset ? (
            <form onSubmit={saveAsset} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-slate-900">Edit component</h2>
                <button type="button" onClick={deleteSelectedAsset} aria-label="Remove selected asset" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></button>
              </div>
              <p className="mt-1 text-xs text-slate-500">ID: {selectedAsset.id} (stable across pages)</p>
              <label className="mt-3 block text-sm font-semibold text-slate-700">Name
                <input required maxLength={120} value={editAsset.name} onChange={(event) => setEditAsset({ ...editAsset, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-700">Type
                <select value={editAsset.type} onChange={(event) => setEditAsset({ ...editAsset, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-700">Sensor ID
                <input maxLength={64} value={editAsset.sensorId} onChange={(event) => setEditAsset({ ...editAsset, sensorId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-800 disabled:opacity-50"><Save size={16} /> Save</button>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="font-bold text-slate-900">Selected asset readings</h3>
                {latestReading ? (
                  <>
                    <dl className="mt-2 space-y-1 text-sm text-slate-700">
                      <div className="flex justify-between gap-2"><dt>Flow</dt><dd>{formatValue(latestReading.flow, 'mL/s')}</dd></div>
                      <div className="flex justify-between gap-2"><dt>pH</dt><dd>{formatValue(latestReading.pH)}</dd></div>
                      <div className="flex justify-between gap-2"><dt>Pressure</dt><dd>{formatValue(latestReading.pressure, latestReading.pressureUnit || '')}</dd></div>
                      <div className="flex justify-between gap-2"><dt>Wall thickness</dt><dd>{formatValue(latestReading.thicknessMm, 'mm')}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-slate-500">Measurement time: {new Date(latestReading.timestamp).toLocaleString()}</p>
                    {Number.isFinite(latestReading.thicknessMm) ? (
                      <p className="mt-2 text-xs text-amber-800">Thickness value is the reported measurement only; no baseline or material data is configured to infer wall loss.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 flex items-start gap-2 text-sm text-amber-800"><AlertTriangle size={16} />No reading is associated with asset ID {selectedAsset.id}. Set `assetId` to this ID in the Arduino JSON message to associate readings.</p>
                )}
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="font-bold text-slate-900">Risk and maintenance evidence</h3>
                <p className="mt-2 text-sm text-slate-700">Future-failure prediction: unavailable (no validated model is configured).</p>
                {assetAlerts.length ? assetAlerts.map((alert, index) => (
                  <p key={`${alert.message}-${index}`} className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                    {alert.message} · {new Date(alert.timestamp).toLocaleString()}
                  </p>
                )) : <p className="mt-2 text-sm text-slate-500">No asset-specific anomaly is available.</p>}
                {assetRecommendations.length ? assetRecommendations.map((recommendation) => (
                  <p key={recommendation.issue} className="mt-2 rounded-lg bg-indigo-50 p-2 text-sm text-indigo-900">
                    {recommendation.issue}: {recommendation.reason}
                  </p>
                )) : null}
                <h4 className="mt-3 text-sm font-bold text-slate-800">Maintenance history</h4>
                {assetDetails?.maintenance?.length ? assetDetails.maintenance.map((task) => (
                  <p key={task.id} className="mt-1 text-sm text-slate-600">{task.title} · {task.status} · {task.assignedDate}</p>
                )) : <p className="mt-1 text-sm text-slate-500">No maintenance tasks are linked to this asset.</p>}
              </div>
            </form>
          ) : null}

          <form onSubmit={addConnection} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold text-slate-900">Connect components</h2>
            <label className="mt-3 block text-sm font-semibold text-slate-700">From
              <select required value={connection.source} onChange={(event) => setConnection({ ...connection, source: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option value="">Select component</option>
                {network.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.id})</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">To
              <select required value={connection.target} onChange={(event) => setConnection({ ...connection, target: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option value="">Select component</option>
                {network.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.id})</option>)}
              </select>
            </label>
            <button disabled={saving || network.assets.length < 2} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-800 disabled:opacity-50">Add connection</button>
            {edges.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {edges.map((edge) => (
                  <li key={edge.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="truncate">{network.assets.find((asset) => asset.id === edge.source)?.name} → {network.assets.find((asset) => asset.id === edge.target)?.name}</span>
                    <button type="button" aria-label="Remove connection" onClick={() => removeConnection(edge.id)} className="text-rose-700"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        </aside>
      </div>
    </section>
  )
}
