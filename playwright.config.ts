import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:3000", viewport: { width: 1440, height: 960 }, headless: true },
  webServer: { command: "node --import tsx server/main.ts", url: "http://127.0.0.1:3000/health", reuseExistingServer: true },
  outputDir: "artifacts/browser-results",
  reporter: "list",
});
