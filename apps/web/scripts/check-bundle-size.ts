import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Budget in bytes (e.g., 500 KB per chunk)
// If you need to update the budget, increase this value deliberately
// to ensure you are aware of the bundle size increase.
const MAX_CHUNK_SIZE_BYTES = 500 * 1024; // 500 KB

const ASSETS_DIR = join(process.cwd(), ".output", "public", "assets");

function checkBundleSize() {
  console.log(`Checking bundle sizes against budget of ${MAX_CHUNK_SIZE_BYTES / 1024} KB...`);
  
  let hasError = false;
  let files;
  
  try {
    files = readdirSync(ASSETS_DIR);
  } catch (err) {
    console.error(`Failed to read directory ${ASSETS_DIR}. Did the build succeed?`);
    process.exit(1);
  }

  const jsFiles = files.filter(f => f.endsWith(".js"));

  for (const file of jsFiles) {
    const filePath = join(ASSETS_DIR, file);
    const stats = statSync(filePath);
    
    if (stats.size > MAX_CHUNK_SIZE_BYTES) {
      console.error(`❌ ERROR: Chunk ${file} exceeds the budget! Size: ${(stats.size / 1024).toFixed(2)} KB, Budget: ${MAX_CHUNK_SIZE_BYTES / 1024} KB`);
      console.error(`If this increase is expected, update MAX_CHUNK_SIZE_BYTES in scripts/check-bundle-size.ts.`);
      hasError = true;
    } else {
      console.log(`✅ ${file} is within budget (${(stats.size / 1024).toFixed(2)} KB)`);
    }
  }

  if (hasError) {
    process.exit(1);
  }
  
  console.log("Bundle size check passed.");
}

checkBundleSize();
