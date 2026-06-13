import { useEffect } from 'react'
import { useCamera } from '../hooks/useCamera'

interface Props {
  onCapture: (data: string) => void
  active: boolean
  onActivate: () => void
}

export default function CameraView({ onCapture, active, onActivate }: Props) {
  const { videoRef, active: camActive, error, start, capture } = useCamera()

  useEffect(() => {
    if (active && !camActive && !error) start()
  }, [active, camActive, error, start])

  const handleSnap = async () => {
    const data = await capture()
    if (data) onCapture(data)
  }

  if (!active) {
    return (
      <div className="camera-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn-submit" style={{ width: 'auto', padding: '12px 24px' }} onClick={onActivate}>
          Open Camera
        </button>
      </div>
    )
  }

  return (
    <div className="camera-view">
      <video ref={videoRef} autoPlay playsInline muted />

      {!camActive && !error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#888', textAlign: 'center', fontSize: 14 }}>
          Starting camera...
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <p style={{ color: '#f44', marginBottom: 8 }}>{error}</p>
          <button className="btn-submit" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }} onClick={start}>
            Try Again
          </button>
        </div>
      )}

      {camActive && <button className="camera-snap-btn" onClick={handleSnap} />}
    </div>
  )
}
