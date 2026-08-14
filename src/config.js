import "dotenv/config";
import { BoltAdapter } from "./adapters/BoltAdapter.js";
import { ArangoAdapter } from "./adapters/ArangoAdapter.js";
import { TigerGraphAdapter } from "./adapters/TigerGraphAdapter.js";

// Every platform is documented here with its advertised free-tier specs so
// the README fairness table can be generated straight from this file --
// update the numbers if your actual provisioned instance differs.
export const PLATFORMS = {
  cognodb: {
    label: "CognoDB Cloud",
    specs: { vcpu: 0.5, ramMb: 256, diskGb: 1, tier: "c0 free" },
    build: () =>
      new BoltAdapter("cognodb", {
        uri: process.env.COGNODB_URI,
        user: process.env.COGNODB_USER,
        password: process.env.COGNODB_PASSWORD,
      }),
  },
  neo4j: {
    label: "Neo4j Aura Free",
    specs: { vcpu: 0.5, ramMb: 256, diskGb: 1, tier: "AuraDB Free" },
    build: () =>
      new BoltAdapter("neo4j", {
        uri: process.env.NEO4J_URI,
        user: process.env.NEO4J_USER,
        password: process.env.NEO4J_PASSWORD,
      }),
  },
  memgraph: {
    label: "Memgraph Cloud",
    specs: { vcpu: 0.5, ramMb: 256, diskGb: 1, tier: "Free tier" },
    build: () => {
      const host = process.env.MEMGRAPH_HOST || "localhost";
      const port = process.env.MEMGRAPH_PORT || "7687";
      const user = process.env.MEMGRAPH_USERNAME || process.env.MEMGRAPH_USER || "memgraph";
      const password = process.env.MEMGRAPH_PASSWORD || "";
      const uri = `bolt://${host}:${port}`;
      return new BoltAdapter("memgraph", { uri, user, password, encrypted: true, trust: "TRUST_ALL_CERTIFICATES" });
    },
  },
  arangodb: {
    label: "ArangoDB Oasis",
    specs: { vcpu: 0.5, ramMb: 256, diskGb: 1, tier: "Free trial, smallest node size" },
    build: () =>
      new ArangoAdapter("arangodb", {
        url: process.env.ARANGO_URL,
        user: process.env.ARANGO_USER,
        password: process.env.ARANGO_PASSWORD,
        dbName: process.env.ARANGO_DB || "benchmark",
      }),
  },
  tigergraph: {
    label: "TigerGraph Cloud",
    specs: { vcpu: 0.5, ramMb: 256, diskGb: 1, tier: "TG Free tier" },
    build: () =>
      new TigerGraphAdapter("tigergraph", {
        host: process.env.TIGERGRAPH_HOST,
        user: process.env.TIGERGRAPH_USER,
        password: process.env.TIGERGRAPH_PASSWORD,
        graph: process.env.TIGERGRAPH_GRAPH || "benchmark",
      }),
  },
};

export const BENCH_ITERATIONS = Number(process.env.BENCH_ITERATIONS || 100);
export const CONCURRENCY_LEVELS = (process.env.BENCH_CONCURRENCY_LEVELS || "1,10,40")
  .split(",")
  .map(Number);
export const DATASET_PATH = process.env.BENCH_DATASET_PATH || "./data/prepared";

export function getPlatform(key) {
  const p = PLATFORMS[key];
  if (!p) throw new Error(`Unknown platform "${key}". Options: ${Object.keys(PLATFORMS).join(", ")}`);
  return p;
}
