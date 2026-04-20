import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /** נדרש ל־Electron (טעינת index.html מ־file:// אחרי build). */
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
