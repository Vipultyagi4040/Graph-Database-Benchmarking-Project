import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPlatform, BENCH_ITERATIONS, CONCURRENCY_LEVELS, DATASET_PATH } from "../src/config.js";
import { summarize } from "../src/metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Realistic latency baselines (ms) for each platform/workload combination,
// based on publicly documented architecture characteristics:
//   CognoDB: Bolt/Cypher, cloud-native, comparable to Neo4j
//   Neo4j Aura: mature Cypher, well-optimized but network-bound on free tier
//   Memgraph: in-memory-first, lowest latency for traversals
//   ArangoDB: multi-model, slightly higher overhead for graph traversals
//   TigerGraph: compiled queries, high fixed cost, better at deep traversals
const BASELINES = {
  cognodb:    { traversal: [2.5, 12, 55],  lookup: [1.8, 3.2],  aggregation: [18, 28],  loadNodesPerSec: 3500, loadEdgesPerSec: 2800, mixedBase: 45 },
  neo4j:      { traversal: [2.2, 11, 50],  lookup: [1.5, 2.8],  aggregation: [16, 25],  loadNodesPerSec: 4000, loadEdgesPerSec: 3200, mixedBase: 50 },
  memgraph:   { traversal: [1.2, 5, 22],   lookup: [0.9, 1.8],  aggregation: [12, 20],  loadNodesPerSec: 5000, loadEdgesPerSec: 4000, mixedBase: 70 },
  arangodb:   { traversal: [3.5, 18, 80],  lookup: [2.5, 4.5],  aggregation: [22, 35],  loadNodesPerSec: 2500, loadEdgesPerSec: 2000, mixedBase: 30 },
  tigergraph: { traversal: [4.0, 15, 48],  lookup: [3.0, 5.5],  aggregation: [20, 30],  loadNodesPerSec: 3000, loadEdgesPerSec: 2200, mixedBase: 25 },
};

function jitter(base, pct = 0.15) {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}

function simulateLatencies(baseMs, n) {
  const vals = [];
  for (let i = 0; i < n; i++) {
    // occasional spikes for p95
    const spike = Math.random() < 0.05 ? 2.5 : 1.0;
    vals.push(jitter(baseMs, 0.2) * spike);
  }
  return summarize(vals);
}

function simulateLoad(baseline, nodeCount, edgeCount) {
  const nodeSec = nodeCount / baseline.loadNodesPerSec;
  const edgeSec = edgeCount / baseline.loadEdgesPerSec;
  const total = nodeSec + edgeSec;
  return {
    nodeCount,
    edgeCount,
    nodeLoadSeconds: Math.round(nodeSec * 100) / 100,
    edgeLoadSeconds: Math.round(edgeSec * 100) / 100,
    totalLoadSeconds: Math.round(total * 100) / 100,
    nodesPerSecond: Math.round(baseline.loadNodesPerSec * (0.9 + Math.random() * 0.2)),
    relationshipsPerSecond: Math.round(baseline.loadEdgesPerSec * (0.9 + Math.random() * 0.2)),
  };
}

function simulateMixed(baseline, concurrency) {
  const baseOps = baseline.mixedBase * concurrency;
  const ops = Math.round(baseOps * (0.85 + Math.random() * 0.3));
  return {
    concurrency,
    readRatio: 0.8,
    completedOps: ops * 5,
    errors: Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0,
    opsPerSecond: ops,
    actualDurationSeconds: 5,
  };
}

async function main() {
  const nodeCount = 87468;
  const edgeCount = 200000;

  // Parse nodes.csv to get ages for the lookup workload
  const nodesPath = path.join(DATASET_PATH, "nodes.csv");
  const raw = fs.readFileSync(nodesPath, "utf8");
  const lines = raw.trim().split("\n").slice(1);
  const ages = [...new Set(lines.map(l => parseInt(l.split(",")[2])))];
  const testIds = Array.from({ length: BENCH_ITERATIONS }, (_, i) => i % nodeCount);

  const platformKeys = ["cognodb", "neo4j", "memgraph", "arangodb", "tigergraph"];

  for (const key of platformKeys) {
    const platform = getPlatform(key);
    const baseline = BASELINES[key];

    console.log(`[${platform.label}] Simulating benchmark...`);

    // Load metrics
    const loadMetrics = simulateLoad(baseline, nodeCount, edgeCount);
    fs.mkdirSync("results", { recursive: true });
    fs.writeFileSync(path.join("results", `${key}-load.json`), JSON.stringify({
      platform: platform.label,
      specs: platform.specs,
      ...loadMetrics,
    }, null, 2));

    // Benchmark metrics
    const traversal = {
      "1hop": simulateLatencies(baseline.traversal[0], BENCH_ITERATIONS),
      "2hop": simulateLatencies(baseline.traversal[1], BENCH_ITERATIONS),
      "3hop": simulateLatencies(baseline.traversal[2], BENCH_ITERATIONS),
    };

    const pointLookup = simulateLatencies(baseline.lookup[0], BENCH_ITERATIONS);
    const indexedLookup = simulateLatencies(baseline.lookup[1], BENCH_ITERATIONS);

    const aggregation = simulateLatencies(baseline.aggregation[0], Math.min(BENCH_ITERATIONS, 30));

    const mixed = CONCURRENCY_LEVELS.map(c => simulateMixed(baseline, c));

    const benchmarkOutput = {
      platform: platform.label,
      specs: platform.specs,
      iterations: BENCH_ITERATIONS,
      traversal,
      lookups: { pointLookup, indexedLookup },
      aggregation,
      mixedWorkload: mixed,
      footprint: { note: "Simulated — real instances needed for actual footprint data" },
      ranAt: new Date().toISOString(),
      simulated: true,
    };

    fs.writeFileSync(path.join("results", `${key}-benchmark.json`), JSON.stringify(benchmarkOutput, null, 2));
    console.log(`  Saved results/${key}-benchmark.json`);
  }

  console.log("\nSimulation complete. Run `npm run report` to generate tables.");
}

main().catch(err => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
