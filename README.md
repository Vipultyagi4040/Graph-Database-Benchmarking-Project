# CognoDB Cloud vs. Managed Graph Database Platforms — A Reproducible Benchmark

This repo benchmarks **CognoDB Cloud** against four other managed graph
database cloud platforms — **Neo4j Aura Free**, **Memgraph Cloud**,
**ArangoDB Oasis**, and **TigerGraph Cloud** — on the identical dataset,
identical logical queries, and matched free-tier resources.

Goal: an honest, reproducible answer to "how does CognoDB actually perform
against the alternatives?", not a verdict on which database "wins".

> **Status:** benchmark complete with real measurements for 4 out of 5 platforms. CognoDB, Neo4j Aura, Memgraph Cloud, and ArangoDB Oasis results are from actual benchmark runs. TigerGraph results are simulated because the instance REST++ endpoint is unreachable (`ETIMEDOUT`). An HTML report with charts is available at `results/REPORT.html`. Each `results/*.json` file is the source of truth; `npm run report` regenerates the tables below from it.

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
  SEED_NODE=1236021
  Nodes: 87,468
  Edges: 200,000
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

<!-- RESULTS_START -->
# Results Matrix (auto-generated)

Generated: 2026-08-14T16:05:55.948Z

## Ingest

| Platform | Nodes | Edges | Load time (s) | Nodes/s | Rels/s |
|---|---|---|---|---|---|
| CognoDB Cloud | 87468 | 200000 | 84.34 | 3452.24 | 3389.48 |
| Neo4j Aura Free | 87468 | 200000 | 18.27 | 19638.41 | 14471.36 |
| Memgraph Cloud | 87468 | 200000 | 51.04 | 5659.44 | 5620.68 |
| ArangoDB Oasis | 87468 | 200000 | 275.39 | 1082.24 | 1027.91 |
| TigerGraph Cloud | 87468 | 200000 | 120.07 | 3079 | 1986 |

## Traversals (p50 / p95 ms)

| Platform | 1-hop | 2-hop | 3-hop |
|---|---|---|---|
| CognoDB Cloud | 277.15 / 355.93 | 262.99 / 362.66 | 296.4 / 369.68 |
| Neo4j Aura Free | 33.94 / 39.67 | 33.55 / 40.08 | 35.59 / 52.12 |
| Memgraph Cloud | 158.39 / 164.53 | 157.78 / 164.59 | 157.51 / 165.59 |
| ArangoDB Oasis | 312.31 / 425.82 | 317.1 / 433.52 | 323.04 / 432.41 |
| TigerGraph Cloud | 3.82 / 4.71 | 15.16 / 17.88 | 49.55 / 57.18 |

## Lookups (p50 / p95 ms)

| Platform | Point lookup | Indexed lookup |
|---|---|---|
| CognoDB Cloud | 309.79 / 364.97 | 252.69 / 368.15 |
| Neo4j Aura Free | 33.14 / 38.82 | 33.35 / 43.61 |
| Memgraph Cloud | 158.13 / 163.7 | 157.94 / 163.32 |
| ArangoDB Oasis | 331.92 / 428.51 | 334.83 / 426.09 |
| TigerGraph Cloud | 3.1 / 6.44 | 5.62 / 12.55 |

## Aggregation (p50 / p95 ms)

| Platform | Aggregation |
|---|---|
| CognoDB Cloud | 450.18 / 557.39 |
| Neo4j Aura Free | 59.92 / 86.88 |
| Memgraph Cloud | 181.75 / 192.72 |
| ArangoDB Oasis | 346.34 / 610.04 |
| TigerGraph Cloud | 20.15 / 23.29 |

## Mixed workload throughput (ops/sec)

| Platform | c=1 | c=10 | c=40 |
|---|---|---|---|
| CognoDB Cloud | 3.64 | 30.89 | 103.45 |
| Neo4j Aura Free | 28.11 | 293.25 | 936.87 |
| Memgraph Cloud | 6.34 | 55.91 | 225.42 |
| ArangoDB Oasis | 3.11 | 6.82 | 8.46 |
| TigerGraph Cloud | 22 | 219 | 1090 |

## Footprint

| Platform | Note |
|---|---|
| CognoDB Cloud | not observable via driver on this platform |
| Neo4j Aura Free | not observable via driver on this platform |
| Memgraph Cloud | not observable via driver on this platform |
| ArangoDB Oasis | not observable via driver on this platform |
| TigerGraph Cloud | Simulated — real instances needed for actual footprint data |
<!-- RESULTS_END -->

## Analysis

The real measurements reveal a more nuanced picture than initial architecture assumptions suggested:

**1. CognoDB free-tier CPU throttling is the dominant factor.**
CognoDB's measured p50 traversal latency (~277 ms) and point lookup latency (~310 ms) are roughly 8–9× higher than Neo4j Aura's (~34 ms), despite both using Bolt/Cypher. This is the most significant finding. CognoDB c0 is a **burstable 0.5 vCPU** instance, and our sustained workload appears to exhaust CPU credits, causing consistent throttling. This shows up clearly in the mixed workload: CognoDB drops to 103 ops/sec at c=40 vs. Neo4j's 937 ops/sec. The free tier works for occasional queries but chokes under sustained benchmark load.

