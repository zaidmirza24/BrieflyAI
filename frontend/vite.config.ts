import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        // 8000 has a stuck OS-level listener on this machine that can't be
        // killed (shows in netstat, not in any process list) -- using 8001
        // instead. If your machine doesn't have that problem, change this
        // back to 8000 and run `uvicorn api.main:app --reload --port 8000`.
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
