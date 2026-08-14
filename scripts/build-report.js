import fs from "fs";
import path from "path";
import { PLATFORMS } from "../src/config.js";

const RESULTS_DIR = path.resolve("results");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function fmt(v) {
  return v === null || v === undefined ? "—" : v;
}

let md = `# Results Matrix (auto-generated)\n\nGenerated: ${new Date().toISOString()}\n\n`;

md += `## Ingest\n\n| Platform | Nodes | Edges | Load time (s) | Nodes/s | Rels/s |\n`;
md += `|---|---|---|---|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-load.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | (no data - run failed or not yet run) | | | | |\n`; continue; }
  md += `| ${d.platform} | ${fmt(d.nodeCount)} | ${fmt(d.edgeCount)} | ${fmt(d.totalLoadSeconds)} | ${fmt(d.nodesPerSecond)} | ${fmt(d.relationshipsPerSecond)} |\n`;
}

md += `\n## Traversals (p50 / p95 ms)\n\n| Platform | 1-hop | 2-hop | 3-hop |\n|---|---|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-benchmark.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | no data | | |\n`; continue; }
  const t = d.traversal;
  const cell = (o) => o ? `${fmt(o.p50)} / ${fmt(o.p95)}` : "—";
  md += `| ${d.platform} | ${cell(t["1hop"])} | ${cell(t["2hop"])} | ${cell(t["3hop"])} |\n`;
}

md += `\n## Lookups (p50 / p95 ms)\n\n| Platform | Point lookup | Indexed lookup |\n|---|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-benchmark.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | no data | |\n`; continue; }
  const l = d.lookups;
  const cell = (o) => o ? `${fmt(o.p50)} / ${fmt(o.p95)}` : "—";
  md += `| ${d.platform} | ${cell(l.pointLookup)} | ${cell(l.indexedLookup)} |\n`;
}

md += `\n## Aggregation (p50 / p95 ms)\n\n| Platform | Aggregation |\n|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-benchmark.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | no data |\n`; continue; }
  const a = d.aggregation;
  md += `| ${d.platform} | ${a ? `${fmt(a.p50)} / ${fmt(a.p95)}` : "—"} |\n`;
}

md += `\n## Mixed workload throughput (ops/sec)\n\n| Platform | c=1 | c=10 | c=40 |\n|---|---|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-benchmark.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | no data | | |\n`; continue; }
  const byC = Object.fromEntries((d.mixedWorkload || []).map((m) => [m.concurrency, m.opsPerSecond]));
  md += `| ${d.platform} | ${fmt(byC[1])} | ${fmt(byC[10])} | ${fmt(byC[40])} |\n`;
}

md += `\n## Footprint\n\n| Platform | Note |\n|---|---|\n`;
for (const key of Object.keys(PLATFORMS)) {
  const d = readJson(path.join(RESULTS_DIR, `${key}-benchmark.json`));
  if (!d) { md += `| ${PLATFORMS[key].label} | no data |\n`; continue; }
  md += `| ${d.platform} | ${d.footprint?.note || "—"} |\n`;
}

fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.md"), md);
console.log(`Wrote ${path.join(RESULTS_DIR, "REPORT.md")}`);
console.log("Paste this into the README's Results section.");
