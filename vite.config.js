import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mapbox': ['mapbox-gl'],
          'framer': ['framer-motion'],
          'convex': ['convex', 'convex/react'],
          'better-auth': ['better-auth', '@convex-dev/better-auth'],
        },
      },
    },
  },
})
