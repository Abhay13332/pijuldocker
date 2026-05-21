import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Forward all requests starting with /api to your backend
      '/api': {
        target: 'http://localhost:3001', // Update this to match your backend port
        changeOrigin: true,              // Changes the origin header to match the target URL
        secure: false,                   // Disables SSL verification for development HTTP
      }
    } 
  }
})
