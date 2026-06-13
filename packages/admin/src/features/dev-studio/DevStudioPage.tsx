import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../../layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { FileTree } from './FileTree'
import { CodeEditor } from './CodeEditor'
import { AgentChat, type DebugTrigger } from './AgentChat'
import { ShipPanel } from './ShipPanel'
import { SqlConsole } from './SqlConsole'
import { SnapshotPanel } from './SnapshotPanel'
import { KnowledgePanel } from './KnowledgePanel'
import { ModelSettings } from './ModelSettings'
import { ChatSettings } from './ChatSettings'
import type { DevStudioChatSettings } from './chat-storage'
import type { PatchItem } from './useDevStudio'
import { useDevStudio } from './useDevStudio'

export default function DevStudioPage() {
  const { getStatus, readFile, syncKnowledge, deployStatus } = useDevStudio()
  const [activePath, setActivePath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [status, setStatus] = useState<{
    ollama: { ok: boolean }
    knowledge: { chunkCount: number; lastSync: string | null }
    config?: { contextWindow?: number }
  } | null>(null)
  const [chatSettings, setChatSettings] = useState<DevStudioChatSettings | undefined>()
  const [patches, setPatches] = useState<PatchItem[]>([])
  const [migration, setMigration] = useState<{ filename: string; sql: string } | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')
  const [allowCrossModule, setAllowCrossModule] = useState(false)
  const [bottomTab, setBottomTab] = useState('snapshots')
  const [debugTrigger, setDebugTrigger] = useState<DebugTrigger | null>(null)

  useEffect(() => {
    getStatus().then(r => {
      if (r.ok && r.data) setStatus(r.data)
    })
    deployStatus().catch(() => {})
  }, [getStatus, deployStatus])

  useEffect(() => {
    if (!status?.knowledge.lastSync) {
      (async () => {
        try {
          for await (const ev of syncKnowledge(true)) {
            if (ev.type === 'done') getStatus().then(res => { if (res.ok && res.data) setStatus(res.data) })
          }
        } catch { /* ollama may be offline */ }
      })()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = useCallback(async (path: string, type: 'file' | 'dir') => {
    if (type === 'dir') return
    setPreviewMode(false)
    setActivePath(path)
    const r = await readFile(path)
    if (r.ok && r.data) setFileContent(r.data.content)
    else toast.error(r.error || 'Failed to read file')
  }, [readFile])

  const onPatches = useCallback((p: PatchItem[], m: { filename: string; sql: string } | null) => {
    setPatches(p)
    if (m) setMigration(m)
  }, [])

  const onPreviewPatch = useCallback((path: string, content: string) => {
    setActivePath(path)
    setFileContent(content)
    setPreviewMode(true)
  }, [])

  const onDebugRequest = useCallback((ctx: DebugTrigger) => {
    setDebugTrigger({ ...ctx, id: Date.now(), prompt: ctx.prompt })
  }, [])

  const ollamaOk = status?.ollama?.ok

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Dev Studio"
        description={ollamaOk === false
          ? 'Ollama offline — install and run ollama serve'
          : `Knowledge: ${status?.knowledge?.chunkCount ?? 0} chunks`}
      />
      <div className="flex flex-1 min-h-0 border rounded-lg overflow-hidden mx-4 mb-4">
        <div className="w-48 shrink-0">
          <FileTree activePath={activePath} onSelect={openFile} />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-w-0 relative">
              {previewMode && (
                <div className="absolute top-2 right-2 z-10 rounded bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5">
                  Proposed patch preview
                </div>
              )}
              <CodeEditor path={activePath} content={fileContent} readOnly />
            </div>
            <div className="w-80 shrink-0">
              <AgentChat
                activePath={activePath}
                chatSettings={chatSettings}
                debugTrigger={debugTrigger}
                onPatches={onPatches}
                onPrompt={setLastPrompt}
              />
            </div>
          </div>
          <ShipPanel
            patches={patches}
            migration={migration}
            prompt={lastPrompt}
            allowCrossModule={allowCrossModule}
            onReject={() => { setPatches([]); setMigration(null); setPreviewMode(false) }}
            onPreviewPatch={onPreviewPatch}
            onDebugRequest={onDebugRequest}
            onShipped={() => { setPatches([]); setMigration(null); setPreviewMode(false) }}
            autoContinueBuild={chatSettings?.autoContinueBuild}
          />
          <Tabs value={bottomTab} onValueChange={setBottomTab} className="border-t">
            <TabsList className="h-8 w-full justify-start rounded-none">
              <TabsTrigger value="snapshots" className="text-xs">Snapshots</TabsTrigger>
              <TabsTrigger value="sql" className="text-xs">SQL</TabsTrigger>
              <TabsTrigger value="knowledge" className="text-xs">Knowledge</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="snapshots" className="m-0"><SnapshotPanel /></TabsContent>
            <TabsContent value="sql" className="m-0 h-40"><SqlConsole /></TabsContent>
            <TabsContent value="knowledge" className="m-0"><KnowledgePanel /></TabsContent>
            <TabsContent value="settings" className="m-0 p-3 text-xs space-y-4">
              <ModelSettings />
              <ChatSettings
                contextWindow={status?.config?.contextWindow}
                onChange={setChatSettings}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowCrossModule}
                  onChange={e => setAllowCrossModule(e.target.checked)}
                />
                Allow cross-module edits (skip SysMap warnings)
              </label>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
