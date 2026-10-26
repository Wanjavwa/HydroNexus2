import { useMemo, useState } from 'react'
import { WorkspaceContext } from './workspaceContext.js'

export function WorkspaceProvider({ children }) {
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const value = useMemo(() => ({ selectedAssetId, setSelectedAssetId }), [selectedAssetId])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
