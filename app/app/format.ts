// Turning numbers and dates into words, and nothing else.
//
// Everything here is presentation. Nothing in this file decides anything:
// there is no threshold, no comparison against the buffer, no "is this near",
// no rounding that could move a distance across a boundary in the reader's
// mind. server/search.ts decided; this file only says what it decided.
//
// That separation is deliberate. Phase 3's handoff note puts it plainly: a
// renderer that derives "no flags means fine" is the failure the result type's
// compile-time gate exists to prevent -- the type cannot construct a
// clearance, but a renderer can still write one as a sentence. So the renderer
// is given no arithmetic to do beyond unit conversion.

/** Metres per foot, exactly, by international definition since 1959. */
const METRES_PER_FOOT = 0.3048;

function round(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

/** e.g. `128.4 m`. One decimal: the measurement is not more precise than that. */
export function metres(value: number): string {
  return `${round(value, 1).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} m`;
}

/**
 * e.g. `128.4 m (421 feet)`.
 *
 * Both units, always, because the statute is written in feet and the
 * measurement is made in metres, and a reader taking this to a sheriff's
 * office should not have to convert anything in their head to be understood.
 */
export function metresAndFeet(value: number): string {
  const feet = Math.round(value / METRES_PER_FOOT);
  return `${metres(value)} (${feet.toLocaleString("en-US")} feet)`;
}

/**
 * Where a measured distance sits on the buffer scale, as a fraction in [0,1].
 *
 * This is presentation, in the same sense `metresAndFeet` is: it converts a
 * number the server already decided into something a reader can take in at a
 * glance. It compares nothing and concludes nothing -- 1 means "at or past the
 * buffer", not "outside it", and the caller has no way to turn this into a
 * sentence. The finding was made in server/search.ts and lives in the result's
 * `kind`; the only thing this positions is a mark on a line.
 *
 * The clamp is deliberate. A premises measured beyond the buffer would push
 * the mark off the end of the drawing, and a drawing that runs off its own
 * axis is read as a rendering fault rather than as a distance.
 */
export function bufferFraction(value: number, bufferMetres: number): number {
  if (!(bufferMetres > 0)) return 1;
  return Math.min(1, Math.max(0, value / bufferMetres));
}

/** e.g. `4 August 2026`. Dates only -- a time of day would be a timestamp. */
export function day(iso: string | null): string | null {
  if (iso === null) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function count(value: number): string {
  return value.toLocaleString("en-US");
}

/** `1 school premises` / `3 school premises` -- the noun does not inflect. */
export function plural(n: number, singular: string, many: string): string {
  return n === 1 ? singular : many;
}
