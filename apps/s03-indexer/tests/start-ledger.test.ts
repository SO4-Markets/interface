import { describe, expect, test } from "bun:test";
import { resolveIndexerStartLedger } from "../project";

describe("indexer start ledger resolution", () => {
  test("resumes from a stored checkpoint ledger", () => {
    const startLedger = resolveIndexerStartLedger({
      configuredGenesis: 228206,
      checkpointPath: "/tmp/indexer-checkpoint.json",
      exists: () => true,
      readFile: () => JSON.stringify({ lastProcessedLedger: 314159 }),
    });

    expect(startLedger).toBe(314159);
  });

  test("falls back to the configured genesis ledger when checkpoint is missing", () => {
    const startLedger = resolveIndexerStartLedger({
      configuredGenesis: 228206,
      checkpointPath: "/tmp/missing-checkpoint.json",
      exists: () => false,
      readFile: () => {
        throw new Error("checkpoint should not be read");
      },
    });

    expect(startLedger).toBe(228206);
  });

  test("accepts SubQuery metadata checkpoint height", () => {
    const startLedger = resolveIndexerStartLedger({
      configuredGenesis: 1,
      checkpointPath: "/tmp/subquery-metadata.json",
      exists: () => true,
      readFile: () => JSON.stringify({ lastProcessedHeight: 987654 }),
    });

    expect(startLedger).toBe(987654);
  });
});
