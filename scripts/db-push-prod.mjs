// Pushes the Drizzle schema to the Neon main branch (production), from `.env.production.local`. Unlike `db:push`
// there's no --force: drizzle-kit shows every statement and asks before anything that loses data.
// drizzle.config.ts refuses unless NEON_BRANCH=main. Push to the dev branch and compare schemas first.
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "push"], {
  stdio: "inherit",
  env: { ...process.env, DRIZZLE_STRICT: "1" },
});
process.exit(result.status ?? 1);
