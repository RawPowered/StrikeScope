import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(__dirname, '..')
const dist = join(pkgDir, 'dist', 'index.js')

if (!existsSync(dist)) {
  console.error('Run npm run build first')
  process.exit(1)
}

execSync('npm pack', { cwd: pkgDir, stdio: 'inherit' })
console.log('Install the generated .tgz in Activepieces Platform Admin → Setup → Install Piece')
