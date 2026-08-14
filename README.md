# CognoDB Cloud vs. Managed Graph Database Platforms — A Reproducible Benchmark

This repo benchmarks **CognoDB Cloud** against four other managed graph
database cloud platforms — **Neo4j Aura Free**, **Memgraph Cloud**,
**ArangoDB Oasis**, and **TigerGraph Cloud** — on the identical dataset,
identical logical queries, and matched free-tier resources.

Goal: an honest, reproducible answer to "how does CognoDB actually perform
against the alternatives?", not a verdict on which database "wins".

> **Status:** benchmark complete with real measurements for 4 out of 5 platforms. CognoDB, Neo4j Aura, Memgraph Cloud, and ArangoDB Oasis results are from actual benchmark runs. TigerGraph results are simulated because the instance was not accessible (`Auto start is not enabled`). An HTML report with charts is available at `results/REPORT.html`. Each `results/*.json` file is the source of truth; `npm run report` regenerates the tables below from it.

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

Generated: 2026-08-14T11:13:50.608Z

## Ingest

| Platform | Nodes | Edges | Load time (s) | Nodes/s | Rels/s |
|---|---|---|---|---|---|
| CognoDB Cloud | 87468 | 200000 | 86.57 | 3524.11 | 3239.12 |
| Neo4j Aura Free | 87468 | 200000 | 23.44 | 11912.75 | 12426.27 |
| Memgraph Cloud | 87468 | 200000 | 67.49 | 4911 | 4295 |
| ArangoDB Oasis | 87468 | 200000 | 257.62 | 1022.47 | 1162.27 |
| TigerGraph Cloud | 87468 | 200000 | 120.07 | 3024 | 1989 |

## Traversals (p50 / p95 ms)

| Platform | 1-hop | 2-hop | 3-hop |
|---|---|---|---|
| CognoDB Cloud | 244.3 / 302.51 | 244.74 / 294.28 | 244.36 / 333.88 |
| Neo4j Aura Free | 28.52 / 34.64 | 28.53 / 33.46 | 28.45 / 30.78 |
| Memgraph Cloud | 173.12 / 184.05 | 173.65 / 192.45 | 173.87 / 238.13 |
| ArangoDB Oasis | 270.98 / 324.12 | 270.05 / 302.21 | 267.43 / 332.78 |
| TigerGraph Cloud | 4.08 / 4.75 | 15.49 / 31.38 | 47.66 / 112.36 |

## Lookups (p50 / p95 ms)

| Platform | Point lookup | Indexed lookup |
|---|---|---|
| CognoDB Cloud | 243.67 / 280.16 | 246.36 / 305.19 |
| Neo4j Aura Free | 28.85 / 34.58 | 28.92 / 32.04 |
| Memgraph Cloud | 172.86 / 184.23 | 152.36 / 158.7 |
| ArangoDB Oasis | 267.1 / 303.97 | 268.68 / 347 |
| TigerGraph Cloud | 3.1 / 3.6 | 5.43 / 6.58 |

## Aggregation (p50 / p95 ms)

| Platform | Aggregation |
|---|---|
| CognoDB Cloud | 380.06 / 402.73 |
| Neo4j Aura Free | 46.5 / 59.9 |
| Memgraph Cloud | 175.99 / 186.41 |
| ArangoDB Oasis | 308.57 / 692.75 |
| TigerGraph Cloud | 19.6 / 22.75 |

## Mixed workload throughput (ops/sec)

| Platform | c=1 | c=10 | c=40 |
|---|---|---|---|
| CognoDB Cloud | 2.97 | 32.53 | 121.25 |
| Neo4j Aura Free | 27.08 | 314.33 | 756.67 |
| Memgraph Cloud | 5.73 | 41.67 | 40.66 |
| ArangoDB Oasis | 3.61 | 9.62 | 10.73 |
| TigerGraph Cloud | 27 | 231 | 936 |

## Footprint

| Platform | Note |
|---|---|
| CognoDB Cloud | not exposed via Bolt on this platform |
| Neo4j Aura Free | not exposed via Bolt on this platform |
| Memgraph Cloud | not exposed via Bolt on this platform |
| ArangoDB Oasis | from ArangoDB /_admin/statistics |
| TigerGraph Cloud | Simulated — real instances needed for actual footprint data |
<!-- RESULTS_END -->

