import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from "@subql/types-stellar";

import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const mode = process.env.NODE_ENV || 'production';

// Load the appropriate .env file
const dotenvPath = path.resolve(__dirname, `.env${mode !== 'production' ? `.${mode}` : ''}`);
dotenv.config({ path: dotenvPath, quiet: true });

type IndexerContractsConfig = {
  network?: {
    name?: string;
    passphrase?: string;
    horizonEndpoint?: string;
    sorobanRpcEndpoint?: string;
  };
  contracts?: Record<string, string>;
  tokens?: Record<string, string>;
  markets?: Array<{
    name: string;
    marketToken: string;
    indexToken: string;
    longToken: string;
    shortToken: string;
  }>;
};

const contractConfig = loadContractConfig();
const endpoint =
  process.env.ENDPOINT ??
  contractConfig?.network?.horizonEndpoint ??
  "https://horizon-testnet.stellar.org";
const chainId =
  process.env.CHAIN_ID ??
  contractConfig?.network?.passphrase ??
  "Test SDF Network ; September 2015";
const sorobanEndpoint =
  process.env.SOROBAN_ENDPOINT ??
  contractConfig?.network?.sorobanRpcEndpoint ??
  "https://soroban-testnet.stellar.org";
const indexedContractIds = getIndexedContractIds(contractConfig);
const startBlock = resolveIndexerStartLedger({
  configuredGenesis: process.env.INDEXER_START_LEDGER,
  checkpointPath: process.env.INDEXER_CHECKPOINT_PATH,
});

/* This is your project configuration */
const project: StellarProject = {
  specVersion: "1.0.0",
  name: "soroban-testnet-starter",
  version: "0.0.1",
  runner: {
    node: {
      name: "@subql/node-stellar",
      version: "*",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  description:
    "This project can be use as a starting point for developing your new Stellar SubQuery project (testnet)",
  repository: "https://github.com/subquery/stellar-subql-starter",
  schema: {
    file: "./schema.graphql",
  },
  network: {
    /* Stellar and Soroban uses the network passphrase as the chainId
      'Test SDF Network ; September 2015' for testnet
      'Public Global Stellar Network ; September 2015' for mainnet
      'Test SDF Future Network ; October 2022' for Future Network */
    chainId,
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: endpoint.split(',').map((value) => value.trim()),
    /* This is a specific Soroban endpoint
      It is only required when you are using a soroban/EventHandler */
    sorobanEndpoint,
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      /* Set this as a logical start block, it might be block 1 (genesis) or when your
         contract was deployed. Override with INDEXER_START_LEDGER for local runs, where
         a fresh standalone network must backfill from an early ledger. */
      startBlock,
      mapping: {
        file: "./dist/index.js",
        handlers: indexedContractIds.map((contractId) => ({
          handler: "handleEvent",
          kind: StellarHandlerKind.Event,
          filter: {
            contractId,
          },
        })),
      },
    },
  ],
};

// Must set default to the project instance
export default project;

export type IndexerStartLedgerOptions = {
  configuredGenesis?: string | number;
  checkpointPath?: string;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
};

export function resolveIndexerStartLedger({
  configuredGenesis,
  checkpointPath,
  exists = existsSync,
  readFile = (filePath) => readFileSync(filePath, "utf8"),
}: IndexerStartLedgerOptions = {}): number {
  const genesisLedger = parseLedger(configuredGenesis ?? 228206, "configured genesis ledger");

  if (!checkpointPath || !exists(checkpointPath)) {
    return genesisLedger;
  }

  const checkpointLedger = readCheckpointLedger(readFile(checkpointPath));
  return parseLedger(checkpointLedger, "stored checkpoint ledger");
}

function loadContractConfig(): IndexerContractsConfig | undefined {
  const network = process.env.INDEXER_NETWORK ?? "testnet";
  const configPath = process.env.INDEXER_CONTRACTS_CONFIG
    ? path.resolve(process.cwd(), process.env.INDEXER_CONTRACTS_CONFIG)
    : path.resolve(__dirname, "config", `contracts.${network}.json`);

  if (!existsSync(configPath)) {
    return undefined;
  }

  return JSON.parse(readFileSync(configPath, "utf8")) as IndexerContractsConfig;
}

function getIndexedContractIds(config: IndexerContractsConfig | undefined): string[] {
  if (!config) {
    const fallbackContractId = process.env.INDEXER_CONTRACT_ID;
    return fallbackContractId ? [fallbackContractId] : [];
  }

  const ids = new Set<string>();
  for (const value of Object.values(config.contracts ?? {})) {
    ids.add(value);
  }
  for (const value of Object.values(config.tokens ?? {})) {
    ids.add(value);
  }
  for (const market of config.markets ?? []) {
    ids.add(market.marketToken);
    ids.add(market.indexToken);
    ids.add(market.longToken);
    ids.add(market.shortToken);
  }

  return [...ids].sort();
}

function readCheckpointLedger(contents: string): unknown {
  const trimmed = contents.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const checkpoint = JSON.parse(trimmed) as Record<string, unknown>;
    return (
      checkpoint.lastProcessedLedger ??
      checkpoint.lastProcessedHeight ??
      checkpoint.ledger ??
      checkpoint.height
    );
  } catch {
    return trimmed;
  }
}

function parseLedger(value: unknown, label: string): number {
  const ledger = Number(value);
  if (!Number.isInteger(ledger) || ledger < 1) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return ledger;
}
