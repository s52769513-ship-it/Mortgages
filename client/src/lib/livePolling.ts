/**
 * Keeps a list or board current without a manual refresh.
 *
 * The internal chat and the notification bell already poll on their own
 * schedule — a conversation is read in real time, so it uses a short one.
 * A list page is read more slowly, but two people work the same pipeline at
 * once, and a stage another agent just moved a file to, or a task someone
 * else just closed, should not wait for the next click to appear. One shared
 * interval keeps that behaviour the same everywhere it applies, and gives it
 * one place to tune.
 *
 * Left off while the tab is in the background — nothing is gained by
 * refetching a screen nobody is looking at.
 */
export const LIST_POLL_MS = 20_000

export const livePoll = {
  refetchInterval: LIST_POLL_MS,
  refetchIntervalInBackground: false,
} as const
