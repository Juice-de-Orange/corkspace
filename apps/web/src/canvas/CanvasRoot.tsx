import { useEffect, useRef } from 'react'
import { useValue } from 'signia-react'
import { BackgroundGrid } from './background/BackgroundGrid'
import { ConnectAnchorBadge } from './chrome/ConnectAnchorBadge'
import { ConnectionEditor } from './chrome/ConnectionEditor'
import { CreateToolbar } from './chrome/CreateToolbar'
import { DashboardOverlay } from './chrome/DashboardOverlay'
import { Minimap } from './chrome/Minimap'
import { PinnedAnchorBadge } from './chrome/PinnedAnchorBadge'
import { PositionReadout } from './chrome/PositionReadout'
import { TagPanel } from './chrome/TagPanel'
import { TeleportPanel } from './chrome/TeleportPanel'
import { ZoomControls } from './chrome/ZoomControls'
import { toolCursor } from './cursors'
import { ConnectionsLayer } from './entries/ConnectionsLayer'
import { EntryLayer } from './entries/EntryLayer'
import { FrameLayer } from './entries/FrameLayer'
import { StrokesLayer } from './entries/StrokesLayer'
import { TagsLayer } from './entries/TagsLayer'
import { useImageDropPaste } from './input/use-image-drop-paste'
import { useKeyboardShortcuts } from './input/use-keyboard-shortcuts'
import { usePointerInput } from './input/use-pointer-input'
import { startCanvasRuntime } from './runtime/canvas-runtime'
import { useLoadMe } from './runtime/use-load-me'
import { setViewport } from './state/camera-store'
import { connectToolAtom } from './state/connection-store'
import { drawToolAtom, penColorAtom } from './state/stroke-store'

/** The infinite board: a fixed root with a single transformed "world" container. */
export function CanvasRoot() {
  const rootRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const drawTool = useValue(drawToolAtom)
  const connectTool = useValue(connectToolAtom)
  const penColor = useValue(penColorAtom)
  const cursor = toolCursor(drawTool, connectTool, penColor)

  useEffect(() => {
    const root = rootRef.current
    const world = worldRef.current
    if (!root || !world) {
      return
    }
    const measure = (): void => setViewport(root.clientWidth, root.clientHeight)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(root)
    const stop = startCanvasRuntime(world)
    return () => {
      ro?.disconnect()
      stop()
    }
  }, [])

  usePointerInput(rootRef)
  useImageDropPaste(rootRef)
  useKeyboardShortcuts()
  useLoadMe()

  return (
    <div
      ref={rootRef}
      className="canvas-root"
      data-draw-active={drawTool ? '' : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        cursor,
      }}
    >
      <BackgroundGrid />
      <div
        ref={worldRef}
        className="canvas-world"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <FrameLayer />
        <StrokesLayer />
        <ConnectionsLayer />
        <EntryLayer />
        <TagsLayer />
      </div>
      <PinnedAnchorBadge />
      <ConnectAnchorBadge />
      <CreateToolbar />
      <TeleportPanel />
      <TagPanel />
      <DashboardOverlay />
      <ZoomControls />
      <PositionReadout />
      <Minimap />
      <ConnectionEditor />
    </div>
  )
}
