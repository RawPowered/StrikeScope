import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = join(DATA_DIR, 'strikescope.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const DEFAULT_BRANDING = JSON.stringify({
  primary: '#F57C00',
  secondary: '#4FC3F7',
  accent: '#FFD54F',
  grey: '#9E9E9E',
  gunmetal: '#2C3439',
  white: '#FFFFFF',
  appName: 'StrikeScope',
})

// ── Schema ──
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT,
    branding_json TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS guide_items (
    id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
    label TEXT NOT NULL, sort_order INTEGER NOT NULL,
    title_en TEXT NOT NULL, title_es TEXT NOT NULL DEFAULT '',
    desc_en TEXT NOT NULL DEFAULT '', desc_es TEXT NOT NULL DEFAULT '',
    required_count INTEGER DEFAULT 1, example_image TEXT
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
    installer_name TEXT, gps_lat REAL, gps_lng REAL,
    captured_at TEXT, submitted_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS submission_images (
    id TEXT PRIMARY KEY, submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
    guide_item_id TEXT REFERENCES guide_items(id),
    filename TEXT NOT NULL, filepath TEXT NOT NULL,
    gps_lat REAL, gps_lng REAL, captured_at TEXT
  );
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
    type TEXT NOT NULL, label TEXT, config_json TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
`)

// ── Default site ──
const existing = db.prepare('SELECT id FROM sites WHERE id = ?').get('default')
if (!existing) {
  db.prepare('INSERT INTO sites (id, name, branding_json) VALUES (?, ?, ?)').run('default', 'Default Site', DEFAULT_BRANDING)
  console.log('[seed] Created default site')
}

// ── Guide items (skip if already seeded) ──
const cnt = db.prepare('SELECT COUNT(*) as cnt FROM guide_items').get() as any
if (cnt.cnt > 0) {
  console.log('[seed] Guide items already exist, skipping')
  process.exit(0)
}

const GUIDE_ITEMS = [
  { label: '01', titleEn: 'Roof — Front Face', titleEs: 'Techo — Cara Frontal', descEn: 'Full view of the front roof face showing all panels', descEs: 'Vista completa de la cara frontal del techo mostrando todos los paneles', requiredCount: 1 },
  { label: '02', titleEn: 'Roof — Left Side', titleEs: 'Techo — Lado Izquierdo', descEn: 'Left side roof view showing panel alignment', descEs: 'Vista del lado izquierdo del techo mostrando alineación de paneles', requiredCount: 1 },
  { label: '03', titleEn: 'Roof — Right Side', titleEs: 'Techo — Lado Derecho', descEn: 'Right side roof view showing panel alignment', descEs: 'Vista del lado derecho del techo mostrando alineación de paneles', requiredCount: 1 },
  { label: '04', titleEn: 'Roof — Back Face', titleEs: 'Techo — Cara Trasera', descEn: 'Back roof face showing conduit routing', descEs: 'Cara trasera del techo mostrando el recorrido del conducto', requiredCount: 1 },
  { label: '05', titleEn: 'Electrical Panel — Main', titleEs: 'Panel Eléctrico — Principal', descEn: 'Main electrical panel with breaker labels visible', descEs: 'Panel eléctrico principal con etiquetas de interruptores visibles', requiredCount: 2 },
  { label: '06', titleEn: 'Electrical Panel — Internal Wiring', titleEs: 'Panel Eléctrico — Cableado Interno', descEn: 'Open panel showing wiring, breakers, and connections', descEs: 'Panel abierto mostrando cableado, interruptores y conexiones', requiredCount: 1 },
  { label: '07', titleEn: 'Meter — Front View', titleEs: 'Medidor — Vista Frontal', descEn: 'Utility meter with display and serial number visible', descEs: 'Medidor de servicios con pantalla y número de serie visibles', requiredCount: 1 },
  { label: '08', titleEn: 'Meter — Base/Connections', titleEs: 'Medidor — Base/Conexiones', descEn: 'Meter base showing utility connections and seal', descEs: 'Base del medidor mostrando conexiones de servicios y sello', requiredCount: 1 },
  { label: '09', titleEn: 'Inverter — AC Disconnect', titleEs: 'Inversor — Desconexión CA', descEn: 'AC disconnect switch in the OFF position with label', descEs: 'Interruptor de desconexión CA en posición APAGADO con etiqueta', requiredCount: 1 },
  { label: '10', titleEn: 'Inverter — DC Disconnect', titleEs: 'Inversor — Desconexión CC', descEn: 'DC disconnect switch with voltage reading', descEs: 'Interruptor de desconexión CC con lectura de voltaje', requiredCount: 1 },
  { label: '11', titleEn: 'Inverter — Nameplate', titleEs: 'Inversor — Placa de Identificación', descEn: 'Inverter nameplate with model and serial numbers', descEs: 'Placa de identificación del inversor con modelo y números de serie', requiredCount: 1 },
  { label: '12', titleEn: 'Inverter — Display Screen', titleEs: 'Inversor — Pantalla', descEn: 'Inverter display showing operational status', descEs: 'Pantalla del inversor mostrando estado operativo', requiredCount: 1 },
  { label: '13', titleEn: 'Rapid Shutdown — Label', titleEs: 'Apagado Rápido — Etiqueta', descEn: 'Rapid shutdown label at array location', descEs: 'Etiqueta de apagado rápido en la ubicación del arreglo', requiredCount: 1 },
  { label: '14', titleEn: 'Rapid Shutdown — Junction Box', titleEs: 'Apagado Rápido — Caja de Conexiones', descEn: 'Rapid shutdown junction box with conduit connections', descEs: 'Caja de conexiones de apagado rápido con conexiones de conducto', requiredCount: 1 },
  { label: '15', titleEn: 'Conduit — Roof Penetration', titleEs: 'Conducto — Penetración de Techo', descEn: 'Conduit roof penetration with flashing and sealant', descEs: 'Penetración de conducto en techo con flashings y sellador', requiredCount: 2 },
  { label: '16', titleEn: 'Conduit — Wall Run', titleEs: 'Conducto — Recorrido de Pared', descEn: 'Conduit along exterior wall showing supports', descEs: 'Conducto a lo largo de la pared exterior mostrando soportes', requiredCount: 2 },
  { label: '17', titleEn: 'Grounding — Rod/Electrode', titleEs: 'Puesta a Tierra — Varilla/Electrodo', descEn: 'Ground rod with clamp and conductor visible', descEs: 'Varilla de tierra con abrazadera y conductor visibles', requiredCount: 2 },
  { label: '18', titleEn: 'Grounding — Bonding Bridge', titleEs: 'Puesta a Tierra — Puente de Unión', descEn: 'Equipment bonding jumper at panel', descEs: 'Puente de unión de equipos en el panel', requiredCount: 2 },
  { label: '19', titleEn: 'Attic — Flashing Seals', titleEs: 'Ático — Sellos de Flashings', descEn: 'Attic view of all roof penetrations with seals intact', descEs: 'Vista del ático de todas las penetraciones de techo con sellos intactos', requiredCount: 2 },
  { label: '20', titleEn: 'Attic — Wiring Overview', titleEs: 'Ático — Vista General del Cableado', descEn: 'Attic wiring showing proper support and protection', descEs: 'Cableado del ático mostrando soporte y protección adecuados', requiredCount: 2 },
  { label: '21', titleEn: 'Site — Property Overview', titleEs: 'Sitio — Vista General', descEn: 'Overview photo showing entire installation site', descEs: 'Foto general mostrando todo el sitio de instalación', requiredCount: 3 },
  { label: '22', titleEn: 'Site — Access Path', titleEs: 'Sitio — Camino de Acceso', descEn: 'Access path to equipment showing clear walkway', descEs: 'Camino de acceso al equipo mostrando pasillo despejado', requiredCount: 3 },
  { label: '23', titleEn: 'Site — Clearance Around Equipment', titleEs: 'Sitio — Espacio Alrededor del Equipo', descEn: 'Required clearance maintained around all electrical equipment', descEs: 'Espacio libre requerido mantenido alrededor de todo el equipo eléctrico', requiredCount: 3 },
]

const insert = db.prepare(`
  INSERT INTO guide_items (id, site_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image)
  VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, NULL)
`)
const tx = db.transaction(() => {
  for (const item of GUIDE_ITEMS) {
    insert.run(uuid(), item.label, parseInt(item.label), item.titleEn, item.titleEs, item.descEn, item.descEs, item.requiredCount)
  }
})
tx()

console.log(`[seed] Inserted ${GUIDE_ITEMS.length} guide items`)
console.log('[seed] Done — database ready to explore!')
