import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// proxies api calls to the backend on :8080, so `npm run dev` hits
// the same endpoints as production

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
        ws: true,
      },
      "/discussions": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/mail": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/status": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
