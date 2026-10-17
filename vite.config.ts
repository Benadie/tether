import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import pkg from './package.json' with { type: 'json' }

// `npm run dev:tablet` serves over HTTPS on your local network so the tablet can
// open it (the pen, install-as-app and Outlook sign-in all need a secure origin).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'tablet' ? [basicSsl()] : [])],
  // The version in package.json is the app version (the APK's too); the update check compares against it.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // File-change events were being missed on this PC; polling makes reloads reliable.
  server: { watch: { usePolling: true, interval: 300 } },
}))
