import { useState, useRef, useEffect } from 'react'
import { Hammer, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { PatchItem } from './useDevStudio'
import { useDevStudio } from './useDevStudio'
import {
  clearChatStorage,
  loadChatMessages,
  loadChatSettings,
  saveChatMessages,
  type DevStudioChatSettings,
} from './chat-storage'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface DebugTrigger {
  id?: number
  buildLog?: string
  healthError?: string
  prompt: string
}

interface Props {
  activePath: string | null
  chatSettings?: DevStudioChatSettings
  debugTrigger?: DebugTrigger | null
  onPatches: (
    patches: PatchItem[],
    migration: { filename: string; sql: string } | null,
    meta?: { phase?: string },
  ) => void
  onPrompt?: (prompt: string) => void
}

const PHASE_LABEL: Record<string, string> = {
  investigating: 'Investigating…',
  proposing: 'Proposing patches…',
  ready: 'Patches ready',
  advisory_only: 'Needs propose_patch',
}

export function AgentChat({ activePath, chatSettings, debugTrigger, onPatches, onPrompt }: Props) {
  const { chatStream, debugStream } = useDevStudio()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [toolLog, setToolLog] = useState<string[]>([])
  const [agentPhase, setAgentPhase] = useState<string | null>(null)
  const [lastPhase, setLastPhase] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef(chatSettings ?? loadChatSettings())
  const hydratedRef = useRef(false)
  const lastDebugIdRef = useRef<number | null>(null)

  useEffect(() => {
    settingsRef.current = chatSettings ?? loadChatSettings()
  }, [chatSettings])

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const s = loadChatSettings()
    if (s.persistChat) setMessages(loadChatMessages())
  }, [])

  useEffect(() => {
    const s = settingsRef.current
    if (!s.persistChat) return
    if (messages.length) saveChatMessages(messages)
    else clearChatStorage()
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolLog])

  const clearChat = () => {
    setMessages([])
    setToolLog([])
    clearChatStorage()
    toast.success('Chat history cleared')
  }

  const runStream = async (
    streamFn: AsyncGenerator<{ type: string; content?: string; tool?: string; result?: string; patches?: PatchItem[]; migration?: { filename: string; sql: string } | null }>,
    userLabel: string,
  ) => {
    setMessages(m => [...m, { role: 'user', content: userLabel }])
    setStreaming(true)
    setToolLog([])
    let assistant = ''
    let pendingPatches: PatchItem[] = []
    let pendingMigration: { filename: string; sql: string } | null = null
    let endPhase: string | undefined
    setAgentPhase('investigating')
    try {
      for await (const ev of streamFn) {
        if (ev.type === 'phase' && (ev as { phase?: string }).phase) {
          const p = (ev as unknown as { phase: string }).phase
          setAgentPhase(p)
          endPhase = p
        }
        if (ev.type === 'token' && ev.content) {
          assistant += ev.content
          setMessages(m => {
            const copy = [...m]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: assistant }
            } else {
              copy.push({ role: 'assistant', content: assistant })
            }
            return copy
          })
        }
        if (ev.type === 'tool_start') {
          const args = ev.content ? ` ${ev.content.slice(0, 80)}` : ''
          setToolLog(l => [...l, `→ ${ev.tool}${args}`])
        }
        if (ev.type === 'tool_result' && ev.result) {
          const result = ev.result
          const preview = result.replace(/\s+/g, ' ').slice(0, 120)
          setToolLog(l => [...l, `  ✓ ${ev.tool}: ${preview}${result.length > 120 ? '…' : ''}`])
        }
        if (ev.type === 'patches' && ev.patches) pendingPatches = ev.patches
        if (ev.type === 'migration') pendingMigration = ev.migration || null
        if (ev.type === 'done') {
          setLastPhase(endPhase || null)
          setAgentPhase(null)
          onPatches(pendingPatches, pendingMigration, { phase: endPhase })
          if (pendingPatches.length) {
            toast.success(`${pendingPatches.length} patch(es) staged — use Ship panel below`)
          } else if (endPhase === 'advisory_only') {
            toast.warning('Agent gave advice only. Click Build it to force propose_patch.')
          }
        }
        if (ev.type === 'error') setToolLog(l => [...l, `Error: ${ev.content}`])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setStreaming(false)
      setAgentPhase(null)
    }
  }

  const buildIt = async () => {
    const prompt = 'Use propose_patch now. Read the relevant files with read_file, then stage full file content for each change. Express+SQLite only — no Mongoose.'
    setInput('')
    onPrompt?.(prompt)
    const settings = settingsRef.current
    const history = settings.historyLimit > 0 ? messages.slice(-settings.historyLimit) : []
    await runStream(
      chatStream(prompt, activePath || undefined, history, settings.historyLimit),
      prompt,
    )
  }

  useEffect(() => {
    if (!debugTrigger?.id || debugTrigger.id === lastDebugIdRef.current) return
    lastDebugIdRef.current = debugTrigger.id
    const settings = settingsRef.current
    const history = settings.historyLimit > 0 ? messages.slice(-settings.historyLimit) : []
    runStream(
      debugStream({
        prompt: debugTrigger.prompt,
        buildLog: debugTrigger.buildLog,
        healthError: debugTrigger.healthError,
        activePath: activePath || undefined,
        history,
        historyLimit: settings.historyLimit,
      }),
      `[Fix/Debug] ${debugTrigger.prompt}`,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugTrigger?.id])

  const send = async () => {
    const prompt = input.trim()
    if (!prompt || streaming) return
    setInput('')
    onPrompt?.(prompt)
    const settings = settingsRef.current
    const history = settings.historyLimit > 0 ? messages.slice(-settings.historyLimit) : []
    try {
      await runStream(
        chatStream(prompt, activePath || undefined, history, settings.historyLimit),
        prompt,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('model') || msg.includes('Ollama')) {
        toast.error(msg, { description: 'Settings → Create StrikeScope model or pull qwen2.5-coder:7b' })
      }
    }
  }

  return (
    <div className="flex h-full flex-col border-l">
      <div className="border-b px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium">Agent</span>
          {(agentPhase || lastPhase === 'advisory_only') && (
            <p className="text-[10px] text-amber-600">
              {agentPhase ? PHASE_LABEL[agentPhase] || agentPhase : PHASE_LABEL.advisory_only}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {lastPhase === 'advisory_only' && !streaming && (
            <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={buildIt}>
              <Hammer className="h-3 w-3 mr-1" /> Build it
            </Button>
          )}
          {messages.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{messages.length} msgs</span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Clear chat history"
            onClick={clearChat}
            disabled={streaming || messages.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Ask the agent to fix code, add features, or inspect SQL. Use Settings to control history and create the StrikeScope model.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <span className={`inline-block rounded px-2 py-1 max-w-[95%] text-left whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {m.content}
            </span>
          </div>
        ))}
        {toolLog.map((t, i) => (
          <p key={`t${i}`} className="text-xs text-muted-foreground font-mono">{t}</p>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t p-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe a fix or feature…"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={streaming}
        />
        <Button size="icon" onClick={send} disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
