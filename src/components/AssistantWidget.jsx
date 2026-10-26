import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useWorkspace } from '../hooks/useWorkspace.js'
import { apiRequest } from '../utils/api.js'

function pageContext(pathname) {
  if (pathname.startsWith('/digital-twin')) return 'digital-twin'
  if (pathname.startsWith('/maintenance')) return 'maintenance'
  return 'monitor-predict'
}

export default function AssistantWidget() {
  const location = useLocation()
  const { selectedAssetId } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/assistant/status')
      .then((status) => {
        if (!cancelled) setConfigured(Boolean(status.configured))
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const contextName = useMemo(() => pageContext(location.pathname), [location.pathname])

  async function sendMessage(event) {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || loading || !configured) return

    const conversation = [...messages, { role: 'user', content: prompt }]
    setMessages(conversation)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const result = await apiRequest('/api/assistant', {
        method: 'POST',
        body: JSON.stringify({
          messages: conversation.slice(-10),
          page: contextName,
          selectedAssetId,
        }),
      })
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.answer,
          timestamp: result.timestamp,
          source: result.source,
        },
      ])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {open ? (
        <section
          aria-label="HydroNexus AI assistant"
          className="mb-3 flex h-[min(72vh,38rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-indigo-700 px-4 py-3 text-white">
            <div>
              <p className="font-bold">HydroNexus Assistant</p>
              <p className="text-xs text-indigo-100">{configured ? 'OpenAI · backend data tools' : 'AI setup required'}</p>
            </div>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-indigo-600">
              <X size={18} />
            </button>
          </header>

          {!configured ? (
            <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">AI is not configured</p>
              <p className="mt-2">Add an OpenAI API key to the backend environment variable `OPENAI_API_KEY`, then restart the backend. The key must not be added to frontend settings or source code.</p>
              <a className="mt-2 inline-block font-semibold underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                OpenAI API keys
              </a>
              <p className="mt-2 text-xs">Sensor monitoring and other pages continue to work without AI.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Ask about actual sensor readings, detected anomalies, maintenance, or how to use HydroNexus. Answers use backend data and its timestamps.
                  </p>
                ) : null}
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`max-w-[92%] whitespace-pre-wrap rounded-xl p-3 text-sm ${message.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p>{message.content}</p>
                    {message.role === 'assistant' && message.timestamp ? (
                      <p className="mt-2 border-t border-slate-300/70 pt-2 text-[11px] text-slate-600">
                        Answered {new Date(message.timestamp).toLocaleString()}
                        {message.source?.stale ? ' · Sensor data is stale' : ''}
                        {message.source?.source === 'demo' ? ' · DEMO SIMULATION data' : ''}
                      </p>
                    ) : null}
                  </div>
                ))}
                {loading ? <p className="text-sm text-slate-500">Checking HydroNexus data…</p> : null}
                <div ref={scrollRef} />
              </div>
              {error ? <p role="alert" className="mx-4 mb-2 text-sm font-semibold text-rose-700">{error}</p> : null}
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 p-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={2000}
                  placeholder="Ask about your readings…"
                  aria-label="Message the assistant"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button type="submit" aria-label="Send message" disabled={!input.trim() || loading} className="rounded-lg bg-indigo-700 px-3 text-white disabled:opacity-50">
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}
      <button
        type="button"
        aria-label={open ? 'Close HydroNexus assistant' : 'Open HydroNexus assistant'}
        onClick={() => setOpen((current) => !current)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-lg transition hover:bg-indigo-800"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>
    </div>
  )
}