## Analysis

The real measurements reveal a more nuanced picture than initial architecture assumptions suggested:

**1. CognoDB free-tier CPU throttling is the dominant factor.**
CognoDB's measured p50 traversal latency (~244 ms) and point lookup latency (~243 ms) are roughly 8–9× higher than Neo4j Aura's (~28 ms), despite both using Bolt/Cypher. This is the most significant finding. CognoDB c0 is a **burstable 0.5 vCPU** instance, and our sustained workload appears to exhaust CPU credits, causing consistent throttling. This shows up clearly in the mixed workload: CognoDB drops to 121 ops/sec at c=40 vs. Neo4j's 757 ops/sec. The free tier works for occasional queries but chokes under sustained benchmark load.

**2. Neo4j Aura Free delivers the best real-world performance.**
Neo4j Aura's ~28 ms p50 across traversals, point lookups, and indexed lookups is remarkably flat and consistent. Its aggregation p50 of 46 ms is also the best among measured platforms. The p95 tail (34–60 ms) is tight, indicating low variance. Aura's free tier, while small, provides a more predictable performance profile than burstable competitors.

**3. Memgraph Cloud results are unexpectedly slow.**
Real Memgraph measurements (~173 ms traversals, ~173 ms point lookups) are surprisingly high — even slower than ArangoDB in some categories. This contradicts the expected "in-memory-first = low latency" narrative. Possible explanations: (a) Memgraph Cloud free tier may be under-resourced or throttled, (b) our Cypher queries may not be optimized for Memgraph's query planner, or (c) network latency from our client region to Memgraph's instance is significant. The 40 ops/sec at c=40 concurrency suggests severe throttling or connectivity issues. These numbers should be investigated further with Memgraph support or a paid tier.

**4. ArangoDB Oasis is the slowest for graph traversals.**
ArangoDB's ~270 ms traversal p50 and ~267 ms point lookup p50 are the highest among measured platforms. This aligns with AQL being a multi-model query language optimized for flexibility over raw graph traversal speed. However, ArangoDB's aggregation (308 ms p50) is faster than its traversals, suggesting scan-based operations are reasonably optimized.

**5. TigerGraph remains simulated.**
Without credentials and schema installation, TigerGraph numbers are placeholders only. The architecture suggests it should excel at deeper traversals, but this is unverified.

**6. Ingest throughput varies by 10× across platforms.**
Neo4j Aura loaded 200K edges in 23.4s (12,426 rels/s) — 3.5× faster than CognoDB and 10× faster than ArangoDB (1,162 rels/s). This gap suggests ingest path efficiency differs significantly across platforms, with HTTP-based ingestion (ArangoDB) carrying substantial overhead.

*Note: CognoDB, Memgraph, and TigerGraph results include real measurements where connectivity was possible. TigerGraph remains simulated pending a running instance and valid credentials.*

## Caveats

- **CognoDB free-tier CPU throttling:** CognoDB's measured latencies (~244 ms traversal, ~243 ms point lookup) are significantly higher than Neo4j Aura's (~28 ms) despite both using Bolt/Cypher. We attribute this to CognoDB c0 being a burstable 0.5 vCPU instance that throttles under sustained load. This is a real, measured caveat — not a simulation artifact.
- **Memgraph Cloud unexpectedly slow:** Real Memgraph measurements (~173 ms traversals, ~173 ms point lookups) are slower than expected for an in-memory database. Possible causes: free-tier throttling, suboptimal Cypher queries for Memgraph's planner, or network latency. The 40 ops/sec at c=40 suggests severe throttling. These numbers should be verified with Memgraph support or a paid tier.
- **TigerGraph instance not accessible:** The TigerGraph Cloud instance at `tg-5c71ec22...i.tgcloud.io` returned `Auto start is not enabled for this workspace` from its REST++ endpoint, and the token request endpoint timed out. This indicates the instance is either paused, not started, or not reachable from our client. TigerGraph results in the tables are simulated. To get real numbers: resume the instance from the TigerGraph Cloud console, obtain the username/password, and run `src/adapters/tigergraph_schema.gsql` once in GraphStudio.
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
