import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.dirname(fileURLToPath(import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      out.push(...sourceFiles(p))
    } else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
      out.push(p)
    }
  }
  return out
}

describe('engine modularity (CLAUDE.md §10)', () => {
  const files = sourceFiles(SRC)
  const forbidsAppLayers = /from\s+['"]@corkspace\/(api|db|web)(\/|['"])/
  const forbidsSharedRoot = /from\s+['"]@corkspace\/shared['"]/

  it('scans a non-trivial set of source files', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('imports nothing from api/db/web', () => {
    for (const f of files) {
      expect(
        forbidsAppLayers.test(readFileSync(f, 'utf8')),
        `${path.basename(f)} imports an app layer`,
      ).toBe(false)
    }
  })

  it('only imports the dependency-free @corkspace/shared/kernel subpath (never the root)', () => {
    for (const f of files) {
      expect(
        forbidsSharedRoot.test(readFileSync(f, 'utf8')),
        `${path.basename(f)} imports @corkspace/shared root`,
      ).toBe(false)
    }
  })
})
