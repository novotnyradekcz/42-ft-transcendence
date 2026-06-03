import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/users": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/games": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/discussions": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/mail": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
})
