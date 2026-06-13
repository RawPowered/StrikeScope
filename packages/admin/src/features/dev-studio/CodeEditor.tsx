import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'

interface Props {
  path: string | null
  content: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function CodeEditor({ path, content, onChange, readOnly }: Props) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { setLoading(true) }, [path])
  const ext = path?.split('.').pop() || 'txt'
  const lang = ext === 'tsx' || ext === 'ts' ? 'typescript'
    : ext === 'json' ? 'json'
      : ext === 'sql' ? 'sql'
        : ext === 'xml' ? 'xml'
          : ext === 'css' ? 'css'
            : 'plaintext'

  if (!path) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a file from the tree
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground bg-background/80">
          Loading editor…
        </div>
      )}
      <Editor
        height="100%"
        language={lang}
        value={content}
        theme="vs-dark"
        loading={null}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
          automaticLayout: true,
        }}
        onChange={v => onChange?.(v || '')}
        onMount={() => setLoading(false)}
      />
    </div>
  )
}
