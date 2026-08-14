export function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return null;
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.min(Math.max(idx, 0), sortedMs.length - 1)];
}

export function summarize(latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: round2(percentile(sorted, 50)),
    p95: round2(percentile(sorted, 95)),
    p99: round2(percentile(sorted, 99)),
    min: round2(sorted[0]),
    max: round2(sorted[sorted.length - 1]),
    meanMs: round2(sorted.reduce((a, b) => a + b, 0) / sorted.length),
  };
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

// Times an async fn, returns { result, ms }
export async function timeIt(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  return { result, ms: Number(end - start) / 1_000_000 };
}
