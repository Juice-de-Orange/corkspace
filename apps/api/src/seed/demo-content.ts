/**
 * The synthetic demo board: a trip, a recipe and a small project, tied together with red threads.
 * Written against the HTTP API (`call`), so every item goes through the same validation as the web
 * app. Used by `pnpm db:seed-demo` (over the network) and by the demo mode (in-process, to build
 * the template board every visitor gets a copy of).
 */

export type Json = Record<string, unknown>

/** One API call: method, path below the origin, optional JSON body → the parsed JSON answer. */
export type ApiCall = (method: string, path: string, body?: Json) => Promise<Json>

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

/** Fill the board `boardId` with the demo content. Run it on an empty board (no deduplication). */
export async function seedDemoBoard(call: ApiCall, boardId: string): Promise<void> {
  const b = `/api/boards/${boardId}`

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
}
