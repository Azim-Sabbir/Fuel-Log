// Module augmentation for the `cloudflare:test` virtual module provided by
// `@cloudflare/vitest-pool-workers`.
//
// This file is intentionally a *module* (it has a top-level `import`). Module
// augmentation via `declare module` requires the containing file to be a
// module, and is the officially-supported way to type the pool's `env` — see
// the JSDoc in `@cloudflare/vitest-pool-workers/types/cloudflare-test.d.ts`,
// which documents `interface ProvidedEnv extends Env {}`.
//
// The `*?raw` wildcard ambient declarations live in `raw-imports.d.ts` instead,
// because those must be in a *global* (non-module) file to apply.

/// <reference types="@cloudflare/vitest-pool-workers" />

import type { Env } from "../lib/env";

declare module "cloudflare:test" {
  // Types `env` (and `createPagesEventContext`, etc.) against the project's Env,
  // so `env.DB` / `env.SETTINGS` / `env.ACCESS_KEY` resolve.
  interface ProvidedEnv extends Env {}
}
