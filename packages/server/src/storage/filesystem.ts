import { writeFile, unlink, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import type { StorageProvider } from './provider.js'

export const filesystemProvider: StorageProvider = {
  name: 'filesystem',

  async test(config: Record<string, string>) {
    const dir = config.storageDir || './data/uploads'
    try {
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      return { success: true, message: `Directory accessible: ${dir}` }
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  },

  async upload(config: Record<string, string>, filePath: string, buffer: Buffer) {
    const baseDir = config.storageDir || './data/uploads'
    const fullPath = join(baseDir, filePath)
    const parent = dirname(fullPath)
    if (!existsSync(parent)) await mkdir(parent, { recursive: true })
    await writeFile(fullPath, buffer)
    return fullPath
  },

  async delete(_config: Record<string, string>, filePath: string) {
    await unlink(filePath)
  },
}
