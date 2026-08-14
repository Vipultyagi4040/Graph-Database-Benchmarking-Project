// Subsamples the raw soc-Pokec edge list down to a single connected
// component with roughly TARGET_EDGES relationships (default 200,000,
// inside the assignment's required 100k-500k range) via BFS from a random
// seed node. Emits data/prepared/nodes.csv and data/prepared/edges.csv.
//
// nodes.csv: id (int)
// edges.csv: src,dst (both int, reference nodes.csv id)
//
// We keep the schema deliberately minimal (just structural ids) so every
// platform can load it with the same two-file format regardless of query
// language. A synthetic "age" property is added to nodes for the
// indexed/filtered lookup workload, seeded deterministically from the id.

import fs from "fs";
import path from "path";
import readline from "readline";

const RAW_EDGES = path.resolve("data/raw/soc-pokec-relationships.txt");
const OUT_DIR = path.resolve("data/prepared");
const TARGET_EDGES = Number(process.env.TARGET_EDGES || 200000);
const SEED_NODE = process.env.SEED_NODE ? Number(process.env.SEED_NODE) : null;

async function loadAdjacency() {
  if (!fs.existsSync(RAW_EDGES)) {
    console.error(`Raw edge list not found at ${RAW_EDGES}. Run "npm run dataset:fetch" first.`);
    process.exit(1);
  }
  console.log("Streaming raw edge list into adjacency map (this can take a minute)...");
  const adj = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(RAW_EDGES),
    crlfDelay: Infinity,
  });
  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const [a, b] = line.split("\t").map(Number);
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
    lines++;
    if (lines % 2_000_000 === 0) console.log(`  ...${lines.toLocaleString()} edges scanned`);
  }
  console.log(`Loaded adjacency for ${adj.size.toLocaleString()} source nodes, ${lines.toLocaleString()} edges total.`);
  return adj;
}

function bfsSubgraph(adj, seed, targetEdges) {
  const visited = new Set([seed]);
  const queue = [seed];
  const edges = [];
  let head = 0;

  while (head < queue.length && edges.length < targetEdges) {
    const node = queue[head++];
    const neighbors = adj.get(node) || [];
    for (const nb of neighbors) {
      if (edges.length >= targetEdges) break;
      edges.push([node, nb]);
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return { nodes: visited, edges };
}

async function main() {
  const adj = await loadAdjacency();
  const candidateSeeds = [...adj.keys()];
  const seed = SEED_NODE ?? candidateSeeds[Math.floor(Math.random() * candidateSeeds.length)];

  console.log(`Running BFS from seed node ${seed} targeting ${TARGET_EDGES.toLocaleString()} relationships...`);
  const { nodes, edges } = bfsSubgraph(adj, seed, TARGET_EDGES);

  if (edges.length < 100000) {
    console.warn(
      `WARNING: only found ${edges.length.toLocaleString()} edges reachable from seed ${seed}. ` +
        `Try a different SEED_NODE env var (a node with a large connected component).`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Re-index nodes to a dense 0..n-1 range for cleanliness, keep a mapping.
  const idMap = new Map();
  let nextId = 0;
  for (const n of nodes) idMap.set(n, nextId++);

  const nodesCsv = fs.createWriteStream(path.join(OUT_DIR, "nodes.csv"));
  nodesCsv.write("id,original_id,age\n");
  for (const [orig, id] of idMap) {
    // Deterministic synthetic age (18-65) for the indexed-lookup workload.
    const age = 18 + (orig % 48);
    nodesCsv.write(`${id},${orig},${age}\n`);
  }
  nodesCsv.end();

  const edgesCsv = fs.createWriteStream(path.join(OUT_DIR, "edges.csv"));
  edgesCsv.write("src,dst\n");
  for (const [a, b] of edges) {
    if (!idMap.has(a) || !idMap.has(b)) continue; // dst outside sampled set, skip
    edgesCsv.write(`${idMap.get(a)},${idMap.get(b)}\n`);
  }
  edgesCsv.end();

  console.log(`\nPrepared dataset:`);
  console.log(`  Seed node (original id): ${seed}`);
  console.log(`  Nodes: ${idMap.size.toLocaleString()}`);
  console.log(`  Edges: ${edges.length.toLocaleString()}`);
  console.log(`  Written to ${OUT_DIR}`);
  console.log(`\nRecord this seed node id in your README for reproducibility: SEED_NODE=${seed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
