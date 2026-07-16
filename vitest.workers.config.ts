import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["test/int/**/*.int.test.ts"],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2025-01-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          kvNamespaces: ["SETTINGS"],
          bindings: {
            ACCESS_KEY: "test-access-key",
          },
        },
      },
    },
  },
});
