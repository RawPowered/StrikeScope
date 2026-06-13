export interface ParsedModelfile {
  from: string
  system: string
  parameters: Record<string, string | number | boolean>
}

export function parseModelfile(raw: string): ParsedModelfile {
  const fromMatch = raw.match(/^FROM\s+(\S+)/m)
  const from = fromMatch?.[1] || 'qwen2.5-coder:7b'

  let system = ''
  const sysTriple = raw.match(/SYSTEM\s+"""\n?([\s\S]*?)"""/)
  const sysSingle = raw.match(/SYSTEM\s+"([^"]*)"/)
  if (sysTriple) system = sysTriple[1].trim()
  else if (sysSingle) system = sysSingle[1].trim()

  const parameters: Record<string, string | number | boolean> = {}
  for (const m of raw.matchAll(/^PARAMETER\s+(\S+)\s+(.+)$/gm)) {
    const key = m[1]
    const val = m[2].trim()
    if (val === 'true' || val === 'false') {
      parameters[key] = val === 'true'
      continue
    }
    const num = Number(val)
    parameters[key] = Number.isFinite(num) ? num : val
  }

  return { from, system, parameters }
}
