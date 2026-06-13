import { useEffect, useState } from 'react'
import {
  DEFAULT_CHAT_SETTINGS,
  loadChatSettings,
  saveChatSettings,
  type DevStudioChatSettings,
} from './chat-storage'

interface Props {
  contextWindow?: number
  onChange?: (settings: DevStudioChatSettings) => void
}

export function ChatSettings({ contextWindow, onChange }: Props) {
  const [settings, setSettings] = useState<DevStudioChatSettings>(DEFAULT_CHAT_SETTINGS)

  useEffect(() => {
    const loaded = loadChatSettings()
    setSettings(loaded)
    onChange?.(loaded)
  }, [onChange])

  const update = (patch: Partial<DevStudioChatSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveChatSettings(next)
    onChange?.(next)
  }

  return (
    <div className="space-y-3 text-sm border-t pt-3">
      <p className="font-medium">Chat &amp; context</p>
      <p className="text-muted-foreground text-xs">
        Context window: <span className="font-mono">{contextWindow ?? 16384}</span> tokens (set via StrikeScope model).
        Lower history when the agent loses track of the task.
      </p>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span>History turns sent to agent</span>
        <select
          className="rounded border px-2 py-1 bg-background"
          value={settings.historyLimit}
          onChange={e => update({ historyLimit: Number(e.target.value) })}
        >
          <option value={0}>0 — fresh each message</option>
          <option value={2}>2</option>
          <option value={4}>4 (default)</option>
          <option value={6}>6</option>
          <option value={8}>8</option>
          <option value={12}>12</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={settings.persistChat}
          onChange={e => update({ persistChat: e.target.checked })}
        />
        Remember chat across page reloads
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={settings.autoContinueBuild}
          onChange={e => update({ autoContinueBuild: e.target.checked })}
        />
        Auto Continue Build when agent stages patches
      </label>
    </div>
  )
}
