import { useEffect, useRef, useState } from 'react'

/**
 * Records a voice note from the microphone.
 *
 * The chat and the lead intake form both take recordings, so the microphone
 * handling lives here once: permission, the elapsed clock, discarding a
 * misclick, and releasing the device afterwards — a stream left open keeps
 * the browser's recording indicator lit, which alarms people.
 */

/** Below this, a press-and-release is a slip rather than a recording. */
const TOO_SHORT_MS = 700

export type Recording = { file: File; durationMs: number }

export function useVoiceRecorder(onDone: (recording: Recording) => void) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [denied, setDenied] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const discardRef = useRef(false)
  // Kept in a ref so a stop handler set up on start still calls the latest one.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Ticks while recording, so it is obvious something is happening.
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => clearInterval(timer)
  }, [recording])

  // A component unmounting mid-recording must not leave the microphone open.
  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      discardRef.current = false
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        stream.getTracks().forEach((t) => t.stop())

        if (discardRef.current || durationMs < TOO_SHORT_MS) return

        const extension = type.includes('mp4') ? 'm4a' : 'webm'
        onDoneRef.current({
          file: new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type }),
          durationMs,
        })
      }

      recorder.start()
      recorderRef.current = recorder
      setElapsed(0)
      setDenied(false)
      setRecording(true)
    } catch {
      setDenied(true)
    }
  }

  const finish = (discard = false) => {
    discardRef.current = discard
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
  }

  return {
    recording,
    /** Milliseconds since the recording started. */
    elapsed,
    /** True when the browser refused the microphone. */
    denied,
    start,
    stop: () => finish(false),
    cancel: () => finish(true),
  }
}
