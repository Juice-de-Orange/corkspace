#!/usr/bin/env node
/**
 * Fail the build if any FOCUSED test (`describe.only` / `it.only` / `test.only` / `bench.only`,
 * or Jasmine-style `fdescribe(` / `fit(`) is committed — a stray `.only` silently disables every
 * other test in its file and is a classic way for a regression to slip through green CI.
 *
 * NB: `.skip` is deliberately NOT banned here — Playwright's conditional `test.skip(condition,
 * reason)` (e.g. the mobile-only skips) is legitimate and grep can't tell it apart from a static
 * skip. Wired into `pnpm verify` (see package.json). Portable (Windows + Linux).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['apps', 'packages']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage', 'test-results', '.vite'])
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/
const FOCUS = /\b(describe|it|test|bench)\.only\b|\bf(describe|it)\s*\(/

const offenders = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) {
      continue
    }
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      walk(p)
    } else if (TEST_FILE.test(name)) {
      const lines = readFileSync(p, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (FOCUS.test(line)) {
          offenders.push(`${p}:${i + 1}: ${line.trim()}`)
        }
      })
    }
  }
}

for (const root of ROOTS) {
  walk(root)
}

if (offenders.length > 0) {
  console.error('✗ focused test(s) found — remove .only / fdescribe / fit:')
  for (const o of offenders) {
    console.error(`  ${o}`)
  }
  process.exit(1)
}
console.log('✓ no focused tests')
