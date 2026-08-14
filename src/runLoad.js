import fs from "fs";
import path from "path";
import { getPlatform, DATASET_PATH } from "./config.js";
import { loadDataset } from "./loader.js";

// Usage: node src/runLoad.js <platformKey>
// e.g.   node src/runLoad.js cognodb
const platformKey = process.argv[2];
if (!platformKey) {
  console.error("Usage: node src/runLoad.js <platformKey>  (cognodb|neo4j|memgraph|arangodb|tigergraph)");
  process.exit(1);
}

const platform = getPlatform(platformKey);
const adapter = platform.build();

async function main() {
  console.log(`Connecting to ${platform.label}...`);
  await adapter.connect();
  await adapter.ping();
  console.log("Connected. Starting load...");

  const metrics = await loadDataset(adapter, DATASET_PATH);
  console.log(`\n[${platform.label}] Load complete:`, metrics);

  fs.mkdirSync("results", { recursive: true });
  const outPath = path.join("results", `${platformKey}-load.json`);
  fs.writeFileSync(outPath, JSON.stringify({ platform: platform.label, specs: platform.specs, ...metrics }, null, 2));
  console.log(`Saved to ${outPath}`);

  await adapter.close();
}

main().catch(async (err) => {
  console.error(`[${platformKey}] FAILED:`, err);
  await adapter.close().catch(() => {});
  process.exit(1);
});
