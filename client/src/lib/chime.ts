/**
 * A short two-note chime, synthesised rather than loaded, so there is no asset
 * to ship and nothing to fetch before it can play.
 */

const MUTE_KEY = 'mortgages.notificationSound'

export const soundPreference = {
  muted: () => {
    try {
      return localStorage.getItem(MUTE_KEY) === 'off'
    } catch {
      return false
    }
  },
  set: (enabled: boolean) => {
    try {
      localStorage.setItem(MUTE_KEY, enabled ? 'on' : 'off')
    } catch {
      /* storage unavailable — the choice just will not persist */
    }
  },
}

let context: AudioContext | null = null

function audioContext() {
  if (context) return context
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

function note(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  // Shaped rather than switched, so it reads as a chime and not a click.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.12, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

/** Plays the chime unless it is muted. Never throws — sound is not essential. */
export function playChime() {
  if (soundPreference.muted()) return

  try {
    const ctx = audioContext()
    if (!ctx) return

    // A tab that has never been interacted with starts suspended.
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    note(ctx, 880, now, 0.16)
    note(ctx, 1174.7, now + 0.09, 0.22)
  } catch {
    /* autoplay policy, or no audio device — not worth surfacing */
  }
}
