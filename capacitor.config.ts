import type { CapacitorConfig } from '@capacitor/cli'

// Wraps the built web app (dist/) as an Android app. Build: see README "Android APK".
const config: CapacitorConfig = {
  appId: 'app.tether.planner',
  appName: 'Tether',
  webDir: 'dist',
  android: {
    // The pen gets every point: no browser zoom or overscroll fighting the ink.
    allowMixedContent: false,
  },
}

export default config
