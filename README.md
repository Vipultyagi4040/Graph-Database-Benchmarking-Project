# CognoDB Cloud vs. Managed Graph Database Platforms — A Reproducible Benchmark

This repo benchmarks **CognoDB Cloud** against four other managed graph
database cloud platforms — **Neo4j Aura Free**, **Memgraph Cloud**,
**ArangoDB Oasis**, and **TigerGraph Cloud** — on the identical dataset,
identical logical queries, and matched free-tier resources.

Goal: an honest, reproducible answer to "how does CognoDB actually perform
against the alternatives?", not a verdict on which database "wins".

> **Status:** this repository ships the full benchmark harness, dataset
> pipeline, and reporting scripts, ready to run. The results tables below
> are placeholders — fill them in by running the harness against your own
> free-tier accounts (see [Reproducing this benchmark](#reproducing-this-benchmark)).
> Each `results/*.json` file this produces is the source of truth; `npm run
> report` regenerates the tables below from it.

## Why these five platforms

| Platform | Query language | Why it's in this comparison |
|---|---|---|
| CognoDB Cloud | Cypher (Bolt protocol) | The subject of this benchmark. |
| Neo4j Aura Free | Cypher (Bolt protocol) | CognoDB's setup docs explicitly say to connect with the official Neo4j driver — Aura is the platform that protocol choice is most directly comparable to, and it's the most widely used managed graph DB. |
| Memgraph Cloud | Cypher (Bolt protocol) | Also Bolt/Cypher-compatible, but an in-memory-first architecture — a useful contrast on latency for the same query language. |
| ArangoDB Oasis | AQL (multi-model) | A credible managed alternative with a different query language and multi-model storage engine — tests whether the comparison holds up across query paradigms, not just within the Cypher ecosystem. |
| TigerGraph Cloud | GSQL (REST + procedural queries) | A native, compiled-query graph platform aimed at deep multi-hop traversals — the most architecturally different of the five, useful for the traversal-latency comparison specifically. |

Because CognoDB, Neo4j Aura and Memgraph all speak Bolt/Cypher, they share a
single adapter implementation (`src/adapters/BoltAdapter.js`) — this is
intentional and *increases* fairness, since it removes any risk of us
hand-tuning per-platform Cypher.

## Fairness: same resources everywhere

All five platforms are provisioned at their smallest / free tier, sized to
match CognoDB's free instance as closely as each platform's tier structure
allows:

| Platform | vCPU | RAM | Disk | Tier |
|---|---|---|---|---|
| CognoDB Cloud | 0.5 (burstable) | 256 MB | 1 GB | c0 free |
| Neo4j Aura Free | 0.5 | 256 MB (approx.) | 1 GB | AuraDB Free |
| Memgraph Cloud | 0.5 | 256 MB (approx.) | 1 GB | Free tier |
| ArangoDB Oasis | 0.5 | 256 MB (approx.) | 1 GB | Free trial, smallest node |
| TigerGraph Cloud | 0.5 | 256 MB (approx.) | 1 GB | TG Free tier |

**Fill in the exact advertised specs for each platform in `src/config.js`
(`specs` field) once you provision your instances** — free-tier specs
change over time and vary slightly by provider, so treat the numbers above
as the target, verify them against each provider's current docs at
provisioning time, and correct `config.js` and this table to match reality.
Where a provider's smallest tier is *larger* than CognoDB's, note that
explicitly as a fairness caveat rather than silently benchmarking unequal
resources.

## Dataset

[SNAP soc-Pokec social network](https://snap.stanford.edu/data/soc-Pokec.html)
(full graph: 1,632,803 nodes / 30,622,564 directed edges). We take a single
**connected subgraph via BFS from a random seed node**, sized to
~150,000–200,000 relationships (inside the assignment's required
100k–500k range) so it fits comfortably on every platform's free-tier disk
allocation.

- Nodes carry a synthetic `age` property (18–65, deterministic from the
  original node id) used for the indexed/filtered lookup workload.
- Edges are a directed `KNOWS` / `Knows` relationship, matching the
  original dataset's "relationships" semantics.
- The exact seed node and resulting node/edge counts are printed by
  `npm run dataset:prepare` and **must be recorded here** after you run it,
  for reproducibility:

  ```
  SEED_NODE=<fill in after running prepare-dataset.js>
  Nodes: <fill in>
  Edges: <fill in>
  ```

Load method for every platform: **driver-level batched upserts**, 1,000
rows per batch (see `src/loader.js`). This is deliberately not each
platform's fastest possible bulk-import path (e.g. `neo4j-admin import`,
`arangoimport`) — those tools bypass the network/driver layer entirely and
aren't available uniformly across all five platforms on free tiers, so
using them would make ingest throughput incomparable. Batched driver
upserts are the common denominator across all five.

## Required metrics measured

| Category | Metric | Notes |
|---|---|---|
| Data loading | Ingest throughput | Nodes/sec, relationships/sec, total wall-clock |
| Traversals | 1/2/3-hop latency | p50/p95, random start nodes, 100 iterations after warm-up |
| Lookups | Point + indexed lookup | p50/p95; `age` is indexed on every platform |
| Aggregations | Count by `age` | p50/p95 |
| Mixed workload | Concurrent read/write | Sweep at 1 / 10 / 40 clients, 80/20 read/write mix, 5s per level |
| Footprint | Stored size / memory | Best-effort per platform; "not observable" where the platform doesn't expose it |

Iteration count and concurrency levels are configurable via `.env`
(`BENCH_ITERATIONS`, `BENCH_CONCURRENCY_LEVELS`).

## Results

*(Run `npm run report` after benchmarking to regenerate this section from
`results/*.json`, then paste the contents of `results/REPORT.md` here.)*

<!-- RESULTS_START -->
_No results yet — see "Reproducing this benchmark" below._
<!-- RESULTS_END -->

## Analysis

*(Fill in after you have real numbers. Suggested angles: does the
in-memory-first Memgraph architecture show up as lower p50 traversal
latency vs. disk-backed platforms? Does TigerGraph's compiled-query model
pay off more at 3-hop than 1-hop, where its "why" would be query-plan
compilation amortizing over deeper traversals? Does CognoDB's throttling
show up specifically under the 40-client mixed workload rather than at
low concurrency? Write 3–5 concrete, numbers-backed paragraphs here.)*

## Caveats (fill in honestly as you encounter them)

- [ ] Note any free-tier throttling observed (e.g. connection limits, rate limits)
- [ ] Note network variance (client region vs. each platform's region)
- [ ] Note any query-language semantic differences that could bias a metric
      (e.g. TigerGraph's compiled queries vs. interpreted Cypher)
- [ ] Note any timeouts or failed runs, and which platform/workload they hit
- [ ] Note if any platform's actual free-tier specs turned out to differ
      from the table above

## Reproducing this benchmark

### 1. Install dependencies
```bash
npm install
```

### 2. Provision each platform's free tier
See [`docs/PLATFORM_SETUP.md`](docs/PLATFORM_SETUP.md) for step-by-step
signup instructions for all five platforms. Copy `.env.example` to `.env`
and fill in the connection details as you provision each one — **never
commit `.env`**.

### 3. Fetch and prepare the dataset
```bash
npm run dataset:fetch     # downloads raw SNAP soc-Pokec edge list
npm run dataset:prepare   # subsamples to a ~150-200k edge connected subgraph
```

### 4. Install TigerGraph schema (one-time, TigerGraph only)
TigerGraph can't create schema over its REST API, so run this once via the
GSQL shell or the Cloud Portal's GSQL editor:
```bash
gsql -g benchmark src/adapters/tigergraph_schema.gsql
```

### 5. Load and benchmark
Run everything end-to-end:
```bash
npm run all
```
Or one platform at a time:
```bash
node src/runLoad.js cognodb
node src/runBenchmark.js cognodb
```
Valid platform keys: `cognodb`, `neo4j`, `memgraph`, `arangodb`, `tigergraph`.

### 6. Generate the results tables
```bash
npm run report
```
This writes `results/REPORT.md` — paste it into the Results section above.

For an HTML report with charts (requires a browser to view):
```bash
npm run report:html
# open results/REPORT.html
```

## Repository structure

```
├── README.md                    ← you are here
├── docs/PLATFORM_SETUP.md       ← account setup for all 5 platforms
├── .env.example                 ← credential template (no secrets)
├── scripts/
│   ├── fetch-dataset.js         ← downloads raw SNAP soc-Pokec data
│   ├── prepare-dataset.js       ← subsamples to a connected subgraph
│   ├── build-report.js          ← builds results/REPORT.md from JSON results
│   └── build-report-html.js     ← builds results/REPORT.html with Chart.js charts
├── src/
│   ├── config.js                ← platform registry + specs + env wiring
│   ├── metrics.js                ← percentile/timing helpers
│   ├── loader.js                 ← batched CSV -> platform ingest
│   ├── runLoad.js                ← CLI: load one platform
│   ├── runBenchmark.js           ← CLI: benchmark one platform
│   ├── runAll.js                  ← CLI: load + benchmark all platforms
│   ├── adapters/                 ← one adapter per platform/protocol
│   │   ├── BaseAdapter.js         ← interface every adapter implements
│   │   ├── BoltAdapter.js         ← CognoDB + Neo4j Aura + Memgraph (Cypher/Bolt)
│   │   ├── ArangoAdapter.js       ← ArangoDB Oasis (AQL)
│   │   ├── TigerGraphAdapter.js   ← TigerGraph Cloud (GSQL/REST)
│   │   └── tigergraph_schema.gsql ← one-time schema/query install
│   └── workloads/
│       ├── readWorkloads.js      ← traversal, point/indexed lookup, aggregation
│       └── mixedWorkload.js      ← concurrent read/write throughput sweep
└── results/                      ← JSON per platform + generated REPORT.md
```

## Security

No platform passwords or connection URIs are committed to this repo — every
credential is read from environment variables via `.env` (gitignored).
`.env.example` documents every variable the harness expects.
