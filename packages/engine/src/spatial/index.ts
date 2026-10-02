import type { Camera, Rect, ScreenSize, WorldRect } from '@corkspace/shared/kernel'
import RBush from 'rbush'
import { viewportWorldRect } from '../camera/convert'
import { rectInflate } from '../coords/rect'

interface Leaf {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

/**
 * rbush wrapper used for BOTH viewport culling and collision broad-phase. Stores the exact
 * inserted leaf per id (in a Map) so `remove`/`update` pass rbush the reference-equal object.
 */
export class SpatialIndex {
  private readonly tree = new RBush<Leaf>()
  private readonly leaves = new Map<string, Leaf>()

  private static toLeaf(id: string, r: WorldRect): Leaf {
    return { id, minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h }
  }

  get size(): number {
    return this.leaves.size
  }

  insert(id: string, rect: WorldRect): void {
    this.remove(id)
    const leaf = SpatialIndex.toLeaf(id, rect)
    this.tree.insert(leaf)
    this.leaves.set(id, leaf)
  }

  /** Insert or move an item by id. */
  update(id: string, rect: WorldRect): void {
    this.insert(id, rect)
  }

  remove(id: string): void {
    const leaf = this.leaves.get(id)
    if (!leaf) {
      return
    }
    this.tree.remove(leaf)
    this.leaves.delete(id)
  }

  clear(): void {
    this.tree.clear()
    this.leaves.clear()
  }

  /** Bulk-load fresh items (fast). Intended for an initial, empty index. */
  bulkLoad(items: ReadonlyArray<{ id: string; rect: WorldRect }>): void {
    const leaves = items.map(({ id, rect }) => SpatialIndex.toLeaf(id, rect))
    this.tree.load(leaves)
    for (const leaf of leaves) {
      this.leaves.set(leaf.id, leaf)
    }
  }

  /** Ids whose bbox intersects a (world-space) rect. */
  searchRect(rect: Rect): string[] {
    return this.tree
      .search({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h })
      .map((l) => l.id)
  }

  /** Ids visible in the current viewport, optionally inflated by an overscan margin (screen px). */
  visibleIds(camera: Camera, viewport: ScreenSize, overscanScreenPx = 0): string[] {
    const view = viewportWorldRect(camera, viewport)
    const overscanWorld = overscanScreenPx / camera.zoom
    return this.searchRect(rectInflate(view, overscanWorld))
  }
}
