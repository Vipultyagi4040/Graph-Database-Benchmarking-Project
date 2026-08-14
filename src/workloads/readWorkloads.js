import { timeIt, summarize } from "../metrics.js";

function pickRandomIds(nodeCount, n) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(Math.floor(Math.random() * nodeCount));
  return ids;
}

// Runs `warmupCount` untimed calls, then `iterations` timed calls, returning
// a percentile summary. Random start nodes are drawn per-iteration so the
// numbers reflect a realistic mix rather than one cached hot path.
async function runTimedLoop({ iterations, warmupCount, callFn }) {
  for (let i = 0; i < warmupCount; i++) await callFn();
  const latencies = [];
  for (let i = 0; i < iterations; i++) {
    const { ms } = await timeIt(callFn);
    latencies.push(ms);
  }
  return summarize(latencies);
}

export async function runTraversalWorkload(adapter, nodeCount, iterations) {
  const warmupIds = pickRandomIds(nodeCount, 10);
  const testIds = pickRandomIds(nodeCount, iterations);
  const results = {};

  for (const hops of [1, 2, 3]) {
    let idx = 0;
    for (const id of warmupIds) await adapter.traversal(id, hops);
    results[`${hops}hop`] = await runTimedLoop({
      iterations,
      warmupCount: 0, // warm-up already done once per hop-depth above
      callFn: () => adapter.traversal(testIds[idx++ % testIds.length], hops),
    });
  }
  return results;
}

export async function runLookupWorkload(adapter, nodeCount, ages, iterations) {
  const testIds = pickRandomIds(nodeCount, iterations);
  let idx = 0;
  const pointLookup = await runTimedLoop({
    iterations,
    warmupCount: 10,
    callFn: () => adapter.pointLookup(testIds[idx++ % testIds.length]),
  });

  let ageIdx = 0;
  const indexedLookup = await runTimedLoop({
    iterations,
    warmupCount: 10,
    callFn: () => adapter.indexedLookup(ages[ageIdx++ % ages.length]),
  });

  return { pointLookup, indexedLookup };
}

export async function runAggregationWorkload(adapter, iterations) {
  return runTimedLoop({
    iterations,
    warmupCount: 5,
    callFn: () => adapter.aggregation(),
  });
}
