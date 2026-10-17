import type { Stroke } from '../data/types'

// Uses the browser's built-in handwriting recognizer where one exists
// (Chrome on ChromeOS today). Elsewhere it returns null and the app asks
// for the text instead; on the Lenovo tablet you can write that with the pen
// too, using Gboard's handwriting input.
export async function recognize(strokes: Stroke[]): Promise<string | null> {
  const nav = navigator as any
  if (!nav.createHandwritingRecognizer || !strokes.length) return null
  try {
    const recognizer = await nav.createHandwritingRecognizer({ languages: ['en'] })
    const drawing = recognizer.startDrawing({ recognitionType: 'text' })
    for (const s of strokes) {
      if (s.tool !== 'pen') continue
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
