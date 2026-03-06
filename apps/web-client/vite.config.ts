import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["e2e/**"]
  },
  server: {
    port: 5173,
    fs: {
      allow: ["../.."]
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true
  }
});
