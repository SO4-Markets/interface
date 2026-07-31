import {
  AdlEvent,
  Deposit,
  FeeClaim,
  FundingFeeClaim,
  Liquidation,
  Market,
  MarketConfigSnapshot,
  MarketTokenTransfer,
  Order,
  Position,
  PositionChange,
  ProtocolContract,
  ReferralCode,
  ReferralOwnershipTransfer,
  Token,
  TraderReferral,
  UiFeeAccrual,
  Withdrawal,
} from "../types";
import { SorobanEvent } from "@subql/types-stellar";
import { Address, scValToBigInt, xdr } from "@stellar/stellar-sdk";

type EntityClass<T> = {
  create(record: Record<string, unknown>): T;
  get(id: string): Promise<T | undefined>;
};

type Saveable = {
  save(): Promise<void>;
};

type EventMeta = {
  id: string;
  contractAddress: string;
  contractKey?: string;
  eventName: string;
  ledger: number;
  timestamp: Date;
  transactionHash: string;
};

export type DecodedEvent = EventMeta & {
  topic: xdr.ScVal[];
  values: DecodedTuple;
};

type DecodedValue =
  | string
  | boolean
  | string[]
  | DecodedTuple
  | DecodedValue[]
  | undefined;

type DecodedTuple = {
  list: DecodedValue[];
  named: Record<string, DecodedValue>;
};

type ConfiguredContracts = {
  contractKeysByAddress: Map<string, string>;
  protocolAddresses: Set<string>;
  tokenAddresses: Set<string>;
  marketTokenAddresses: Set<string>;
  marketMetadataByToken: Map<string, MarketMetadata>;
};

type MarketMetadata = {
  name: string;
  marketToken: string;
  indexToken: string;
  longToken: string;
  shortToken: string;
};

type ContractConfig = {
  network?: { name?: string };
  contracts?: Record<string, string>;
  tokens?: Record<string, string>;
  markets?: MarketMetadata[];
};

declare const require: (path: string) => ContractConfig;

const ZERO_ADDRESS = "00000000000000000000000000000000000000000000000000000000";
const SO4_CONTRACTS = require("../../config/contracts.testnet.json");

const CONFIGURED_CONTRACTS = buildConfiguredContracts(SO4_CONTRACTS);
const MARKET_CREATED_INDEX = {
  marketToken: 0,
  indexToken: 1,
  longToken: 2,
  shortToken: 3,
} as const;
const REQUEST_CREATED_INDEX = {
  key: 0,
  account: 1,
  market: 2,
} as const;
const REQUEST_UPDATED_INDEX = {
  key: 0,
  account: 1,
} as const;
const POSITION_INCREASE_INDEX = {
  key: 0,
  account: 1,
  sizeDeltaUsd: 2,
  executionPrice: 3,
} as const;
const POSITION_DECREASE_INDEX = {
  ...POSITION_INCREASE_INDEX,
  pnlUsd: 4,
} as const;
const LIQUIDATION_REQUEST_INDEX = {
  account: 0,
  market: 1,
  isLong: 2,
} as const;
const LIQUIDATION_EXECUTED_INDEX = {
  account: 0,
  market: 1,
  pnlUsd: 2,
  executionPrice: 3,
} as const;
const ADL_REQUEST_INDEX = {
  account: 0,
  market: 1,
  isLong: 2,
  sizeDeltaUsd: 3,
  pnlUsd: 4,
} as const;
const ADL_EXECUTED_INDEX = {
  account: 0,
  market: 1,
  sizeDeltaUsd: 2,
  pnlUsd: 3,
} as const;
const INTEGER_TYPES = new Set([
  "scvU32",
  "scvI32",
  "scvU64",
  "scvI64",
  "scvU128",
  "scvI128",
  "scvU256",
  "scvI256",
]);
const TOKEN_EVENTS = new Set(["transfer", "mint", "burn", "approve", "claim", "faucet_claim"]);

