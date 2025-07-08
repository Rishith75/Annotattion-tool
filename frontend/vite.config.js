import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // or use '0.0.0.0'
    port: 5173,       // default, can change if needed
    strictPort: true, // prevents random fallback ports
  },
})
