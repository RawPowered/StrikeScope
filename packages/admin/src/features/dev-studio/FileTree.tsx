import { useEffect, useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { FileEntry } from './useDevStudio'
import { useDevStudio } from './useDevStudio'

interface Props {
  activePath: string | null
  onSelect: (path: string, type: 'file' | 'dir') => void
}

function TreeNode({
  entry,
  depth,
  activePath,
  onSelect,
  expanded,
  onToggle,
}: {
  entry: FileEntry
  depth: number
  activePath: string | null
  onSelect: Props['onSelect']
  expanded: Set<string>
  onToggle: (path: string) => void
}) {
  const { listFiles } = useDevStudio()
  const [children, setChildren] = useState<FileEntry[]>([])
  const isOpen = expanded.has(entry.path)
  const isDir = entry.type === 'dir'

  useEffect(() => {
    if (!isDir || !isOpen) return
    listFiles(entry.path).then(r => {
      if (r.ok && r.data) setChildren(r.data)
    })
  }, [isDir, isOpen, entry.path, listFiles])

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-muted',
          activePath === entry.path && 'bg-muted font-medium',
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => {
          if (isDir) onToggle(entry.path)
          else onSelect(entry.path, entry.type)
        }}
      >
        {isDir ? (
          isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        ) : <span className="w-3" />}
        {isDir ? <Folder className="h-3 w-3 shrink-0 text-amber-600" /> : <File className="h-3 w-3 shrink-0" />}
        <span className="truncate">{entry.name}</span>
      </button>
      {isDir && isOpen && children.map(c => (
        <TreeNode
          key={c.path}
          entry={c}
          depth={depth + 1}
          activePath={activePath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

export function FileTree({ activePath, onSelect }: Props) {
  const { listFiles } = useDevStudio()
  const [roots, setRoots] = useState<FileEntry[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['packages', 'EnVars', 'shared']))

  useEffect(() => {
    listFiles('').then(r => {
      if (r.ok && r.data) setRoots(r.data)
    })
  }, [listFiles])

  const onToggle = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <div className="h-full overflow-auto border-r bg-muted/30 p-1">
      {roots.map(e => (
        <TreeNode
          key={e.path}
          entry={e}
          depth={0}
          activePath={activePath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
