// Prints this week's Slack post for the GSB High Tech Club: what's open, closing, expected, and GSB dates.
//   npm run digest                       # as of today (your clock)
//   npm run digest -- --date 2026-10-11  # as of another day
// The logic lives in src/lib/digest.ts (tested in digest.test.ts). This loads it through Vite, which vitest
// already brings, so the TypeScript and the @/ imports resolve as they do in the app.
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--date");
const now = new Date();
const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const today = at >= 0 ? args[at + 1] : local;
if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? "") || Number.isNaN(Date.parse(today))) {
  console.error("Usage: npm run digest [-- --date YYYY-MM-DD]");
  process.exit(1);
}

const load = (id) => runnerImport(id, { root, configFile: false, logLevel: "error", resolve: { alias: { "@": `${root}src` } } }).then((r) => r.module);
const [{ digest }, { companies, hiring, calendar, meta }] = await Promise.all([load("/src/lib/digest.ts"), load("/src/data/index.ts")]);
console.log(digest({ companies, hiring, calendar, cycle: meta.currentCycle, researched: meta.researched, today }));
