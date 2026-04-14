import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude Playwright browser tests while preserving Vitest's default exclusions
    exclude: [...configDefaults.exclude, "tests/browser/**"],
  },
});
