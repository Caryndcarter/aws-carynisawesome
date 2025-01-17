import path from "path";
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app"),
      "~": path.resolve(__dirname, "app"),
    },
  },
  test: {
    dir: "packages/nuxt",
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.js"],
  },
});
