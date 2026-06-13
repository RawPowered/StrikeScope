export interface PhotoMeta {
  gpsLat: number | null
  gpsLng: number | null
  capturedAt: string
}

export async function extractMeta(base64Data: string): Promise<PhotoMeta> {
  const meta: PhotoMeta = { gpsLat: null, gpsLng: null, capturedAt: new Date().toISOString() }

  try {
    const { default: exifr } = await import('exifr')
    const buffer = base64ToArrayBuffer(base64Data)
    const gps = await exifr.gps(buffer)
    if (gps) {
      meta.gpsLat = gps.latitude ?? null
      meta.gpsLng = gps.longitude ?? null
    }
    const datetime = await exifr.parse(buffer, ['DateTimeOriginal'])
    if (datetime?.DateTimeOriginal) {
      meta.capturedAt = new Date(datetime.DateTimeOriginal).toISOString()
    }
  } catch {
    // EXIF extraction is best-effort
  }

  return meta
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const raw = base64.replace(/^data:image\/\w+;base64,/, '')
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
