import { Router } from 'express'
import db from '../db.js'
import { v4 as uuid } from 'uuid'
import { requireRole } from '../auth.js'

const router = Router()

router.get('/stats', (_req, res) => {
  const guideCount = (db.prepare('SELECT COUNT(*) as c FROM template_items').get() as any).c
  const submissionCount = (db.prepare('SELECT COUNT(*) as c FROM submissions').get() as any).c
  const connectionCount = (db.prepare('SELECT COUNT(*) as c FROM connections').get() as any).c
  const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c
  const companyCount = (db.prepare('SELECT COUNT(*) as c FROM companies WHERE deleted_at IS NULL').get() as any).c
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
  const templateCount = (db.prepare('SELECT COUNT(*) as c FROM task_templates WHERE is_active = 1').get() as any).c
  res.json({ ok: true, data: { guideCount, submissionCount, connectionCount, projectCount, companyCount, userCount, templateCount } })
})

router.post('/reseed', requireRole('server_admin'), (_req, res) => {
  db.prepare('DELETE FROM submission_images').run()
  db.prepare('DELETE FROM submissions').run()
  db.prepare('DELETE FROM project_task_items').run()
  db.prepare('DELETE FROM template_items').run()
  db.prepare('DELETE FROM task_templates').run()
  db.prepare('DELETE FROM connections').run()
  db.prepare('DELETE FROM customers').run()
  db.prepare('DELETE FROM projects').run()

  const items = [
    { label: '01', sort: 0, titleEn: 'Roof - Front Face', titleEs: 'Techo - Cara Frontal', descEn: 'Full view of the front roof face showing all panels', descEs: 'Vista completa de la cara frontal del techo mostrando todos los paneles', count: 1 },
    { label: '02', sort: 1, titleEn: 'Roof - Left Side', titleEs: 'Techo - Lado Izquierdo', descEn: 'Left side roof view showing panel alignment', descEs: 'Vista del lado izquierdo del techo mostrando alineacion de paneles', count: 1 },
    { label: '03', sort: 2, titleEn: 'Roof - Right Side', titleEs: 'Techo - Lado Derecho', descEn: 'Right side roof view showing panel alignment', descEs: 'Vista del lado derecho del techo mostrando alineacion de paneles', count: 1 },
    { label: '04', sort: 3, titleEn: 'Roof - Back Face', titleEs: 'Techo - Cara Trasera', descEn: 'Back roof face showing conduit routing', descEs: 'Cara trasera del techo mostrando el recorrido del conducto', count: 1 },
    { label: '05', sort: 4, titleEn: 'Electrical Panel - Main', titleEs: 'Panel Electrico - Principal', descEn: 'Main electrical panel with breaker labels visible', descEs: 'Panel electrico principal con etiquetas de interruptores visibles', count: 2 },
    { label: '06', sort: 5, titleEn: 'Electrical Panel - Internal Wiring', titleEs: 'Panel Electrico - Cableado Interno', descEn: 'Open panel showing wiring, breakers, and connections', descEs: 'Panel abierto mostrando cableado, interruptores y conexiones', count: 1 },
    { label: '07', sort: 6, titleEn: 'Meter - Front View', titleEs: 'Medidor - Vista Frontal', descEn: 'Utility meter with display and serial number visible', descEs: 'Medidor de servicios con pantalla y numero de serie visibles', count: 1 },
    { label: '08', sort: 7, titleEn: 'Meter - Base/Connections', titleEs: 'Medidor - Base/Conexiones', descEn: 'Meter base showing utility connections and seal', descEs: 'Base del medidor mostrando conexiones de servicios y sello', count: 1 },
    { label: '09', sort: 8, titleEn: 'Inverter - AC Disconnect', titleEs: 'Inversor - Desconexion CA', descEn: 'AC disconnect switch in the OFF position with label', descEs: 'Interruptor de desconexion CA en posicion APAGADO con etiqueta', count: 1 },
    { label: '10', sort: 9, titleEn: 'Inverter - DC Disconnect', titleEs: 'Inversor - Desconexion CC', descEn: 'DC disconnect switch with voltage reading', descEs: 'Interruptor de desconexion CC con lectura de voltaje', count: 1 },
    { label: '11', sort: 10, titleEn: 'Inverter - Nameplate', titleEs: 'Inversor - Placa de Identificacion', descEn: 'Inverter nameplate with model and serial numbers', descEs: 'Placa de identificacion del inversor con modelo y numeros de serie', count: 1 },
    { label: '12', sort: 11, titleEn: 'Inverter - Display Screen', titleEs: 'Inversor - Pantalla', descEn: 'Inverter display showing operational status', descEs: 'Pantalla del inversor mostrando estado operativo', count: 1 },
    { label: '13', sort: 12, titleEn: 'Rapid Shutdown - Label', titleEs: 'Apagado Rapido - Etiqueta', descEn: 'Rapid shutdown label at array location', descEs: 'Etiqueta de apagado rapido en la ubicacion del arreglo', count: 1 },
    { label: '14', sort: 13, titleEn: 'Rapid Shutdown - Junction Box', titleEs: 'Apagado Rapido - Caja de Conexiones', descEn: 'Rapid shutdown junction box with conduit connections', descEs: 'Caja de conexiones de apagado rapido con conexiones de conducto', count: 1 },
    { label: '15', sort: 14, titleEn: 'Conduit - Roof Penetration', titleEs: 'Conducto - Penetracion de Techo', descEn: 'Conduit roof penetration with flashing and sealant', descEs: 'Penetracion de conducto en techo con flashings y sellador', count: 2 },
    { label: '16', sort: 15, titleEn: 'Conduit - Wall Run', titleEs: 'Conducto - Recorrido de Pared', descEn: 'Conduit along exterior wall showing supports', descEs: 'Conducto a lo largo de la pared exterior mostrando soportes', count: 2 },
    { label: '17', sort: 16, titleEn: 'Grounding - Rod/Electrode', titleEs: 'Puesta a Tierra - Varilla/Electrodo', descEn: 'Ground rod with clamp and conductor visible', descEs: 'Varilla de tierra con abrazadera y conductor visibles', count: 2 },
    { label: '18', sort: 17, titleEn: 'Grounding - Bonding Bridge', titleEs: 'Puesta a Tierra - Puente de Union', descEn: 'Equipment bonding jumper at panel', descEs: 'Puente de union de equipos en el panel', count: 2 },
    { label: '19', sort: 18, titleEn: 'Attic - Flashing Seals', titleEs: 'Atico - Sellos de Flashings', descEn: 'Attic view of all roof penetrations with seals intact', descEs: 'Vista del atico de todas las penetraciones de techo con sellos intactos', count: 2 },
    { label: '20', sort: 19, titleEn: 'Attic - Wiring Overview', titleEs: 'Atico - Vista General del Cableado', descEn: 'Attic wiring showing proper support and protection', descEs: 'Cableado del atico mostrando soporte y proteccion adecuados', count: 2 },
    { label: '21', sort: 20, titleEn: 'Site - Property Overview', titleEs: 'Sitio - Vista General', descEn: 'Overview photo showing entire installation site', descEs: 'Foto general mostrando todo el sitio de instalacion', count: 3 },
    { label: '22', sort: 21, titleEn: 'Site - Access Path', titleEs: 'Sitio - Camino de Acceso', descEn: 'Access path to equipment showing clear walkway', descEs: 'Camino de acceso al equipo mostrando pasillo despejado', count: 3 },
    { label: '23', sort: 22, titleEn: 'Site - Clearance Around Equipment', titleEs: 'Sitio - Espacio Alrededor del Equipo', descEn: 'Required clearance maintained around all electrical equipment', descEs: 'Espacio libre requerido mantenido alrededor de todo el equipo electrico', count: 3 },
  ]

  const tmplId = uuid()
  db.prepare('INSERT INTO task_templates (id, company_id, name, is_global, is_default) VALUES (?, ?, ?, ?, ?)').run(tmplId, 'default', 'Standard Photo Checklist', 1, 1)
  const insert = db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
  const tx = db.transaction(() => {
    for (const item of items) {
      insert.run(uuid(), tmplId, item.label, item.sort, item.titleEn, item.titleEs, item.descEn, item.descEs, item.count)
    }
  })
  tx()

  res.json({ ok: true, data: { reseeded: items.length } })
})

export default router
