export const CHAT_STORAGE_KEY = 'strikescope-dev-studio-chat'
export const CHAT_SETTINGS_KEY = 'strikescope-dev-studio-settings'

export interface DevStudioChatSettings {
  historyLimit: number
  persistChat: boolean
  autoContinueBuild: boolean
}

export const DEFAULT_CHAT_SETTINGS: DevStudioChatSettings = {
  historyLimit: 4,
  persistChat: true,
  autoContinueBuild: false,
}

export function loadChatSettings(): DevStudioChatSettings {
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_CHAT_SETTINGS }
    return { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) as Partial<DevStudioChatSettings> }
  } catch {
    return { ...DEFAULT_CHAT_SETTINGS }
  }
}

export function saveChatSettings(settings: DevStudioChatSettings): void {
  localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings))
}

export function loadChatMessages(): { role: 'user' | 'assistant'; content: string }[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { role: 'user' | 'assistant'; content: string }[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveChatMessages(messages: { role: 'user' | 'assistant'; content: string }[]): void {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
}

export function clearChatStorage(): void {
  localStorage.removeItem(CHAT_STORAGE_KEY)
}
