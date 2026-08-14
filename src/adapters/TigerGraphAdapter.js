import axios from "axios";
import { BaseAdapter } from "./BaseAdapter.js";

// NOTE: TigerGraph requires the schema + queries in tigergraph_schema.gsql
// to be installed once via the GSQL shell BEFORE this adapter is used --
// unlike the Bolt/AQL platforms, TigerGraph's REST API cannot create schema
// or install queries on its own. This is called out explicitly in the
// README so it isn't a hidden manual step.
export class TigerGraphAdapter extends BaseAdapter {
  constructor(name, { host, user, password, graph }) {
    super(name);
    this.host = host.replace(/\/$/, "");
    this.user = user;
    this.password = password;
    this.graph = graph;
  }

  async connect() {
    const res = await axios.post(
      `${this.host}:14240/requesttoken`,
      { graph: this.graph },
      { auth: { username: this.user, password: this.password } }
    );
    this.token = res.data?.token;
    this.client = axios.create({
      baseURL: `${this.host}:9000`,
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }

  async close() {}

  async ping() {
    await this.client.get(`/echo/${this.graph}`);
  }

  async ensureSchema() {
    console.warn(
      `[${this.name}] Schema/query install must be run once via GSQL ` +
        `(see src/adapters/tigergraph_schema.gsql). Skipping at runtime.`
    );
  }

  async loadNodes(rows) {
    const vertices = {};
    for (const r of rows) vertices[r.id] = { age: { value: r.age } };
    await this.client.post(`/graph/${this.graph}`, { vertices: { Person: vertices } });
  }

  async loadEdges(rows) {
    // TigerGraph REST++ upsert expects edges keyed by source vertex.
    const edges = {};
    for (const r of rows) {
      edges[r.src] = edges[r.src] || {};
      edges[r.src][r.dst] = {};
    }
    const payload = { edges: { Person: {} } };
    for (const [src, targets] of Object.entries(edges)) {
      payload.edges.Person[src] = { Knows: { Person: targets } };
    }
    await this.client.post(`/graph/${this.graph}`, payload);
  }

  async traversal(startId, hops) {
    const res = await this.client.get(`/query/${this.graph}/traversalNHop`, {
      params: { start: startId, hops },
    });
    return res.data?.results?.[0]?.reachedCount ?? 0;
  }

  async pointLookup(id) {
    const res = await this.client.get(`/query/${this.graph}/pointLookup`, {
      params: { targetId: id },
    });
    return res.data?.results?.[0]?.found ?? 0;
  }

  async indexedLookup(age) {
    const res = await this.client.get(`/query/${this.graph}/indexedLookup`, {
      params: { targetAge: age },
    });
    return res.data?.results?.[0]?.matchCount ?? 0;
  }

  async aggregation() {
    const res = await this.client.get(`/query/${this.graph}/ageAggregation`);
    const groups = res.data?.results?.[0]?.groups;
    return groups ? Object.keys(groups).length : 0;
  }

  async write(id) {
    await this.client.get(`/query/${this.graph}/touchNode`, { params: { targetId: id } });
  }

  async footprint() {
    try {
      const res = await this.client.get(`/statistics/${this.graph}`);
      return { storedBytes: null, memoryBytes: null, note: "see raw statistics endpoint response in results/", raw: res.data };
    } catch (e) {
      return { storedBytes: null, memoryBytes: null, note: "statistics endpoint not available on free tier" };
    }
  }
}
