import { defineConfig } from "@playwright/test";

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";
const useWebServer = process.env.PLAYWRIGHT_USE_WEBSERVER !== "0";

export default defineConfig({
  testDir: "./apps/web-client/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/ui/playwright-report", open: "never" }]
  ],
  outputDir: "artifacts/ui/test-results",
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: chromiumExecutablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    }
  },
  webServer: useWebServer
    ? {
        command: "npm --workspace @warprotocol/web-client run dev -- --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
    : undefined
});
