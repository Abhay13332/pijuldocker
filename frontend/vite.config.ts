import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // Force all packages (including react-theme-switch-animation) to use
    // the same single React instance — prevents "Invalid hook call" errors.
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Forward all requests starting with /api to your backend
      '/api': {
        target: 'http://localhost:3001', // Update this to match your backend port
        changeOrigin: true,              // Changes the origin header to match the target URL
        secure: false,                   // Disables SSL verification for development HTTP
      }
    },
     allowedHosts: [
      'thirty-pigs-see.loca.lt'
    ] 
  }
})

