import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

const OPERATORS = ['+', '-', '*', '/', '(', ')']
const FIELD_TOKENS = ['cost_total', 'COST_TOTAL', 'contract_price', 'agent_rate']

interface Props {
  value: string
  onChange: (expr: string) => void
}

export function FormulaBuilder({ value, onChange }: Props) {
  const [preview, setPreview] = useState(value)

  const append = (token: string) => {
    const next = (preview + (preview && !preview.endsWith(' ') ? ' ' : '') + token).trim()
    setPreview(next)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div><Label>Formula expression</Label>
        <Input className="mt-1 font-mono text-sm" value={preview} onChange={e => { setPreview(e.target.value); onChange(e.target.value) }} placeholder="(contract_price - cost_total) * agent_rate" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Click to insert fields</p>
        <div className="flex flex-wrap gap-1">
          {FIELD_TOKENS.map(t => <Button key={t} type="button" size="sm" variant="outline" onClick={() => append(t)}>{t}</Button>)}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Operators</p>
        <div className="flex flex-wrap gap-1">
          {OPERATORS.map(t => <Button key={t} type="button" size="sm" variant="ghost" onClick={() => append(t)}>{t}</Button>)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Use SUM_category tokens from cost line categories (e.g. costs_material).</p>
    </div>
  )
}
