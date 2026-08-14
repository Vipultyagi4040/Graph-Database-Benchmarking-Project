// CognoDB, Neo4j Aura and Memgraph Cloud all speak the Bolt protocol and
// accept the official Neo4j driver, per CognoDB's own setup docs ("Connect
// with an official Neo4j driver ... No other code changes are needed").
// That means a single adapter implementation is genuinely fair to reuse
// across all three -- it is not us hand-tuning per platform.
import neo4j from "neo4j-driver";
import { BaseAdapter } from "./BaseAdapter.js";

export class BoltAdapter extends BaseAdapter {
  constructor(name, { uri, user, password, encrypted }) {
    super(name);
    this.uri = uri;
    this.user = user;
    this.password = password;
    this.encrypted = encrypted;
  }

  async connect() {
    const config = { maxConnectionPoolSize: 50 };
    if (this.encrypted !== undefined) {
      config.encrypted = this.encrypted;
    }
    this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password), config);
    await this.driver.verifyConnectivity();
  }

  async close() {
    await this.driver?.close();
  }

  async ping() {
    const session = this.driver.session();
    try {
      await session.run("RETURN 1");
    } finally {
      await session.close();
    }
  }

  async ensureSchema() {
    const session = this.driver.session();
    try {
      await session.run("CREATE CONSTRAINT node_id IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE");
      await session.run("CREATE INDEX node_age IF NOT EXISTS FOR (n:Person) ON (n.age)");
    } catch (e) {
      // Memgraph uses different index DDL syntax; fall back.
      try {
        await session.run("CREATE INDEX ON :Person(id)");
        await session.run("CREATE INDEX ON :Person(age)");
      } catch (_) {
        console.warn(`[${this.name}] schema/index creation warning:`, e.message);
      }
    } finally {
      await session.close();
    }
  }

  async loadNodes(rows) {
    const session = this.driver.session();
    try {
      await session.run(
        "UNWIND $rows AS row CREATE (n:Person {id: row.id, age: row.age})",
        { rows }
      );
    } finally {
      await session.close();
    }
  }

  async loadEdges(rows) {
    const session = this.driver.session();
    try {
      await session.run(
        `UNWIND $rows AS row
         MATCH (a:Person {id: row.src}), (b:Person {id: row.dst})
         CREATE (a)-[:KNOWS]->(b)`,
        { rows }
      );
    } finally {
      await session.close();
    }
  }

  async traversal(startId, hops) {
    const session = this.driver.session();
    try {
      const cypher = `MATCH (a:Person {id: $id})-[:KNOWS*${hops}..${hops}]->(b) RETURN count(DISTINCT b) AS c`;
      const res = await session.run(cypher, { id: startId });
      return res.records[0]?.get("c")?.toNumber?.() ?? 0;
    } finally {
      await session.close();
    }
  }

  async pointLookup(id) {
    const session = this.driver.session();
    try {
      const res = await session.run("MATCH (n:Person {id: $id}) RETURN n", { id });
      return res.records.length;
    } finally {
      await session.close();
    }
  }

  async indexedLookup(age) {
    const session = this.driver.session();
    try {
      const res = await session.run("MATCH (n:Person {age: $age}) RETURN count(n) AS c", { age });
      return res.records[0]?.get("c")?.toNumber?.() ?? 0;
    } finally {
      await session.close();
    }
  }

  async aggregation() {
    const session = this.driver.session();
    try {
      const res = await session.run(
        "MATCH (n:Person) RETURN n.age AS age, count(*) AS c ORDER BY age"
      );
      return res.records.length;
    } finally {
      await session.close();
    }
  }

  async write(id) {
    const session = this.driver.session();
    try {
      await session.run(
        "MATCH (n:Person {id: $id}) SET n.touched = timestamp()",
        { id }
      );
    } finally {
      await session.close();
    }
  }

  async footprint() {
    const session = this.driver.session();
    try {
      // Best-effort: works on Neo4j/Memgraph via APOC/system procs; not
      // guaranteed on every platform, hence the try/catch and honest fallback.
      const res = await session.run(
        "CALL dbms.listConfig() YIELD name, value WHERE name CONTAINS 'memory' RETURN name, value LIMIT 1"
      ).catch(() => null);
      return {
        storedBytes: null,
        memoryBytes: null,
        note: res ? "partial config visible, see raw logs" : "not exposed via Bolt on this platform",
      };
    } finally {
      await session.close();
    }
  }
}
