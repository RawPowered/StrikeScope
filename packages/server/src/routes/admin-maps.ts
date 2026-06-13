import { Router } from 'express'
import db from '../db.js'
import { requireActiveCompany } from './helpers.js'
import { getTerritoryConfigForCompany, getMapsApiKey } from '../territory.js'

const router = Router()

/** Client-safe maps config — flags only, never exposes API key */
router.get('/client-config', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const config = getTerritoryConfigForCompany(db, companyId)
  const maps = config.maps || {}
  res.json({
    ok: true,
    data: {
      enableAddressAutocomplete: !!maps.enableAddressAutocomplete,
      enableDirections: !!maps.enableDirections,
      enableMapEmbed: !!maps.enableMapEmbed,
    },
  })
})

/** Server-built embed URL (authenticated; key not in client-config) */
router.get('/embed-url', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const config = getTerritoryConfigForCompany(db, companyId)
  if (!config.maps?.enableMapEmbed) {
    return res.status(400).json({ ok: false, error: 'Map embed is disabled' })
  }
  const apiKey = getMapsApiKey(config)
  if (!apiKey) return res.status(400).json({ ok: false, error: 'Google API key not configured' })
  const address = typeof req.query.address === 'string' ? req.query.address.trim().slice(0, 500) : ''
  if (!address) return res.status(400).json({ ok: false, error: 'address required' })
  const q = encodeURIComponent(address)
  res.json({
    ok: true,
    data: { url: `https://www.google.com/maps/embed/v1/place?q=${q}&key=${apiKey}` },
  })
})

router.post('/autocomplete', async (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const config = getTerritoryConfigForCompany(db, companyId)
  if (!config.maps?.enableAddressAutocomplete) {
    return res.status(400).json({ ok: false, error: 'Address autocomplete is disabled' })
  }
  const apiKey = getMapsApiKey(config)
  if (!apiKey) return res.status(400).json({ ok: false, error: 'Google API key not configured' })

  const { input, sessionToken } = req.body
  if (!input || typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ ok: false, error: 'input required' })
  }
  if (input.length > 200) {
    return res.status(400).json({ ok: false, error: 'input too long (max 200)' })
  }

  try {
    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      types: 'address',
      components: 'country:us',
      ...(sessionToken ? { sessiontoken: sessionToken } : {}),
    })
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`)
    const data = await r.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ ok: false, error: data.error_message || data.status })
    }
    res.json({ ok: true, data: { predictions: data.predictions || [] } })
  } catch {
    res.status(502).json({ ok: false, error: 'Google Places request failed' })
  }
})

router.post('/place-details', async (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const config = getTerritoryConfigForCompany(db, companyId)
  const apiKey = getMapsApiKey(config)
  if (!apiKey) return res.status(400).json({ ok: false, error: 'Google API key not configured' })

  const { placeId } = req.body
  if (!placeId) return res.status(400).json({ ok: false, error: 'placeId required' })

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      fields: 'address_component,formatted_address,geometry',
    })
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`)
    const data = await r.json()
    if (data.status !== 'OK') {
      return res.status(502).json({ ok: false, error: data.error_message || data.status })
    }
    const components = data.result?.address_components || []
    const get = (type: string) => components.find((c: any) => c.types?.includes(type))?.long_name || ''
    const getShort = (type: string) => components.find((c: any) => c.types?.includes(type))?.short_name || ''
    res.json({
      ok: true,
      data: {
        formattedAddress: data.result?.formatted_address,
        address: `${get('street_number')} ${get('route')}`.trim(),
        city: get('locality') || get('sublocality') || get('administrative_area_level_3'),
        state: getShort('administrative_area_level_1'),
        county: get('administrative_area_level_2'),
        zip: get('postal_code'),
        lat: data.result?.geometry?.location?.lat,
        lng: data.result?.geometry?.location?.lng,
      },
    })
  } catch {
    res.status(502).json({ ok: false, error: 'Google Places request failed' })
  }
})

export default router
