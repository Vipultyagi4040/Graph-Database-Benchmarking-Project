// Downloads the raw SNAP soc-Pokec social network dataset.
// Source: https://snap.stanford.edu/data/soc-Pokec.html
// Full graph: 1,632,803 nodes / 30,622,564 directed edges.
// We only need the edge list here; prepare-dataset.js subsamples it down
// to the 100k-500k relationship range required by the assignment.

import fs from "fs";
import path from "path";
import zlib from "zlib";
import https from "https";

const RAW_DIR = path.resolve("data/raw");
const EDGES_URL = "https://snap.stanford.edu/data/soc-pokec-relationships.txt.gz";
const EDGES_GZ = path.join(RAW_DIR, "soc-pokec-relationships.txt.gz");
const EDGES_TXT = path.join(RAW_DIR, "soc-pokec-relationships.txt");

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          return resolve(download(res.headers.location, destPath));
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (fs.existsSync(EDGES_TXT)) {
    console.log("Raw edge list already present, skipping download.");
    return;
  }

  console.log(`Downloading ${EDGES_URL} ...`);
  await download(EDGES_URL, EDGES_GZ);

  console.log("Decompressing ...");
  const gz = fs.readFileSync(EDGES_GZ);
  const txt = zlib.gunzipSync(gz);
  fs.writeFileSync(EDGES_TXT, txt);
  fs.unlinkSync(EDGES_GZ);

  console.log(`Done. Raw edge list at ${EDGES_TXT}`);
}

main().catch((err) => {
  console.error(err);
  console.error(
    "\nIf the download fails (SNAP occasionally rate-limits or the mirror moves), " +
      "download soc-pokec-relationships.txt.gz manually from " +
      "https://snap.stanford.edu/data/soc-Pokec.html and place the decompressed .txt " +
      "file at data/raw/soc-pokec-relationships.txt"
  );
  process.exit(1);
});
