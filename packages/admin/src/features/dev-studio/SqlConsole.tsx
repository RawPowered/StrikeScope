import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useDevStudio } from './useDevStudio'

export function SqlConsole() {
  const { sqlQuery, getSchema } = useDevStudio()
  const [sql, setSql] = useState('SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name LIMIT 20')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [schemaInfo, setSchemaInfo] = useState('')

  const run = async () => {
    setError('')
    const r = await sqlQuery(sql)
    if (!r.ok) {
      setError(r.error || 'Query failed')
      return
    }
    setColumns(r.data?.columns || [])
    setRows(r.data?.rows || [])
  }

  const loadSchema = async () => {
    const r = await getSchema()
    if (r.ok) setSchemaInfo(JSON.stringify(r.data, null, 2))
  }

  return (
    <div className="flex h-full flex-col p-2 text-xs">
      <div className="flex gap-2 mb-2">
        <Input
          className="font-mono text-xs"
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="SELECT … (readonly)"
        />
        <Button size="sm" onClick={run}><Play className="h-3 w-3" /></Button>
        <Button size="sm" variant="outline" onClick={loadSchema}>Schema</Button>
      </div>
      {error && <p className="text-destructive mb-2">{error}</p>}
      {schemaInfo && (
        <pre className="mb-2 max-h-24 overflow-auto rounded border bg-muted/30 p-2">{schemaInfo}</pre>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>{columns.map(c => <th key={c} className="border px-1 text-left">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map(c => (
                  <td key={c} className="border px-1 font-mono">{String(row[c] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
