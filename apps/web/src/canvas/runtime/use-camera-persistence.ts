import { clampZoom } from '@corkspace/engine'
import { useEffect } from 'react'
import { react } from 'signia'
import { cameraAtom, setCamera } from '../state/camera-store'
import { depend } from './signal-utils'

interface CameraResponse {
  camera: { x: number; y: number; zoom: number } | null
}

/** Restore the last camera from the server on mount, then debounce-persist changes.
 *  No localStorage (docs/adr/). */
export function useCameraPersistence(): void {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/me/camera', { credentials: 'include' })
        if (!res.ok) {
          return
        }
        const data = (await res.json()) as CameraResponse
        if (!cancelled && data.camera) {
          setCamera({ x: data.camera.x, y: data.camera.y, zoom: clampZoom(data.camera.zoom) })
        }
      } catch {
        // offline / unauthenticated — keep the default camera
      }
    })()

    let timer: ReturnType<typeof setTimeout> | null = null
    const save = (): void => {
      void fetch('/api/me/camera', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cameraAtom.value),
      }).catch(() => {})
    }

    const stop = react('camera-persist', () => {
      depend(cameraAtom)
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(save, 600)
    })

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
      stop()
    }
  }, [])
}
