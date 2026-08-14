import { execSync } from "child_process";
import { PLATFORMS } from "./config.js";

// Runs load + benchmark for every platform in config.js, one at a time
// (never concurrently across platforms -- that would contend for local
// client resources and skew results). A failure on one platform is logged
// and the run continues to the rest, per the assignment's instruction to
// record failed runs honestly rather than hiding them.
const results = {};

for (const key of Object.keys(PLATFORMS)) {
  console.log(`\n=================== ${PLATFORMS[key].label} ===================`);
  try {
    execSync(`node src/runLoad.js ${key}`, { stdio: "inherit" });
    execSync(`node src/runBenchmark.js ${key}`, { stdio: "inherit" });
    results[key] = "ok";
  } catch (e) {
    console.error(`!!! ${key} FAILED, continuing with remaining platforms.`);
    results[key] = "failed";
  }
}

console.log("\n\nRun summary:", results);
console.log("Now run: npm run report");
