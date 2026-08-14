# Platform Setup Guide

Free-tier signup flows and limits change fairly often, so treat the steps
below as a map, not gospel — if a button has moved or a tier name has
changed since this was written, the provider's current docs (linked in each
section) are the source of truth. Record whatever specs you actually get in
`src/config.js` and the README fairness table.

## 1. CognoDB Cloud

Already covered in the assignment brief:
1. Sign up at https://console.cognodb.com/signup (no credit card).
2. Create a free (c0) instance, pick a region.
3. Save the `bolt+s://...` URI and the generated `cognodb` password — shown once.
4. Put both in `.env` as `COGNODB_URI` / `COGNODB_PASSWORD`.

## 2. Neo4j Aura Free

Docs: https://neo4j.com/docs/aura/getting-started/create-instance/

1. Go to https://console.neo4j.io and sign up (no credit card required for
   the Free tier).
2. Click **Create instance**, choose **AuraDB Free**, pick a region — ideally
   the same cloud region as your other instances, to keep network latency
   comparable across platforms.
3. Aura generates a password shown **once** — download the credentials file
   immediately.
4. Note the connection URI, of the form `neo4j+s://<id>.databases.neo4j.io`.
5. Fill in `.env`: `NEO4J_URI`, `NEO4J_USER=neo4j`, `NEO4J_PASSWORD`.

## 3. Memgraph Cloud

Docs: https://memgraph.com/docs/getting-started/install-memgraph/memgraph-cloud

1. Go to https://cloud.memgraph.com/signup and sign up (email or Google).
2. Verify your email.
3. Create a project/instance on the smallest available tier. Memgraph's
   entry-level cloud tier has changed names/limits over time (free trial vs.
   a permanently free "Hobby"-style tier) — pick whichever is currently the
   smallest, no-credit-card option, and **record its actual advertised
   vCPU/RAM/disk in `src/config.js`**, since it may not exactly match
   CognoDB's 256 MB/0.5 vCPU and that gap needs to be called out as a
   fairness caveat if so.
4. Memgraph Cloud connections also use `bolt+s://` with SSL, same as
   CognoDB — copy the URI, default user is typically `memgraph`.
5. Fill in `.env`: `MEMGRAPH_URI`, `MEMGRAPH_USER`, `MEMGRAPH_PASSWORD`.

## 4. ArangoDB Oasis

Docs: https://docs.arangodb.com/stable/cloud/

1. Go to https://cloud.arangodb.com/ and sign up for the free trial (Oasis
   typically gives a time-boxed credit rather than a permanently free tier —
   note the trial length and remaining credit in your README caveats).
2. Create a new deployment on the smallest available node size (single
   server, smallest RAM tier offered).
3. From the deployment's **Connect** tab, copy the HTTPS endpoint
   (`https://<id>.arangodb.cloud:8529`) and the `root` password you set at
   creation time.
4. Fill in `.env`: `ARANGO_URL`, `ARANGO_USER=root`, `ARANGO_PASSWORD`,
   `ARANGO_DB=benchmark` (the adapter creates this database automatically on
   first connect).

## 5. TigerGraph Cloud

Docs: https://docs.tigergraph.com/cloud/

1. Go to https://tgcloud.io/ and sign up for a free account.
2. Create a new free-tier instance (TigerGraph's free tier is sized well
   above CognoDB's — this is a real resource mismatch; **document it
   explicitly in the README fairness caveats rather than hiding it**, since
   TigerGraph doesn't currently offer a comparably small tier).
3. Once provisioned, open the **GraphStudio** or use the `gsql` CLI to run
   `src/adapters/tigergraph_schema.gsql` **once** — this creates the vertex
   type, edge type, and installs the queries the adapter calls over REST.
   TigerGraph's REST API cannot create schema on its own, unlike the other
   four platforms, so this manual step is unavoidable and should be called
   out as a methodology note, not hidden.
4. Note your instance's REST++ host (`https://<id>.i.tgcloud.io`) and the
   username/password you set at signup.
5. Fill in `.env`: `TIGERGRAPH_HOST`, `TIGERGRAPH_USER`,
   `TIGERGRAPH_PASSWORD`, `TIGERGRAPH_GRAPH=benchmark`.

## After setup

Run `node -e "console.log('ok')"` style connectivity checks are built into
each `runLoad.js` call (`adapter.ping()` runs first and fails loudly with a
clear error if a platform is unreachable) — so the fastest way to confirm
everything is wired up correctly is just to run:

```bash
node src/runLoad.js cognodb
```

against each platform in turn before doing a full `npm run all`.
