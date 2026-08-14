import { timeIt } from "../metrics.js";

// Sustained read/write throughput at a given client concurrency.
// Mix: 80% reads (point lookup), 20% writes (single-property upsert), a
// common OLTP-ish ratio. Runs for `durationMs` wall-clock time with
// `concurrency` workers hammering the platform in parallel, then reports
// completed-ops/sec -- this measures sustained throughput, not single-call
// latency (that's what the read workloads above are for).
export async function runMixedWorkload(adapter, nodeCount, { concurrency, durationMs = 5000, readRatio = 0.8 }) {
  const deadline = Date.now() + durationMs;
  let completed = 0;
  let errors = 0;
  const latencies = [];

  async function worker() {
    while (Date.now() < deadline) {
      const id = Math.floor(Math.random() * nodeCount);
      const isRead = Math.random() < readRatio;
      try {
        const { ms } = await timeIt(() => (isRead ? adapter.pointLookup(id) : adapter.write(id)));
        latencies.push(ms);
        completed++;
      } catch (e) {
        errors++;
      }
    }
  }

  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const actualSeconds = (Date.now() - start) / 1000;

  return {
    concurrency,
    readRatio,
    completedOps: completed,
    errors,
    opsPerSecond: Math.round((completed / actualSeconds) * 100) / 100,
    actualDurationSeconds: Math.round(actualSeconds * 100) / 100,
  };
}
