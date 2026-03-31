import { useContext } from 'react'
import { SensorDataContext } from '../context/SensorDataContext.jsx'

export function useSensorData() {
  const ctx = useContext(SensorDataContext)
  if (!ctx) {
    throw new Error('useSensorData must be used within a SensorDataProvider')
  }
  return ctx
}

