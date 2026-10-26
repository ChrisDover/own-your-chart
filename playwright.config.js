import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.js",
  use: {
    baseURL: "http://127.0.0.1:8766",
    viewport: { width: 1440, height: 1100 },
  },
  webServer: {
    command: "npm run build && PORT=8766 python3 server.py",
    url: "http://127.0.0.1:8766",
    reuseExistingServer: false,
  },
  workers: 1,
});
