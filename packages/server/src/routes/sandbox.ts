import { Router } from 'express'
import { getConfig } from '../config.js'

const router = Router()

router.use((_req, res, next) => {
  if (!getConfig().devMode) {
    return res.status(404).json({ ok: false, error: 'Sandbox only available in dev mode' })
  }
  next()
})

router.get('/submissions', (_req, res) => {
  const mock = Array.from({ length: 10 }, (_, i) => ({
    id: `mock-${i}`,
    siteId: 'default',
    installerName: `Installer ${i + 1}`,
    gpsLat: 25.76 + (Math.random() - 0.5) * 0.05,
    gpsLng: -80.19 + (Math.random() - 0.5) * 0.05,
    capturedAt: new Date(Date.now() - i * 60000).toISOString(),
    submittedAt: new Date().toISOString(),
    status: ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)],
    photoCount: Math.floor(Math.random() * 20) + 1,
  }))
  res.json({ ok: true, data: mock })
})

router.get('/guide', (_req, res) => {
  const mock = Array.from({ length: 23 }, (_, i) => ({
    id: `mock-guide-${i}`,
    siteId: 'default',
    label: String(i + 1).padStart(2, '0'),
    sortOrder: i,
    titleEn: `Sample Photo Item ${i + 1}`,
    titleEs: `Ejemplo de Foto ${i + 1}`,
    descEn: `Description for photo item ${i + 1}. This is a sample guide item for development testing.`,
    descEs: `Descripción del elemento de foto ${i + 1}. Este es un elemento de guía de muestra.`,
    requiredCount: i >= 20 ? 4 : i >= 14 ? 3 : 1,
    exampleImage: null,
  }))
  res.json({ ok: true, data: mock })
})

router.post('/submissions', (req, res) => {
  res.status(201).json({
    ok: true,
    data: { id: `mock-sub-${Date.now()}`, status: 'pending' },
  })
})

export default router