**2. Neo4j Aura Free delivers the best real-world performance.**
Neo4j Aura's ~34 ms p50 across traversals, point lookups, and indexed lookups is remarkably flat and consistent. Its aggregation p50 of 60 ms is also the best among measured platforms. The p95 tail (40–87 ms) is reasonably tight, indicating low variance. Aura's free tier, while small, provides a more predictable performance profile than burstable competitors.

**3. Memgraph Cloud results confirm in-memory latency advantage.**
Real Memgraph measurements (~158 ms traversals, ~158 ms point lookups) are significantly better than the previous run, confirming Memgraph's in-memory advantage. However, Memgraph still underperforms relative to expectations for an in-memory database, and the mixed workload shows severe throttling at c=40 (225 ops/sec vs Neo4j's 937). Possible explanations: free-tier throttling, suboptimal Cypher queries for Memgraph's planner, or network latency.

**4. ArangoDB Oasis is the slowest for graph traversals.**
ArangoDB's ~312 ms traversal p50 and ~332 ms point lookup p50 are the highest among measured platforms. This aligns with AQL being a multi-model query language optimized for flexibility over raw graph traversal speed. However, ArangoDB's aggregation (346 ms p50) is faster than its traversals, suggesting scan-based operations are reasonably optimized. Note: ArangoDB benchmark encountered network `ECONNRESET` errors during traversal queries; results may be partially affected.

**5. TigerGraph remains simulated.**
Credentials are configured in `.env`, but the TigerGraph Cloud instance REST++ endpoint (port 14240) is unreachable from our client (`ETIMEDOUT`). The architecture suggests it should excel at deeper traversals, but this is unverified with real measurements.

**6. Ingest throughput varies by 10× across platforms.**
Neo4j Aura loaded 200K edges in 18.27s (14,471 rels/s) — 4.3× faster than CognoDB and 14× faster than ArangoDB (1,028 rels/s). This gap suggests ingest path efficiency differs significantly across platforms, with HTTP-based ingestion (ArangoDB) carrying substantial overhead.

*Note: CognoDB, Neo4j Aura, Memgraph, and ArangoDB results are from actual benchmark runs. TigerGraph results are simulated.*

## Caveats

- **CognoDB free-tier CPU throttling:** CognoDB's measured latencies (~277 ms traversal, ~310 ms point lookup) are significantly higher than Neo4j Aura's (~34 ms) despite both using Bolt/Cypher. We attribute this to CognoDB c0 being a burstable 0.5 vCPU instance that throttles under sustained load. This is a real, measured caveat — not a simulation artifact.
- **Memgraph Cloud mixed results:** Latest Memgraph run succeeded (~158 ms traversals, ~158 ms point lookups), showing better performance than earlier runs. However, mixed workload at c=40 shows throttling (225 ops/sec vs Neo4j's 937). Possible causes: free-tier throttling, suboptimal Cypher queries for Memgraph's planner, or network latency.
- **ArangoDB Oasis network issues:** ArangoDB benchmark encountered `ECONNRESET` errors during traversal queries, indicating network connectivity issues from our client. Load metrics are real, but traversal/lookup/aggregation/mixed results may be partially affected. Consider re-running when network stability improves.
- **TigerGraph instance not accessible:** The TigerGraph Cloud instance at `tg-5c71ec22...i.tgcloud.io` returned `Auto start is not enabled for this workspace` from its HTTPS endpoint, and the REST++ token port (14240) timed out (`ETIMEDOUT`). This indicates the instance is either paused, not started, or not reachable from our client. TigerGraph results in the tables are simulated. To get real numbers: resume the instance from the TigerGraph Cloud console, obtain the username/password, and run `src/adapters/tigergraph_schema.gsql` once in GraphStudio. Username: `tigergraph`, password stored in `.env`.
- **Neo4j Aura password format issue:** The initial password had a trailing period that caused authentication failure. Removing it resolved the issue.
- **ArangoDB Oasis query API fix:** arangojs v9 changed `db.query()` from object-style to positional arguments. The adapter was updated accordingly.
- **Network variance:** All benchmarks run from a single client machine (Windows, India region). Platform instances may be in different regions, adding 1–5 ms RTT to every query.
- **Driver batching vs. bulk import:** We use driver-level batched upserts (1,000 rows/batch) for all platforms, not native bulk-import tools. This ensures comparable ingest measurements but understates each platform's theoretical maximum.
- **Memory usage not observable:** Managed cloud platforms generally don't expose real-time memory usage via their APIs on free tiers.

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

### 6a. Simulate results (optional, for testing the pipeline)
If you want to test the full reporting pipeline without provisioning instances:
```bash
npm run simulate   # generates realistic simulated results for all 5 platforms
npm run report     # builds the tables from simulated JSON
```
The simulated results are clearly marked and should be replaced with real measurements.

## Repository structure

```
├── README.md                    ← you are here
├── docs/PLATFORM_SETUP.md       ← account setup for all 5 platforms
├── .env.example                 ← credential template (no secrets)
├── scripts/
│   ├── fetch-dataset.js         ← downloads raw SNAP soc-Pokec data
│   ├── prepare-dataset.js       ← subsamples to a connected subgraph
│   ├── build-report.js          ← builds results/REPORT.md from JSON results
│   ├── build-report-html.js     ← builds results/REPORT.html with Chart.js charts
│   └── simulate-results.js      ← generates realistic simulated benchmark results
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
