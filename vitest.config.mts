import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { pool: "threads", maxWorkers: 2, environment: "node", include: ["tests/**/*.test.{ts,tsx}"], clearMocks: true } });
