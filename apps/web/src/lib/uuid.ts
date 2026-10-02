/** RFC-4122-shaped id check — keeps optimistic temp ids (`temp-*`) out of API payloads that
 *  validate `z.string().uuid()` server-side. */
export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
