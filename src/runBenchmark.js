import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { getPlatform, BENCH_ITERATIONS, CONCURRENCY_LEVELS, DATASET_PATH } from "./config.js";
import { runTraversalWorkload, runLookupWorkload, runAggregationWorkload } from "./workloads/readWorkloads.js";
import { runMixedWorkload } from "./workloads/mixedWorkload.js";

// Usage: node src/runBenchmark.js <platformKey>
const platformKey = process.argv[2];
if (!platformKey) {
  console.error("Usage: node src/runBenchmark.js <platformKey>  (cognodb|neo4j|memgraph|arangodb|tigergraph)");
  process.exit(1);
}

const platform = getPlatform(platformKey);
const adapter = platform.build();

function loadNodeMeta() {
  const raw = fs.readFileSync(path.join(DATASET_PATH, "nodes.csv"), "utf8");
  const rows = parse(raw, { columns: true, cast: true });
  return {
    nodeCount: rows.length,
    ages: [...new Set(rows.map((r) => r.age))],
  };
}

async function main() {
  const { nodeCount, ages } = loadNodeMeta();

  console.log(`Connecting to ${platform.label}...`);
  await adapter.connect();
  await adapter.ping();
  console.log(`Connected. Running benchmark with ${BENCH_ITERATIONS} iterations/workload...`);

  console.log("-> Traversal (1/2/3 hop)...");
  const traversal = await runTraversalWorkload(adapter, nodeCount, BENCH_ITERATIONS);

  console.log("-> Point + indexed lookup...");
  const lookups = await runLookupWorkload(adapter, nodeCount, ages, BENCH_ITERATIONS);

  console.log("-> Aggregation...");
  const aggregation = await runAggregationWorkload(adapter, Math.min(BENCH_ITERATIONS, 30));

  console.log(`-> Mixed workload sweep at concurrency ${CONCURRENCY_LEVELS.join(", ")}...`);
  const mixed = [];
  for (const c of CONCURRENCY_LEVELS) {
    console.log(`   concurrency=${c}`);
    mixed.push(await runMixedWorkload(adapter, nodeCount, { concurrency: c, durationMs: 5000, readRatio: 0.8 }));
  }

  console.log("-> Footprint...");
  const footprint = await adapter.footprint().catch((e) => ({ note: `error: ${e.message}` }));

  const output = {
    platform: platform.label,
    specs: platform.specs,
    iterations: BENCH_ITERATIONS,
    traversal,
    lookups,
    aggregation,
    mixedWorkload: mixed,
    footprint,
    ranAt: new Date().toISOString(),
  };

  fs.mkdirSync("results", { recursive: true });
  const outPath = path.join("results", `${platformKey}-benchmark.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${outPath}`);

  await adapter.close();
}

main().catch(async (err) => {
  console.error(`[${platformKey}] FAILED:`, err);
  await adapter.close().catch(() => {});
  process.exit(1);
});
