import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies API calls to the dockerised backend on :8080, so
// `npm run dev` (hot-reload) works against the same endpoints as production.
// Avatars are plain URLs stored in the DB, so there is no upload/file-storage
// middleware here; static assets like /images/profile.png come from public/.
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
    },
  },
});
