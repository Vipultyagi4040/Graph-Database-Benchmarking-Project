import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PLATFORMS } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.resolve(__dirname, "..", "..", "results");

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function fmt(v) { return v === null || undefined ? "—" : v; }

const platformNames = Object.keys(PLATFORMS).map(k => PLATFORMS[k].label);
const platformKeys = Object.keys(PLATFORMS);

function series(metricFn) {
  return platformKeys.map(k => {
    const d = readJson(path.join(RESULTS_DIR, `${k}-benchmark.json`));
    return d ? metricFn(d) : null;
  });
}

function barChart(id, title, data, label) {
  const rows = data.map((v, i) => `    { label: "${platformNames[i]}", value: ${v === null ? 0 : v} }`).join(",\n");
  return `
  <div class="chart-card">
    <h3>${title}</h3>
    <canvas id="${id}" height="280"></canvas>
    <script>
      new Chart(document.getElementById("${id}"), {
        type: "bar",
        data: { labels: ${JSON.stringify(platformNames)}, datasets: [{ label: "${label}", data: [${data}], backgroundColor: "#4f8cff" }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    </script>
  </div>`;
}

const benchData = platformKeys.map(k => readJson(path.join(RESULTS_DIR, `${k}-benchmark.json`)));
const loadData = platformKeys.map(k => readJson(path.join(RESULTS_DIR, `${k}-load.json`)));

const traversal1hop = benchData.map(d => d?.traversal?.["1hop"]?.p50 ?? null);
const traversal3hop = benchData.map(d => d?.traversal?.["3hop"]?.p50 ?? null);
const pointLookup = benchData.map(d => d?.lookups?.pointLookup?.p50 ?? null);
const indexedLookup = benchData.map(d => d?.lookups?.indexedLookup?.p50 ?? null);
const aggregation = benchData.map(d => d?.aggregation?.p50 ?? null);
const mixedC1 = benchData.map(d => {
  const m = d?.mixedWorkload?.find(x => x.concurrency === 1);
  return m?.opsPerSecond ?? null;
});
const mixedC40 = benchData.map(d => {
  const m = d?.mixedWorkload?.find(x => x.concurrency === 40);
  return m?.opsPerSecond ?? null;
});
const loadTime = loadData.map(d => d?.totalLoadSeconds ?? null);

const md = `# CognoDB Cloud Graph Benchmark — Report

> Generated: ${new Date().toISOString()}
> Dataset: SNAP soc-Pokec connected subgraph (see README for exact seed/size)
> Workload: ${100} iterations per read workload, mixed workload sweep at concurrency 1/10/40

## Summary

${barChart("chart-traversal-1hop", "Traversal 1-hop p50 (ms)", traversal1hop, "p50 ms")}
${barChart("chart-traversal-3hop", "Traversal 3-hop p50 (ms)", traversal3hop, "p50 ms")}
${barChart("chart-point-lookup", "Point Lookup p50 (ms)", pointLookup, "p50 ms")}
${barChart("chart-indexed-lookup", "Indexed Lookup p50 (ms)", indexedLookup, "p50 ms")}
${barChart("chart-aggregation", "Aggregation p50 (ms)", aggregation, "p50 ms")}
${barChart("chart-mixed-c1", "Mixed workload c=1 ops/sec", mixedC1, "ops/sec")}
${barChart("chart-mixed-c40", "Mixed workload c=40 ops/sec", mixedC40, "ops/sec")}
${barChart("chart-load", "Load time (s)", loadTime, "seconds")}

## Raw data

Each platform's raw JSON is in \`results/<platform>-benchmark.json\` and \`results/<platform>-load.json\`.
`;

fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.html"), md);
console.log("Wrote results/REPORT.html");
