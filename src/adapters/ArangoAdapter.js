import { Database } from "arangojs";
import { BaseAdapter } from "./BaseAdapter.js";

const NODE_COLLECTION = "persons";
const EDGE_COLLECTION = "knows";
const GRAPH_NAME = "benchmark_graph";

export class ArangoAdapter extends BaseAdapter {
  constructor(name, { url, user, password, dbName }) {
    super(name);
    this.url = url;
    this.user = user;
    this.password = password;
    this.dbName = dbName;
  }

  async connect() {
    const systemDb = new Database({ url: this.url, auth: { username: this.user, password: this.password } });
    const dbs = await systemDb.listDatabases();
    if (!dbs.includes(this.dbName)) {
      await systemDb.createDatabase(this.dbName);
    }
    this.db = systemDb.database(this.dbName);
  }

  async close() {
    // arangojs connections are stateless HTTP; nothing to tear down.
  }

  async ping() {
    await this.db.version();
  }

  async ensureSchema() {
    const nodeCol = this.db.collection(NODE_COLLECTION);
    if (!(await nodeCol.exists())) await nodeCol.create();
    const edgeCol = this.db.collection(EDGE_COLLECTION);
    if (!(await edgeCol.exists())) await edgeCol.create({ type: 3 }); // 3 = edge collection

    const graph = this.db.graph(GRAPH_NAME);
    if (!(await graph.exists())) {
      await graph.create({
        edgeDefinitions: [
          { collection: EDGE_COLLECTION, from: [NODE_COLLECTION], to: [NODE_COLLECTION] },
        ],
      });
    }
    await nodeCol.ensureIndex({ type: "persistent", fields: ["age"], name: "idx_age" });
    await nodeCol.ensureIndex({ type: "persistent", fields: ["nid"], name: "idx_nid", unique: true });
  }

  async loadNodes(rows) {
    const docs = rows.map((r) => ({ _key: String(r.id), nid: r.id, age: r.age }));
    await this.db.collection(NODE_COLLECTION).saveAll(docs, { overwriteMode: "ignore" });
  }

  async loadEdges(rows) {
    const docs = rows.map((r) => ({
      _from: `${NODE_COLLECTION}/${r.src}`,
      _to: `${NODE_COLLECTION}/${r.dst}`,
    }));
    await this.db.collection(EDGE_COLLECTION).saveAll(docs, { overwriteMode: "ignore" });
  }

  async traversal(startId, hops) {
    const cursor = await this.db.query({
      query: `
        FOR v IN ${hops}..${hops} OUTBOUND @start GRAPH @graph
        RETURN DISTINCT v
      `,
      bindVars: { start: `${NODE_COLLECTION}/${startId}`, graph: GRAPH_NAME },
    });
    const results = await cursor.all();
    return results.length;
  }

  async pointLookup(id) {
    const cursor = await this.db.query({
      query: `FOR d IN ${NODE_COLLECTION} FILTER d.nid == @id RETURN d`,
      bindVars: { id },
    });
    return (await cursor.all()).length;
  }

  async indexedLookup(age) {
    const cursor = await this.db.query({
      query: `FOR d IN ${NODE_COLLECTION} FILTER d.age == @age COLLECT WITH COUNT INTO c RETURN c`,
      bindVars: { age },
    });
    const r = await cursor.all();
    return r[0] ?? 0;
  }

  async aggregation() {
    const cursor = await this.db.query({
      query: `FOR d IN ${NODE_COLLECTION} COLLECT age = d.age WITH COUNT INTO c SORT age RETURN {age, c}`,
    });
    return (await cursor.all()).length;
  }

  async write(id) {
    await this.db.query({
      query: `FOR d IN ${NODE_COLLECTION} FILTER d.nid == @id UPDATE d WITH {touched: DATE_NOW()} IN ${NODE_COLLECTION}`,
      bindVars: { id },
    });
  }

  async footprint() {
    try {
      const stats = await this.db.request({ method: "GET", path: "/_admin/statistics" });
      return {
        storedBytes: stats?.body?.system?.bytesSentTotal ?? null,
        memoryBytes: stats?.body?.system?.residentSize ?? null,
        note: "from ArangoDB /_admin/statistics",
      };
    } catch (e) {
      return { storedBytes: null, memoryBytes: null, note: "not observable on Oasis free trial" };
    }
  }
}
