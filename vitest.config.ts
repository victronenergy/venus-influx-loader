import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      // server sources import the generated build info relative to their compiled location (dist/),
      // map that import to the generated file when running tests from src/
      { find: /^\.\.\/buildInfo\.cjs$/, replacement: path.resolve(__dirname, "dist/buildInfo.cjs") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
