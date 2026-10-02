import { isUuid } from '../../lib/uuid'

/**
 * Whether a red-thread connection from→to may be created: the two entries must be DISTINCT, both
 * PERSISTED (uuid ids — a just-created temp entry can't be connected until it saves), and not
 * ALREADY connected. `connectionExists` is injected so this stays pure/testable. */
export function canCreateConnection(
  from: string,
  to: string,
  connectionExists: (a: string, b: string) => boolean,
): boolean {
  return from !== to && isUuid(from) && isUuid(to) && !connectionExists(from, to)
}
