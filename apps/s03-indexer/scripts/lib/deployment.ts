// Read and validate contract-repo deployment outputs for the smoke flow.
//
// The contracts repo writes addresses to `.deployed/<network>.env` (core protocol
// contracts + market token triplets) and `.deployed/tokens-<network>.env` (test
// tokens + faucet). The smoke runner needs those addresses to drive deposits,
// orders, and price submission, and to decide whether a usable deployment already
// exists before it spends time redeploying.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type EnvMap = Record<string, string>;

const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export function isContractId(value: string | undefined): value is string {
  return typeof value === "string" && CONTRACT_ID.test(value);
}

export function readEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  const env: EnvMap = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export interface DeploymentPaths {
  deployEnv: string;
  tokenEnv: string;
}

export function deploymentPaths(contractsRepo: string, network: string): DeploymentPaths {
  return {
    deployEnv: path.join(contractsRepo, ".deployed", `${network}.env`),
    tokenEnv: path.join(contractsRepo, ".deployed", `tokens-${network}.env`),
  };
}

export interface LoadedDeployment {
  env: EnvMap;
  paths: DeploymentPaths;
}

/** Merge core + token env files (token values do not override core values). */
export function loadDeployment(contractsRepo: string, network: string): LoadedDeployment {
  const paths = deploymentPaths(contractsRepo, network);
  const env = { ...readEnvFile(paths.tokenEnv), ...readEnvFile(paths.deployEnv) };
  return { env, paths };
}

/** Core protocol contracts the smoke actions invoke directly. */
export const REQUIRED_CONTRACTS = [
  "ROLE_STORE",
  "DATA_STORE",
  "ORACLE",
  "MARKET_FACTORY",
  "DEPOSIT_HANDLER",
  "ORDER_HANDLER",
  "ORDER_VAULT",
  "EXCHANGE_ROUTER",
  "REFERRAL_STORAGE",
] as const;

export interface DeploymentCheck {
  ok: boolean;
  missing: string[];
  invalid: string[];
}

/** Verify all required core contracts are present and well-formed. */
export function checkCoreContracts(env: EnvMap): DeploymentCheck {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const key of REQUIRED_CONTRACTS) {
    const value = env[key];
    if (!value) {
      missing.push(key);
    } else if (!isContractId(value)) {
      invalid.push(key);
    }
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

export interface MarketTriplet {
  envKey: string;
  marketToken: string;
  indexToken: string;
  longToken: string;
  shortToken: string;
}

/** Resolve the market-token triplet for a long/short code pair, if bootstrapped. */
export function resolveMarket(
  env: EnvMap,
  longCode: string,
  shortCode: string,
): MarketTriplet | undefined {
  const envKey = `MARKET_TOKEN_${longCode}_${shortCode}`;
  const marketToken = env[envKey];
  const longToken = env[`${envKey}_LONG`];
  const shortToken = env[`${envKey}_SHORT`];
  const indexToken = env[`${envKey}_INDEX`] ?? longToken;

  if (![marketToken, longToken, shortToken, indexToken].every(isContractId)) {
    return undefined;
  }

  return { envKey, marketToken, indexToken, longToken, shortToken };
}

/** Resolve test-token contract IDs by ticker code. */
export function resolveToken(env: EnvMap, code: string): string | undefined {
  const value = env[code] ?? env[`${code}_NATIVE`];
  return isContractId(value) ? value : undefined;
}
