import path from "node:path"
import { defineConfig } from "vitest/config"

// Integration tests start real InfluxDB containers via testcontainers, so they need a running
// Docker daemon and the first run pulls the images. Run with `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: [{ find: /^\.\.\/buildInfo\.cjs$/, replacement: path.resolve(import.meta.dirname, "dist/buildInfo.cjs") }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
