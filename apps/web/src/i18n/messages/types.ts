import type { Lang } from '../lang'

/** A single translatable message — BOTH languages are required, so a missing translation is a
 *  compile error (this is how we enforce "no missing keys" structurally, no runtime check needed). */
export type Msg = Record<Lang, string>

/** A namespace catalog: string key → message. Each namespace file `satisfies Catalog`. */
export type Catalog = Record<string, Msg>
