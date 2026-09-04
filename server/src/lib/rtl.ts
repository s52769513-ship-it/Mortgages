/**
 * Splitting a line into directional runs, so a right-to-left page can be
 * drawn on a PDF.
 *
 * The font layout engine shapes Hebrew correctly on its own — a Hebrew string
 * handed to it comes out the right way round. What it will not do is mix
 * directions: given "סכום 12345" it lays the whole line out right-to-left and
 * the number comes out as 54321. So each run is drawn as its own call, and the
 * caller places them from the right edge inward.
 */

const RTL = /[֐-׿יִ-ﭏ]/
const SPACE = /\s/
/** Punctuation takes the direction of what it follows, which keeps names whole. */
const NEUTRAL = /[.,:;!?'"״׳()[\]{}\-–—/\\|₪%*★•#]/

export type Run = { text: string; rtl: boolean }

/**
 * Returns the runs in logical order — first run first. Whitespace is kept as
 * its own run so the gap between two runs is drawn, not swallowed by one.
 */
export function runsOf(text: string): Run[] {
  const runs: Run[] = []

  for (const char of text) {
    const space = SPACE.test(char)
    const rtl = RTL.test(char)
    const neutral = NEUTRAL.test(char)
    const last = runs[runs.length - 1]
    const lastWasSpace = last ? SPACE.test(last.text[0]) : false

    if (space) {
      if (last && lastWasSpace) last.text += char
      else runs.push({ text: char, rtl: false })
      continue
    }

    if (last && !lastWasSpace && (neutral || last.rtl === rtl)) {
      last.text += char
      continue
    }

    runs.push({ text: char, rtl })
  }

  return runs
}
