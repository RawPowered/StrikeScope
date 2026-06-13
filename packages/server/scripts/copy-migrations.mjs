import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..', 'src', 'migrations')
const destDir = join(__dirname, '..', 'dist', 'migrations')

mkdirSync(destDir, { recursive: true })
for (const f of readdirSync(srcDir)) {
  if (f.endsWith('.sql')) {
    copyFileSync(join(srcDir, f), join(destDir, f))
  }
}
