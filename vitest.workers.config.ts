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
          r2Buckets: ["RECEIPTS"],
          bindings: {
            GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            APP_URL: "http://localhost:8788",
          },
        },
      },
    },
  },
});
