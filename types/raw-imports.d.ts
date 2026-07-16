// Global ambient declarations for Vite's `?raw` import suffix, used by the test
// helpers to load SQL migrations as strings (e.g.
// `import schema from "../../migrations/0001_init.sql?raw"`).
//
// This file MUST remain global (no top-level `import`/`export`); a top-level
// import would turn it into a module and these wildcard ambient declarations
// would stop applying.

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*?raw" {
  const content: string;
  export default content;
}
