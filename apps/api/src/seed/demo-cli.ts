/**
 * Fill a running instance with a synthetic demo board — for screenshots, demos and trying the
 * canvas without typing everything yourself. Talks to the HTTP API like the web app does, so every
 * item goes through the same validation.
 *
 *   SEED_URL=http://localhost:8080 SEED_EMAIL=admin@example.com SEED_PASSWORD=… pnpm db:seed-demo
 *
 * SEED_EMAIL / SEED_PASSWORD default to ADMIN_EMAIL / ADMIN_PASSWORD. The content is added to the
 * user's default board; run it on an empty board (it does not deduplicate). Better Auth checks the
 * Origin header in production: it is the origin of SEED_URL unless SEED_ORIGIN says otherwise
 * (needed when SEED_URL points at the api container directly instead of the public address).
 */

type Json = Record<string, unknown>

const base = (process.env.SEED_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const email = process.env.SEED_EMAIL ?? process.env.ADMIN_EMAIL ?? ''
const password = process.env.SEED_PASSWORD ?? process.env.ADMIN_PASSWORD ?? ''
const origin = new URL(process.env.SEED_ORIGIN ?? base).origin

let cookie = ''

async function call(method: string, path: string, body?: Json): Promise<Json> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', origin, cookie },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${base}${path}`, init)
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as Json) : {}
}

const paragraph = (text: string): Json => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const heading = (text: string): Json => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
})

/** A hand-drawn-looking loop around a rectangle: points with a little wobble and pressure. */
function loop(x: number, y: number, w: number, h: number): number[][] {
  const pts: number[][] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const wobble = 1 + Math.sin(a * 5) * 0.03
    pts.push([
      Math.round(x + w / 2 + Math.cos(a) * (w / 2) * wobble),
      Math.round(y + h / 2 + Math.sin(a) * (h / 2) * wobble),
      0.5,
    ])
  }
  return pts
}

async function main(): Promise<void> {
  if (!email || !password) {
    throw new Error('set SEED_EMAIL and SEED_PASSWORD (or ADMIN_EMAIL and ADMIN_PASSWORD)')
  }
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password }),
  })
  if (!signIn.ok) {
    throw new Error(`sign-in failed: ${signIn.status}`)
  }
  cookie = signIn.headers.get('set-cookie')?.split(';')[0] ?? ''
  const me = await call('GET', '/api/me')
  const b = `/api/boards/${String(me.defaultBoardId)}`

  const entry = async (
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    content: Json,
    color?: string,
  ): Promise<string> => {
    const created = await call('POST', `${b}/entries`, {
      type,
      x,
      y,
      width,
      height,
      content,
      color: color ?? null,
      visibility: 'public',
    })
    return String(created.id)
  }

  // --- A trip -------------------------------------------------------------------------------
  await call('POST', `${b}/frames`, {
    name: 'Trip to the coast',
    x: -60,
    y: -90,
    width: 1200,
    height: 800,
  })
  const trip = await entry(
    'sticky',
    0,
    0,
    240,
    240,
    { text: 'Coast trip\nlast week of May' },
    'yellow',
  )
  const route = await entry('doc', 320, 0, 400, 520, {
    doc: {
      type: 'doc',
      content: [
        heading('Route'),
        paragraph('Day 1 — train to the harbour town, ferry at 16:10.'),
        paragraph('Day 2 — lighthouse walk, 14 km along the cliffs.'),
        paragraph('Day 3 — rest, market in the morning, swim in the afternoon.'),
      ],
    },
  })
  const packing = await entry('checklist', 0, 300, 300, 330, {
    items: [
      { id: 'p1', text: 'Rain jacket', checked: true },
      { id: 'p2', text: 'Hiking boots', checked: true },
      { id: 'p3', text: 'Ferry tickets', checked: false },
      { id: 'p4', text: 'Sun cream', checked: false },
      { id: 'p5', text: 'Book for the train', checked: false },
    ],
  })
  const ferry = await entry('link', 780, 40, 320, 220, {
    url: 'https://example.com/ferry-timetable',
    title: 'Ferry timetable',
    description: 'Crossings every two hours in summer.',
    siteName: 'example.com',
  })
  await entry('sticky', 780, 330, 240, 240, { text: 'Book the hut early!' }, 'pink')
  await call('POST', `${b}/connections`, { fromEntryId: trip, toEntryId: route })
  await call('POST', `${b}/connections`, { fromEntryId: route, toEntryId: ferry, label: 'day 1' })
  await call('POST', `${b}/connections`, { fromEntryId: trip, toEntryId: packing })
  await call('POST', `${b}/strokes`, {
    points: loop(755, 305, 290, 290),
    color: '#dc2626',
    size: 6,
  })

  // --- A recipe -----------------------------------------------------------------------------
  await call('POST', `${b}/frames`, {
    name: 'Sunday baking',
    x: 1180,
    y: -90,
    width: 800,
    height: 800,
  })
  const cake = await entry('sticky', 1220, 0, 240, 240, { text: 'Plum cake\nfor Sunday' }, 'orange')
  const recipe = await entry('doc', 1520, 0, 400, 520, {
    doc: {
      type: 'doc',
      content: [
        heading('Plum cake'),
        paragraph('500 g plums, halved · 250 g flour · 125 g butter · 100 g sugar · 2 eggs.'),
        paragraph('Cream butter and sugar, add eggs, fold in flour. Spread, top with plums.'),
        paragraph('40 minutes at 180 °C. Cinnamon sugar on top while still warm.'),
      ],
    },
  })
  const shopping = await entry('checklist', 1220, 300, 260, 280, {
    items: [
      { id: 's1', text: 'Plums', checked: false },
      { id: 's2', text: 'Butter', checked: true },
      { id: 's3', text: 'Cinnamon', checked: false },
    ],
  })
  await call('POST', `${b}/connections`, { fromEntryId: cake, toEntryId: recipe })
  await call('POST', `${b}/connections`, { fromEntryId: recipe, toEntryId: shopping, label: 'buy' })

  // --- A small project ----------------------------------------------------------------------
  await call('POST', `${b}/frames`, {
    name: 'Garden shed project',
    x: -60,
    y: 760,
    width: 2040,
    height: 860,
  })
  const columns = ['To do', 'Doing', 'Done']
  const cards: string[][] = [
    ['Measure the plot', 'Order timber', 'Ask about the permit'],
    ['Draw the plan'],
    ['Clear the corner', 'Pick a colour'],
  ]
  const colors = ['blue', 'green', 'purple']
  for (const [i, title] of columns.entries()) {
    const x = i * 660
    await entry('sticky', x, 820, 300, 100, { text: title }, colors[i])
    for (const [j, text] of (cards[i] ?? []).entries()) {
      await entry(
        'sticky',
        x + (j % 2) * 300,
        950 + Math.floor(j / 2) * 270,
        260,
        240,
        { text },
        'yellow',
      )
    }
  }

  process.stdout.write(`demo board filled: ${origin}/b/${String(me.defaultBoardId)}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