export async function handleEvent(event: SorobanEvent): Promise<void> {
  try {
    const decoded = decodeSorobanEvent(event);
    if (!decoded) {
      return;
    }

    if (!isConfiguredContract(decoded.contractAddress)) {
      logger.info(
        `Skipping SO4 event ${event.id} from unconfigured contract ${decoded.contractAddress}`,
      );
      return;
    }

    await dispatchEvent(decoded);
  } catch (error) {
    logger.warn(
      JSON.stringify({
        msg: "Skipping malformed SO4 event",
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function dispatchEvent(event: DecodedEvent): Promise<void> {
  switch (event.eventName) {
    case "mkt_new":
      await handleMarketCreated(event);
      return;
    case "dep_crt":
    case "dep_exe":
    case "dep_can":
      await handleDeposit(event);
      return;
    case "wth_crt":
    case "wth_exe":
    case "wth_can":
      await handleWithdrawal(event);
      return;
    case "ord_crt":
    case "ord_exe":
    case "ord_can":
    case "ord_upd":
    case "ord_frz":
      await handleOrder(event);
      return;
    case "pos_inc":
    case "pos_dec":
      await handlePosition(event);
      return;
    case "liq_req":
    case "liq_exe":
      await handleLiquidation(event);
      return;
    case "adl_req":
    case "adl_exe":
      await handleAdl(event);
      return;
    case "fee_clm":
      await handleFeeClaim(event);
      return;
    case "fnd_clm":
      await handleFundingClaim(event);
      return;
    case "ui_fee_acc":
    case "ui_fee_clm":
    case "ui_fee_set":
      await handleUiFee(event);
      return;
    case "ref_reg":
    case "ref_set":
    case "ref_xfr":
      await handleReferral(event);
      return;
    default:
      if (TOKEN_EVENTS.has(event.eventName)) {
        await handleTokenEvent(event);
        return;
      }
      logger.info(
        JSON.stringify({
          msg: "Skipping unknown SO4 event",
          eventId: event.id,
          contractId: event.contractAddress,
          eventName: event.eventName,
        }),
      );
  }
}

export function decodeSorobanEvent(event: SorobanEvent): DecodedEvent | undefined {
  const eventName = decodeTopicName(event.topic[0]);
  if (!eventName) {
    logger.info(`Skipping event ${event.id}: first topic is not a symbol/string`);
    return undefined;
  }

  const contractAddress = decodeContractId(event.contractId);
  if (!contractAddress) {
    logger.info(`Skipping event ${event.id}: missing contract id`);
    return undefined;
  }

  return {
    id: event.id,
    contractAddress,
    contractKey: CONFIGURED_CONTRACTS.contractKeysByAddress.get(contractAddress),
    eventName,
    ledger: event.ledger?.sequence ?? 0,
    timestamp: new Date(event.ledgerClosedAt),
    transactionHash: event.txHash ?? "",
    topic: event.topic,
    values: decodeTuple(event.value),
  };
}

export function decodeTopicName(scVal: xdr.ScVal | undefined): string | undefined {
  if (!scVal) {
    return undefined;
  }

  const valueType = scVal.switch().name;
  if (valueType === "scvSymbol") {
    return scVal.sym().toString();
  }
  if (valueType === "scvString") {
    return scVal.str().toString();
  }
  return undefined;
}

export function decodeAddress(scVal: xdr.ScVal | undefined): string | undefined {
  if (!scVal || scVal.switch().name !== "scvAddress") {
    return undefined;
  }

  const address = scVal.address();
  const addressType = address.switch().value;
  if (addressType === 0) {
    return Address.account(address.accountId().ed25519()).toString();
  }
  if (addressType === 1) {
    return Address.contract(address.contractId() as unknown as Buffer).toString();
  }

  return undefined;
}

export function decodeBytesN32(scVal: xdr.ScVal | undefined): string | undefined {
  if (!scVal || scVal.switch().name !== "scvBytes") {
    return undefined;
  }

  const bytes = Buffer.from(scVal.bytes());
  if (bytes.length !== 32) {
    return undefined;
  }
  return bytes.toString("hex");
}

export function decodeBoolean(scVal: xdr.ScVal | undefined): boolean | undefined {
  if (!scVal) {
    return undefined;
  }
  if (scVal.switch().name === "scvBool") {
    return scVal.b();
  }
  return undefined;
}

export function decodeInteger(scVal: xdr.ScVal | undefined): string | undefined {
  if (!scVal || !INTEGER_TYPES.has(scVal.switch().name)) {
    return undefined;
  }
  return scValToBigInt(scVal).toString();
}

export function decodeTuple(scVal: xdr.ScVal | undefined): DecodedTuple {
  const empty = { list: [], named: {} };
  if (!scVal) {
    return empty;
  }

  if (scVal.switch().name === "scvVec") {
    const list = (scVal.vec() ?? []).map((value) => decodeScVal(value));
    return { list, named: {} };
  }

  if (scVal.switch().name === "scvMap") {
    const named: Record<string, DecodedValue> = {};
    for (const entry of scVal.map() ?? []) {
      const key = decodeTopicName(entry.key()) ?? decodeString(entry.key());
      if (key) {
        named[key] = decodeScVal(entry.val());
      }
    }
    return { list: [], named };
  }

  return { list: [decodeScVal(scVal)], named: {} };
}

function decodeScVal(scVal: xdr.ScVal): DecodedValue {
  const typeName = scVal.switch().name;
  if (typeName === "scvSymbol" || typeName === "scvString") {
    return decodeString(scVal);
  }
  if (typeName === "scvAddress") {
    return decodeAddress(scVal);
  }
  if (INTEGER_TYPES.has(typeName)) {
    return decodeInteger(scVal);
  }
  if (typeName === "scvBool") {
    return decodeBoolean(scVal);
  }
  if (typeName === "scvBytes") {
    return decodeBytesN32(scVal) ?? Buffer.from(scVal.bytes()).toString("hex");
  }
  if (typeName === "scvVec") {
    return (scVal.vec() ?? []).map((value) => decodeScVal(value));
  }
  if (typeName === "scvMap") {
    return decodeTuple(scVal);
  }
  return typeName;
}

function decodeString(scVal: xdr.ScVal | undefined): string | undefined {
  if (!scVal) {
    return undefined;
  }
  if (scVal.switch().name === "scvString") {
    return scVal.str().toString();
  }
  if (scVal.switch().name === "scvSymbol") {
    return scVal.sym().toString();
  }
  return undefined;
}

function decodeContractId(contractId: SorobanEvent["contractId"]): string | undefined {
  if (!contractId) {
    return undefined;
  }

  return Address.contract(contractId.contractId() as unknown as Buffer).toString();
}

function isConfiguredContract(contractAddress: string): boolean {
  return (
    CONFIGURED_CONTRACTS.protocolAddresses.has(contractAddress) ||
    CONFIGURED_CONTRACTS.tokenAddresses.has(contractAddress) ||
    CONFIGURED_CONTRACTS.marketTokenAddresses.has(contractAddress)
  );
}

async function handleMarketCreated(event: DecodedEvent): Promise<void> {
  const marketToken = fieldString(event, ["market_token", "marketToken"], MARKET_CREATED_INDEX.marketToken) ?? event.contractAddress;
  const metadata = CONFIGURED_CONTRACTS.marketMetadataByToken.get(marketToken);
  const marketKey = fieldString(event, ["market", "market_key", "key"], MARKET_CREATED_INDEX.marketToken) ?? marketToken;
  const id = marketId(marketKey);
  const contract = await ensureProtocolContract(event.contractAddress, event);

  await ensureToken(marketToken, event, "market");
  if (metadata) {
    await ensureToken(metadata.indexToken, event, "index");
    await ensureToken(metadata.longToken, event, "long");
    await ensureToken(metadata.shortToken, event, "short");
  }

  const market = await upsert(Market, id, {
    id,
    key: marketKey,
    contractId: contract.id,
    marketTokenId: marketToken,
    indexTokenId: fieldString(event, ["index_token", "indexToken"], MARKET_CREATED_INDEX.indexToken) ?? metadata?.indexToken,
    longTokenId: fieldString(event, ["long_token", "longToken"], MARKET_CREATED_INDEX.longToken) ?? metadata?.longToken,
    shortTokenId: fieldString(event, ["short_token", "shortToken"], MARKET_CREATED_INDEX.shortToken) ?? metadata?.shortToken,
    name: fieldString(event, ["name"], 2) ?? metadata?.name,
    status: "ACTIVE",
    createdBy: fieldString(event, ["account", "creator", "sender"], 3),
    createdLedger: event.ledger,
    createdTimestamp: event.timestamp,
    createdTransactionHash: event.transactionHash,
  });

  const snapshotId = deterministicId("market-config", market.key, event.ledger.toString());
  const snapshot = await upsert(MarketConfigSnapshot, snapshotId, {
    id: snapshotId,
    marketId: market.id,
    key: market.key,
    version: parseOptionalNumber(fieldString(event, ["version"], 4)),
    rawConfig: JSON.stringify(event.values.named),
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await snapshot.save();
  market.latestConfigSnapshotId = snapshot.id;
  await market.save();
}

async function handleDeposit(event: DecodedEvent): Promise<void> {
  const key = lifecycleKey(event, "deposit");
  const market = await ensureMarketForEvent(event, REQUEST_CREATED_INDEX.market);
  const account = requiredAccount(event, REQUEST_CREATED_INDEX.account);
  const id = deterministicId("deposit", key);
  const status = statusForEvent(event.eventName, "deposit");
  const deposit = await upsert(Deposit, id, {
    id,
    key,
    marketId: market.id,
    account,
    receiver: fieldString(event, ["receiver"], REQUEST_UPDATED_INDEX.account),
    status,
    longTokenAmount: fieldString(event, ["long_amount", "longTokenAmount"], 4),
    shortTokenAmount: fieldString(event, ["short_amount", "shortTokenAmount"], 5),
    minMarketTokens: fieldString(event, ["min_market_tokens", "minMarketTokens"], 6),
    marketTokenAmount: fieldString(event, ["market_token_amount", "marketTokenAmount"], 2),
    executionFee: fieldString(event, ["execution_fee", "executionFee"], 8),
  });

  setLifecycleFields(deposit, event, status);
  await deposit.save();
}

async function handleWithdrawal(event: DecodedEvent): Promise<void> {
  const key = lifecycleKey(event, "withdrawal");
  const market = await ensureMarketForEvent(event, REQUEST_CREATED_INDEX.market);
  const account = requiredAccount(event, REQUEST_CREATED_INDEX.account);
  const id = deterministicId("withdrawal", key);
  const status = statusForEvent(event.eventName, "withdrawal");
  const withdrawal = await upsert(Withdrawal, id, {
    id,
    key,
    marketId: market.id,
    account,
    receiver: fieldString(event, ["receiver"], REQUEST_UPDATED_INDEX.account),
    status,
    marketTokenAmount: fieldString(event, ["market_token_amount", "marketTokenAmount"], 4),
    minLongTokenAmount: fieldString(event, ["min_long_amount", "minLongTokenAmount"], 5),
    minShortTokenAmount: fieldString(event, ["min_short_amount", "minShortTokenAmount"], 6),
    longTokenAmount: fieldString(event, ["long_amount", "longTokenAmount"], 2),
    shortTokenAmount: fieldString(event, ["short_amount", "shortTokenAmount"], 3),
    executionFee: fieldString(event, ["execution_fee", "executionFee"], 9),
  });

  setLifecycleFields(withdrawal, event, status);
  await withdrawal.save();
}

async function handleOrder(event: DecodedEvent): Promise<void> {
  const key = lifecycleKey(event, "order");
  const market = await ensureMarketForEvent(event, REQUEST_CREATED_INDEX.market);
  const account = requiredAccount(event, REQUEST_CREATED_INDEX.account);
  const id = deterministicId("order", key);
  const status = statusForEvent(event.eventName, "order");
  const order = await upsert(Order, id, {
    id,
    key,
    marketId: market.id,
    account,
    receiver: fieldString(event, ["receiver"], REQUEST_UPDATED_INDEX.account),
    positionKey: fieldString(event, ["position_key", "positionKey"], 4),
    orderType: fieldString(event, ["order_type", "orderType"], 5) ?? event.eventName,
    status,
    isLong: fieldBoolean(event, ["is_long", "isLong"], 6),
    collateralTokenId: fieldString(event, ["collateral_token", "collateralToken"], 7),
    swapPath: serializeOptional(fieldValue(event, ["swap_path", "swapPath"], 8)),
    sizeDeltaUsd: fieldString(event, ["size_delta_usd", "sizeDeltaUsd"], 9),
    collateralDeltaAmount: fieldString(event, ["collateral_delta_amount", "collateralDeltaAmount"], 10),
    triggerPrice: fieldString(event, ["trigger_price", "triggerPrice"], 11),
    acceptablePrice: fieldString(event, ["acceptable_price", "acceptablePrice"], 12),
    executionFee: fieldString(event, ["execution_fee", "executionFee"], 13),
    referralCode: fieldString(event, ["referral_code", "referralCode"], 14),
  });

  setOrderLifecycleFields(order, event, status);
  await order.save();
}

async function handlePosition(event: DecodedEvent): Promise<void> {
  const market = await ensureMarketForEvent(event);
  const account = requiredAccount(event, POSITION_INCREASE_INDEX.account);
  const key = fieldString(event, ["position_key", "positionKey", "key"], POSITION_INCREASE_INDEX.key)
    ?? `${account}:${market.id}:${fieldString(event, ["collateral_token", "collateralToken"], 3) ?? "collateral"}:${fieldBoolean(event, ["is_long", "isLong"], 4) ? "long" : "short"}`;
  const id = deterministicId("position", key);
  const isLong = fieldBoolean(event, ["is_long", "isLong"], 4) ?? false;
  const position = await upsert(Position, id, {
    id,
    key,
    marketId: market.id,
    account,
    collateralTokenId: fieldString(event, ["collateral_token", "collateralToken"], 3),
    isLong,
    status: event.eventName === "pos_dec" ? "DECREASED" : "OPEN",
    sizeUsd: fieldString(event, ["next_size_usd", "size_usd", "sizeUsd"], POSITION_INCREASE_INDEX.sizeDeltaUsd),
    collateralAmount: fieldString(event, ["next_collateral_amount", "collateral_amount", "collateralAmount"], 6),
    averagePrice: fieldString(event, ["average_price", "averagePrice"], 7),
    entryFundingRate: fieldString(event, ["entry_funding_rate", "entryFundingRate"], 8),
    reserveAmount: fieldString(event, ["reserve_amount", "reserveAmount"], 9),
    realizedPnlUsd: fieldString(event, ["realized_pnl_usd", "realizedPnlUsd"], POSITION_DECREASE_INDEX.pnlUsd),
    realizedPnlAmount: fieldString(event, ["realized_pnl_amount", "realizedPnlAmount"], 11),
    latestOrderKey: fieldString(event, ["order_key", "orderKey"], 12),
    openedLedger: event.eventName === "pos_inc" ? event.ledger : undefined,
    openedTimestamp: event.eventName === "pos_inc" ? event.timestamp : undefined,
    openedTransactionHash: event.eventName === "pos_inc" ? event.transactionHash : undefined,
    updatedLedger: event.ledger,
    updatedTimestamp: event.timestamp,
    updatedTransactionHash: event.transactionHash,
  });

  await position.save();
  await savePositionChange(event, market.id, position.id, account, event.eventName === "pos_inc" ? "INCREASE" : "DECREASE");
}

async function handleLiquidation(event: DecodedEvent): Promise<void> {
  const market = await ensureMarketForEvent(event, LIQUIDATION_REQUEST_INDEX.market);
  const account = requiredAccount(event, LIQUIDATION_REQUEST_INDEX.account);
  const key = fieldString(event, ["liquidation_key", "position_key", "key"], 0) ?? event.id;
  const id = deterministicId("liquidation", key);
  const liquidation = await upsert(Liquidation, id, {
    id,
    key,
    marketId: market.id,
    positionId: deterministicId("position", fieldString(event, ["position_key", "positionKey"], 1) ?? key),
    account,
    liquidator: fieldString(event, ["liquidator"], 3),
    collateralTokenId: fieldString(event, ["collateral_token", "collateralToken"], 4),
    status: event.eventName === "liq_exe" ? "EXECUTED" : "REQUESTED",
    isLong: fieldBoolean(event, ["is_long", "isLong"], LIQUIDATION_REQUEST_INDEX.isLong),
    sizeDeltaUsd: fieldString(event, ["size_delta_usd", "sizeDeltaUsd"], 6),
    collateralLiquidatedAmount: fieldString(event, ["collateral_liquidated_amount", "collateralLiquidatedAmount"], 7),
    remainingCollateralAmount: fieldString(event, ["remaining_collateral_amount", "remainingCollateralAmount"], 8),
    liquidationPrice: fieldString(event, ["liquidation_price", "liquidationPrice"], LIQUIDATION_EXECUTED_INDEX.executionPrice),
    pnlUsd: fieldString(event, ["pnl_usd", "pnlUsd"], LIQUIDATION_EXECUTED_INDEX.pnlUsd),
    priceImpactUsd: fieldString(event, ["price_impact_usd", "priceImpactUsd"], 11),
    liquidationFeeUsd: fieldString(event, ["liquidation_fee_usd", "liquidationFeeUsd"], 12),
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await liquidation.save();
}

async function handleAdl(event: DecodedEvent): Promise<void> {
  const adlIndex = event.eventName === "adl_exe" ? ADL_EXECUTED_INDEX : ADL_REQUEST_INDEX;
  const market = await ensureMarketForEvent(event, adlIndex.market);
  const account = requiredAccount(event, adlIndex.account);
  const key = fieldString(event, ["adl_key", "position_key", "key"], 0) ?? event.id;
  const id = deterministicId("adl", key);
  const adl = await upsert(AdlEvent, id, {
    id,
    key,
    marketId: market.id,
    positionId: deterministicId("position", fieldString(event, ["position_key", "positionKey"], 1) ?? key),
    account,
    collateralTokenId: fieldString(event, ["collateral_token", "collateralToken"], 3),
    status: event.eventName === "adl_exe" ? "EXECUTED" : "REQUESTED",
    isLong: event.eventName === "adl_req" ? fieldBoolean(event, ["is_long", "isLong"], ADL_REQUEST_INDEX.isLong) : undefined,
    sizeReductionUsd: fieldString(event, ["size_reduction_usd", "sizeReductionUsd"], adlIndex.sizeDeltaUsd),
    collateralReductionAmount: fieldString(event, ["collateral_reduction_amount", "collateralReductionAmount"], 6),
    executionPrice: fieldString(event, ["execution_price", "executionPrice"], 7),
    pnlUsd: fieldString(event, ["pnl_usd", "pnlUsd"], adlIndex.pnlUsd),
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await adl.save();
}

async function handleFeeClaim(event: DecodedEvent): Promise<void> {
  const id = deterministicId("fee-claim", fieldString(event, ["key"], 0) ?? event.id);
  const claim = await upsert(FeeClaim, id, {
    id,
    key: fieldString(event, ["key"], 0) ?? event.id,
    marketId: maybeMarketId(event),
    tokenId: fieldString(event, ["token"], 3),
    account: requiredAccount(event),
    receiver: fieldString(event, ["receiver"], 2),
    feeType: fieldString(event, ["fee_type", "feeType"], 4) ?? event.eventName,
    amount: fieldString(event, ["amount"], 5) ?? "0",
    amountUsd: fieldString(event, ["amount_usd", "amountUsd"], 6),
    status: "CLAIMED",
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await claim.save();
}

async function handleFundingClaim(event: DecodedEvent): Promise<void> {
  const key = fieldString(event, ["key", "position_key", "positionKey"], 0) ?? event.id;
  const id = deterministicId("funding-claim", key);
  const claim = await upsert(FundingFeeClaim, id, {
    id,
    key,
    marketId: maybeMarketId(event),
    positionId: deterministicId("position", fieldString(event, ["position_key", "positionKey"], 0) ?? key),
    account: requiredAccount(event),
    receiver: fieldString(event, ["receiver"], 2),
    tokenId: fieldString(event, ["token"], 3),
    amount: fieldString(event, ["amount"], 4) ?? "0",
    amountUsd: fieldString(event, ["amount_usd", "amountUsd"], 5),
    status: "CLAIMED",
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await claim.save();
}

async function handleUiFee(event: DecodedEvent): Promise<void> {
  const key = fieldString(event, ["key", "order_key", "orderKey"], 0) ?? event.id;
  const id = deterministicId("ui-fee", key, event.eventName);
  const accrual = await upsert(UiFeeAccrual, id, {
    id,
    key,
    marketId: maybeMarketId(event),
    orderId: deterministicId("order", fieldString(event, ["order_key", "orderKey"], 0) ?? key),
    account: requiredAccount(event),
    uiFeeReceiver: fieldString(event, ["ui_fee_receiver", "uiFeeReceiver", "receiver"], 2) ?? requiredAccount(event),
    tokenId: fieldString(event, ["token"], 3),
    amount: fieldString(event, ["amount"], 4) ?? "0",
    amountUsd: fieldString(event, ["amount_usd", "amountUsd"], 5),
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await accrual.save();
}

async function handleReferral(event: DecodedEvent): Promise<void> {
  if (event.eventName === "ref_reg") {
    const code = fieldString(event, ["code", "referral_code", "referralCode"], 0) ?? event.id;
    const owner = requiredAccount(event);
    const referral = await upsert(ReferralCode, deterministicId("referral", code), {
      id: deterministicId("referral", code),
      code,
      owner,
      status: "ACTIVE",
      createdLedger: event.ledger,
      createdTimestamp: event.timestamp,
      createdTransactionHash: event.transactionHash,
    });
    await referral.save();
    return;
  }

  if (event.eventName === "ref_set") {
    const code = fieldString(event, ["code", "referral_code", "referralCode"], 1) ?? event.id;
    const trader = requiredAccount(event);
    const referrer = fieldString(event, ["referrer", "owner"], 2) ?? trader;
    await ensureReferralCode(code, referrer, event);
    const id = deterministicId("trader-referral", trader);
    const link = await upsert(TraderReferral, id, {
      id,
      trader,
      referralCodeId: deterministicId("referral", code),
      referrer,
      status: "ACTIVE",
      createdLedger: event.ledger,
      createdTimestamp: event.timestamp,
      createdTransactionHash: event.transactionHash,
      updatedLedger: event.ledger,
      updatedTimestamp: event.timestamp,
      updatedTransactionHash: event.transactionHash,
    });
    await link.save();
    return;
  }

  const code = fieldString(event, ["code", "referral_code", "referralCode"], 0) ?? event.id;
  const previousOwner = fieldString(event, ["previous_owner", "previousOwner"], 1) ?? requiredAccount(event);
  const newOwner = fieldString(event, ["new_owner", "newOwner"], 2) ?? previousOwner;
  const referral = await ensureReferralCode(code, newOwner, event);
  referral.owner = newOwner;
  await referral.save();

  const transfer = await upsert(ReferralOwnershipTransfer, deterministicId("referral-transfer", event.id), {
    id: deterministicId("referral-transfer", event.id),
    referralCodeId: referral.id,
    code,
    previousOwner,
    newOwner,
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await transfer.save();
}

async function handleTokenEvent(event: DecodedEvent): Promise<void> {
  const contractAddress = event.contractAddress;
  const token = await ensureToken(contractAddress, event, tokenTypeForAddress(contractAddress));
  const amount = fieldString(event, ["amount"], 2) ?? fieldString(event, ["value"], 2) ?? "0";
  const from = fieldString(event, ["from"], 0) ?? decodeAddress(event.topic[1]) ?? zeroForMint(event.eventName);
  const to = fieldString(event, ["to"], 1) ?? decodeAddress(event.topic[2]);
  const account = fieldString(event, ["account"], 0) ?? from ?? to;
  const id = deterministicId("token-event", event.id);

  const transfer = await upsert(MarketTokenTransfer, id, {
    id,
    tokenId: token.id,
    contractAddress,
    from,
    to,
    account,
    transferType: event.eventName,
    amount,
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await transfer.save();
}

async function savePositionChange(
  event: DecodedEvent,
  marketIdValue: string,
  positionId: string,
  account: string,
  changeType: string,
): Promise<void> {
  const key = fieldString(event, ["position_key", "positionKey", "key"], POSITION_INCREASE_INDEX.key) ?? event.id;
  const id = deterministicId("position-change", key, event.ledger.toString(), changeType);
  const change = await upsert(PositionChange, id, {
    id,
    key,
    marketId: marketIdValue,
    positionId,
    account,
    orderId: fieldString(event, ["order_key", "orderKey"], 12)
      ? deterministicId("order", fieldString(event, ["order_key", "orderKey"], 12)!)
      : undefined,
    changeType,
    status: "EXECUTED",
    isLong: fieldBoolean(event, ["is_long", "isLong"], 4),
    sizeDeltaUsd: fieldString(event, ["size_delta_usd", "sizeDeltaUsd"], POSITION_INCREASE_INDEX.sizeDeltaUsd),
    nextSizeUsd: fieldString(event, ["next_size_usd", "nextSizeUsd"], 6),
    collateralDeltaAmount: fieldString(event, ["collateral_delta_amount", "collateralDeltaAmount"], 7),
    nextCollateralAmount: fieldString(event, ["next_collateral_amount", "nextCollateralAmount"], 8),
    executionPrice: fieldString(event, ["execution_price", "executionPrice"], POSITION_INCREASE_INDEX.executionPrice),
    indexTokenPrice: fieldString(event, ["index_token_price", "indexTokenPrice"], 10),
    pnlUsd: fieldString(event, ["pnl_usd", "pnlUsd"], POSITION_DECREASE_INDEX.pnlUsd),
    priceImpactUsd: fieldString(event, ["price_impact_usd", "priceImpactUsd"], 12),
    borrowingFeeUsd: fieldString(event, ["borrowing_fee_usd", "borrowingFeeUsd"], 13),
    fundingFeeAmount: fieldString(event, ["funding_fee_amount", "fundingFeeAmount"], 14),
    positionFeeAmount: fieldString(event, ["position_fee_amount", "positionFeeAmount"], 15),
    ledger: event.ledger,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await change.save();
}

async function ensureMarketForEvent(event: DecodedEvent, marketIndex = 1): Promise<Market> {
  const key = fieldString(event, ["market", "market_key", "marketKey"], marketIndex)
    ?? firstKnownMarketToken(event)
    ?? event.contractAddress;
  const id = marketId(key);
  const existing = await Market.get(id);
  if (existing) {
    return existing;
  }

  const metadata = CONFIGURED_CONTRACTS.marketMetadataByToken.get(key);
  return upsert(Market, id, {
    id,
    key,
    marketTokenId: metadata?.marketToken ?? key,
    indexTokenId: metadata?.indexToken,
    longTokenId: metadata?.longToken,
    shortTokenId: metadata?.shortToken,
    name: metadata?.name,
    status: "DISCOVERED",
    createdLedger: event.ledger,
    createdTimestamp: event.timestamp,
    createdTransactionHash: event.transactionHash,
  });
}

async function ensureProtocolContract(address: string, event: DecodedEvent): Promise<ProtocolContract> {
  const key = CONFIGURED_CONTRACTS.contractKeysByAddress.get(address) ?? address;
  return upsert(ProtocolContract, deterministicId("contract", address), {
    id: deterministicId("contract", address),
    key,
    address,
    contractType: key,
    name: key,
    network: SO4_CONTRACTS.network?.name,
    firstSeenLedger: event.ledger,
    firstSeenTimestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
}

async function ensureToken(address: string, event: DecodedEvent, tokenType?: string): Promise<Token> {
  const token = await upsert(Token, address, {
    id: address,
    contractId: CONFIGURED_CONTRACTS.protocolAddresses.has(address)
      ? deterministicId("contract", address)
      : undefined,
    address,
    symbol: tokenSymbol(address),
    tokenType,
    firstSeenLedger: event.ledger,
    firstSeenTimestamp: event.timestamp,
    transactionHash: event.transactionHash,
  });
  await token.save();
  return token;
}

async function ensureReferralCode(code: string, owner: string, event: DecodedEvent): Promise<ReferralCode> {
  const id = deterministicId("referral", code);
  const referral = await upsert(ReferralCode, id, {
    id,
    code,
    owner,
    status: "ACTIVE",
    createdLedger: event.ledger,
    createdTimestamp: event.timestamp,
    createdTransactionHash: event.transactionHash,
  });
  await referral.save();
  return referral;
}

async function upsert<T extends Saveable>(
  entity: EntityClass<T>,
  id: string,
  record: Record<string, unknown>,
): Promise<T> {
  const existing = await entity.get(id);
  if (existing) {
    Object.assign(existing, withoutUndefined(record));
    return existing;
  }

  return entity.create(withoutUndefined(record));
}

function withoutUndefined(record: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

function setLifecycleFields(
  entity: Deposit | Withdrawal,
  event: DecodedEvent,
  status: string,
): void {
  if (status === "CREATED") {
    entity.createdLedger = event.ledger;
    entity.createdTimestamp = event.timestamp;
    entity.createdTransactionHash = event.transactionHash;
    return;
  }
  if (status === "EXECUTED") {
    entity.executedLedger = event.ledger;
    entity.executedTimestamp = event.timestamp;
    entity.executedTransactionHash = event.transactionHash;
    return;
  }
  entity.cancelledLedger = event.ledger;
  entity.cancelledTimestamp = event.timestamp;
  entity.cancelledTransactionHash = event.transactionHash;
  entity.cancellationReason = fieldString(event, ["reason"], 10);
}

function setOrderLifecycleFields(entity: Order, event: DecodedEvent, status: string): void {
  if (status === "CREATED") {
    entity.createdLedger = event.ledger;
    entity.createdTimestamp = event.timestamp;
    entity.createdTransactionHash = event.transactionHash;
    return;
  }
  if (status === "UPDATED") {
    entity.updatedLedger = event.ledger;
    entity.updatedTimestamp = event.timestamp;
    entity.updatedTransactionHash = event.transactionHash;
    return;
  }
  if (status === "FROZEN") {
    entity.frozenLedger = event.ledger;
    entity.frozenTimestamp = event.timestamp;
    entity.frozenTransactionHash = event.transactionHash;
    return;
  }
  if (status === "EXECUTED") {
    entity.executedLedger = event.ledger;
    entity.executedTimestamp = event.timestamp;
    entity.executedTransactionHash = event.transactionHash;
    return;
  }
  entity.cancelledLedger = event.ledger;
  entity.cancelledTimestamp = event.timestamp;
  entity.cancelledTransactionHash = event.transactionHash;
  entity.cancellationReason = fieldString(event, ["reason"], 14);
}

function statusForEvent(eventName: string, type: "deposit" | "withdrawal" | "order"): string {
  if (eventName.endsWith("_crt")) {
    return "CREATED";
  }
  if (eventName.endsWith("_exe")) {
    return "EXECUTED";
  }
  if (eventName.endsWith("_upd")) {
    return "UPDATED";
  }
  if (eventName.endsWith("_frz")) {
    return "FROZEN";
  }
  return type === "order" ? "CANCELLED" : "CANCELLED";
}

function lifecycleKey(event: DecodedEvent, fallback: string): string {
  return fieldString(event, ["key", `${fallback}_key`, `${fallback}Key`], 0) ?? event.id;
}

function requiredAccount(event: DecodedEvent, accountIndex = 2): string {
  return fieldString(event, ["account", "owner", "trader"], accountIndex)
    ?? fieldString(event, ["user"], 0)
    ?? decodeAddress(event.topic[1])
    ?? event.contractAddress;
}

function fieldString(event: DecodedEvent, names: string[], index?: number): string | undefined {
  const value = fieldValue(event, names, index);
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value.toString();
  }
  return undefined;
}

function fieldBoolean(event: DecodedEvent, names: string[], index?: number): boolean | undefined {
  const value = fieldValue(event, names, index);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" ? true : value === "false" ? false : undefined;
  }
  return undefined;
}

function fieldValue(event: DecodedEvent, names: string[], index?: number): DecodedValue {
  for (const name of names) {
    if (event.values.named[name] !== undefined) {
      return event.values.named[name];
    }
  }
  if (index !== undefined) {
    return event.values.list[index];
  }
  return undefined;
}

function maybeMarketId(event: DecodedEvent): string | undefined {
  const key = fieldString(event, ["market", "market_key", "marketKey"], 1) ?? firstKnownMarketToken(event);
  return key ? marketId(key) : undefined;
}

function marketId(key: string): string {
  return deterministicId("market", key);
}

function deterministicId(...parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

function firstKnownMarketToken(event: DecodedEvent): string | undefined {
  for (const value of event.values.list) {
    if (typeof value === "string" && CONFIGURED_CONTRACTS.marketTokenAddresses.has(value)) {
      return value;
    }
  }
  return undefined;
}

function serializeOptional(value: DecodedValue): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function zeroForMint(eventName: string): string | undefined {
  return eventName === "mint" ? ZERO_ADDRESS : undefined;
}

function tokenTypeForAddress(address: string): string | undefined {
  if (CONFIGURED_CONTRACTS.marketTokenAddresses.has(address)) {
    return "market";
  }
  if (CONFIGURED_CONTRACTS.tokenAddresses.has(address)) {
    return CONFIGURED_CONTRACTS.contractKeysByAddress.get(address) ?? "token";
  }
  return undefined;
}

function tokenSymbol(address: string): string | undefined {
  return CONFIGURED_CONTRACTS.contractKeysByAddress.get(address);
}

function buildConfiguredContracts(config: ContractConfig): ConfiguredContracts {
  const contractKeysByAddress = new Map<string, string>();
  const protocolAddresses = new Set<string>();
  const tokenAddresses = new Set<string>();
  const marketTokenAddresses = new Set<string>();
  const marketMetadataByToken = new Map<string, MarketMetadata>();

  for (const [key, address] of Object.entries(config.contracts ?? {})) {
    protocolAddresses.add(address);
    contractKeysByAddress.set(address, key);
  }
  for (const [key, address] of Object.entries(config.tokens ?? {})) {
    tokenAddresses.add(address);
    contractKeysByAddress.set(address, key);
  }
  for (const market of config.markets ?? []) {
    marketTokenAddresses.add(market.marketToken);
    marketMetadataByToken.set(market.marketToken, market);
    for (const [key, address] of [
      [`${market.name}:market`, market.marketToken],
      [`${market.name}:index`, market.indexToken],
      [`${market.name}:long`, market.longToken],
      [`${market.name}:short`, market.shortToken],
    ]) {
      contractKeysByAddress.set(address, contractKeysByAddress.get(address) ?? key);
    }
  }

  return {
    contractKeysByAddress,
    protocolAddresses,
    tokenAddresses,
    marketTokenAddresses,
    marketMetadataByToken,
  };
}
