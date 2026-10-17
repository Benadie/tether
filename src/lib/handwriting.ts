import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Stroke } from '../data/types'

// Handwriting -> text.
// In the Android app: Google ML Kit Digital Ink (HandwritingPlugin.java). The
// English model downloads once (~20 MB) and then works offline, on the tablet.
// In a browser: Chrome's built-in recognizer where it exists (ChromeOS), else nothing.

interface HandwritingPlugin {
  prepare(): Promise<{ ready: boolean }>
  recognize(options: { strokes: number[][]; width: number; height: number }): Promise<{ text: string; candidates: string[] }>
}

const Native = registerPlugin<HandwritingPlugin>('Handwriting')
const native = Capacitor.isNativePlatform()

export type HandwritingStatus = 'unavailable' | 'downloading' | 'ready' | 'error'

let status: HandwritingStatus = native ? 'downloading' : 'unavailable'
let lastError = ''
let preparing: Promise<boolean> | null = null
const listeners = new Set<() => void>()
const setStatus = (s: HandwritingStatus) => {
  status = s
  listeners.forEach((fn) => fn())
}

/** Downloads the model the first time (needs internet once). Safe to call repeatedly. */
export function prepareHandwriting(): Promise<boolean> {
  if (!native) return Promise.resolve(false)
  if (status === 'ready') return Promise.resolve(true)
  if (!preparing) {
    setStatus('downloading')
    preparing = Native.prepare()
      .then(() => {
        setStatus('ready')
        return true
      })
      .catch((e) => {
        lastError = e?.message ?? String(e)
        setStatus('error')
        preparing = null // allow a retry later (e.g. back online)
        return false
      })
  }
  return preparing
}

export function useHandwritingStatus() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return { status, error: lastError }
}

/** True where handwriting can be read: the Android app, or a browser with a built-in recognizer. */
export const handwritingAvailable = () => native || 'createHandwritingRecognizer' in navigator

const xyOnly = (points: number[]) => points.filter((_, i) => i % 3 !== 2)

/** Text for a line's pen strokes, or null if nothing could be read. */
export async function recognize(strokes: Stroke[], height = 50): Promise<string | null> {
  const pen = strokes.filter((s) => s.tool === 'pen' && s.points.length >= 3)
  if (!pen.length) return null

  if (native) {
    if (!(await prepareHandwriting())) return null
    let width = 0
    for (const s of pen) for (let i = 0; i < s.points.length; i += 3) width = Math.max(width, s.points[i])
    try {
      const r = await Native.recognize({ strokes: pen.map((s) => xyOnly(s.points)), width: width + 20, height })
      return r.text.trim() || null
    } catch {
      return null
    }
  }

  const nav = navigator as any
  if (!nav.createHandwritingRecognizer) return null
  try {
    const recognizer = await nav.createHandwritingRecognizer({ languages: ['en'] })
    const drawing = recognizer.startDrawing({ recognitionType: 'text' })
    for (const s of pen) {
      const stroke = new (window as any).HandwritingStroke()
      for (let i = 0; i < s.points.length; i += 3) stroke.addPoint({ x: s.points[i], y: s.points[i + 1], t: i })
      drawing.addStroke(stroke)
    }
    const [best] = await drawing.getPrediction()
    recognizer.finish()
    return best?.text ?? null
  } catch {
    return null
  }
}
