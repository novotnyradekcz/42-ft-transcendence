import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom provides browser globals: btoa, atob, localStorage, fetch (mockable)
    environment: "jsdom",
  },
});
