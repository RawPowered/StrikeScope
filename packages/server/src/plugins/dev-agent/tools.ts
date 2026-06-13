import type { OllamaTool } from './ollama-client.js'
import {
  listDirectory, readWorkspaceFile, searchCode,
} from './workspace.js'
import { getFeatureMap } from './module-guard.js'
import {
  runReadonlyQuery, getSchemaOverview, getTableInfo, proposeMigrationFilename,
} from './sql-tools.js'
import { retrieveContext, formatContextForPrompt, buildPlatformBrief } from './platform-knowledge/index.js'

export interface ProposedPatch {
  path: string
  content: string
  previousHash?: string
}

const pendingPatches: ProposedPatch[] = []

export function getPendingPatches(): ProposedPatch[] {
  return [...pendingPatches]
}

export function clearPendingPatches(): void {
  pendingPatches.length = 0
}

export function addPendingPatch(patch: ProposedPatch): void {
  const idx = pendingPatches.findIndex(p => p.path === patch.path)
  if (idx >= 0) pendingPatches[idx] = patch
  else pendingPatches.push(patch)
}

export const TOOL_DEFINITIONS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a workspace directory',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative directory path' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the workspace',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search codebase for a string',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_patch',
      description: 'REQUIRED to change code. Propose full file content for a workspace path. User ships via Continue Build. Never paste code in chat instead of calling this.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_platform',
      description: 'Semantic search platform knowledge index',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_feature_map',
      description: 'Get SysMap feature definition by id',
      parameters: { type: 'object', properties: { feature_id: { type: 'string' } }, required: ['feature_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schema',
      description: 'Get DB schema overview or table info',
      parameters: {
        type: 'object',
        properties: { table: { type: 'string', description: 'Optional table name' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_conventions',
      description: 'Platform coding conventions and architecture brief',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sql_inspect',
      description: 'Run readonly SQL query',
      parameters: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_migration',
      description: 'Stage a migration SQL proposal (filename + sql)',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          sql: { type: 'string' },
        },
        required: ['description', 'sql'],
      },
    },
  },
]

let pendingMigration: { filename: string; sql: string } | null = null

export function getPendingMigration(): { filename: string; sql: string } | null {
  return pendingMigration
}

export function clearPendingMigration(): void {
  pendingMigration = null
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: { activePath?: string },
): Promise<string> {
  switch (name) {
    case 'list_files': {
      const path = String(args.path || '')
      const entries = listDirectory(path)
      return JSON.stringify(entries.slice(0, 100))
    }
    case 'read_file': {
      const path = String(args.path || '')
      const file = readWorkspaceFile(path)
      return JSON.stringify({ path: file.path, hash: file.hash, content: file.content.slice(0, 12000) })
    }
    case 'search_code': {
      const query = String(args.query || '')
      return JSON.stringify(searchCode(query))
    }
    case 'propose_patch': {
      const path = String(args.path || '')
      const content = String(args.content || '')
      let previousHash: string | undefined
      try {
        previousHash = readWorkspaceFile(path).hash
      } catch { /* new file */ }
      addPendingPatch({ path, content, previousHash })
      return JSON.stringify({ ok: true, path, staged: true })
    }
    case 'search_platform': {
      const query = String(args.query || '')
      const retrieved = await retrieveContext({ query, activePath: ctx?.activePath })
      return formatContextForPrompt(retrieved).slice(0, 8000)
    }
    case 'get_feature_map': {
      const id = String(args.feature_id || '')
      const f = getFeatureMap(id)
      return JSON.stringify(f || { error: 'Feature not found' })
    }
    case 'get_schema': {
      const table = args.table ? String(args.table) : null
      if (table) return JSON.stringify(getTableInfo(table))
      return JSON.stringify(getSchemaOverview())
    }
    case 'list_conventions':
      return buildPlatformBrief()
    case 'sql_inspect': {
      const sql = String(args.sql || '')
      return JSON.stringify(runReadonlyQuery(sql))
    }
    case 'propose_migration': {
      const desc = String(args.description || '')
      const sql = String(args.sql || '')
      const filename = proposeMigrationFilename(desc)
      pendingMigration = { filename, sql }
      return JSON.stringify({ ok: true, filename, staged: true })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}
