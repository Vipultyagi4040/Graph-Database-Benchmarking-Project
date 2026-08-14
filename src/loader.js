import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import cliProgress from "cli-progress";

const BATCH_SIZE = 1000;

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw, { columns: true, cast: true });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadDataset(adapter, datasetPath) {
  const nodes = readCsv(path.join(datasetPath, "nodes.csv")).map((r) => ({ id: r.id, age: r.age }));
  const edges = readCsv(path.join(datasetPath, "edges.csv")).map((r) => ({ src: r.src, dst: r.dst }));

  console.log(`[${adapter.name}] Loading ${nodes.length.toLocaleString()} nodes, ${edges.length.toLocaleString()} edges...`);

  await adapter.ensureSchema();

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  const nodeStart = process.hrtime.bigint();
  bar.start(nodes.length, 0);
  for (const batch of chunk(nodes, BATCH_SIZE)) {
    await adapter.loadNodes(batch);
    bar.increment(batch.length);
  }
  bar.stop();
  const nodeEnd = process.hrtime.bigint();
  const nodeSeconds = Number(nodeEnd - nodeStart) / 1e9;

  const edgeStart = process.hrtime.bigint();
  bar.start(edges.length, 0);
  for (const batch of chunk(edges, BATCH_SIZE)) {
    await adapter.loadEdges(batch);
    bar.increment(batch.length);
  }
  bar.stop();
  const edgeEnd = process.hrtime.bigint();
  const edgeSeconds = Number(edgeEnd - edgeStart) / 1e9;

  const totalSeconds = nodeSeconds + edgeSeconds;

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeLoadSeconds: round2(nodeSeconds),
    edgeLoadSeconds: round2(edgeSeconds),
    totalLoadSeconds: round2(totalSeconds),
    nodesPerSecond: round2(nodes.length / nodeSeconds),
    relationshipsPerSecond: round2(edges.length / edgeSeconds),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
