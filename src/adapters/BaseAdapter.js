// Every adapter implements this interface so the harness (loader + workload
// runners) can drive any platform identically. Query languages differ
// (Cypher vs AQL vs GSQL) but the *operations* below are logically the same
// across platforms, which is what makes the comparison fair.
//
//   connect()                         -> establishes the connection/session
//   close()                           -> tears it down
//   ping()                            -> throws if the platform is unreachable
//   ensureSchema()                    -> creates the node label/vertex type,
//                                         edge type, and the index on `age`
//                                         used by the indexed-lookup workload
//   loadNodes(rows)                   -> batch-inserts [{id, age}, ...]
//   loadEdges(rows)                   -> batch-inserts [{src, dst}, ...]
//   traversal(startId, hops)          -> returns count of nodes reached at
//                                         exactly `hops` distance
//   pointLookup(id)                   -> fetch a single node by primary id
//   indexedLookup(age)                -> fetch all nodes with a given age
//   aggregation()                     -> count of nodes grouped by age,
//                                         return the group count (a single
//                                         number) so timing is comparable
//   write(id)                         -> a single lightweight write op used
//                                         by the mixed workload (upserts a
//                                         throwaway property on a node)
//   footprint()                       -> best-effort { storedBytes, memoryBytes }
//                                         or nulls with a note if not observable
//
// All timed methods should do the minimum client-side work necessary so the
// measured latency reflects the database, not JS overhead.

export class BaseAdapter {
  constructor(name) {
    this.name = name;
  }
  async connect() { throw new Error("not implemented"); }
  async close() { throw new Error("not implemented"); }
  async ping() { throw new Error("not implemented"); }
  async ensureSchema() { throw new Error("not implemented"); }
  async loadNodes(_rows) { throw new Error("not implemented"); }
  async loadEdges(_rows) { throw new Error("not implemented"); }
  async traversal(_startId, _hops) { throw new Error("not implemented"); }
  async pointLookup(_id) { throw new Error("not implemented"); }
  async indexedLookup(_age) { throw new Error("not implemented"); }
  async aggregation() { throw new Error("not implemented"); }
  async write(_id) { throw new Error("not implemented"); }
  async footprint() { return { storedBytes: null, memoryBytes: null, note: "not observable" }; }
}
