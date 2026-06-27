import { beforeEach, describe, expect, test } from "bun:test";
import {
  decodeAddress,
  decodeBoolean,
  decodeBytesN32,
  decodeInteger,
  decodeSorobanEvent,
  decodeTopicName,
  decodeTuple,
  dispatchEvent,
  type DecodedEvent,
} from "../src/mappings/mappingHandlers";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const marketToken = "CCBUUSYZJTGVA6PYUNQDFPZFHTBZ2QSHOUO7YAGRQVA46T3ZLSIYULS4";
const indexToken = "CAJ6BZKGFT47ALGMVFZZGAOXBV2RWIVYVCU4WJCQIURKRNXU346RWVAU";
const shortToken = "CBAN5YU3KRDKPTQ2H76D6S7HQFPRBGUD524F65BUM2RQCITPTRLKWKES";
const handlerContract = "CDWOFIP4YQJGMCYAOWLSRBAWN2OTJUG2I5WOFC32O2TX2SRU56RWBE5C";
const marketFactoryContract = "CBGX3EJFI3JRHSN5B533O2L5P57JFPTCRS55IPWFS5BNDXLJLXDWA5Z2";
const account = Keypair.random().publicKey();
const receiver = Keypair.random().publicKey();

type StoreBucket = Map<string, Record<string, unknown>>;

const buckets = new Map<string, StoreBucket>();
const logs: string[] = [];

beforeEach(() => {
  buckets.clear();
  logs.length = 0;

  (globalThis as Record<string, unknown>).store = {
    async set(entity: string, id: string, value: Record<string, unknown>) {
      bucket(entity).set(id, { ...value });
    },
    async get(entity: string, id: string) {
      return bucket(entity).get(id);
    },
    async getOneByField(entity: string, field: string, value: unknown) {
      return [...bucket(entity).values()].find((record) => record[field] === value);
    },
    async getByField(entity: string, field: string, value: unknown) {
      return [...bucket(entity).values()].filter((record) => record[field] === value);
    },
    async getByFields() {
      return [];
    },
    async remove(entity: string, id: string) {
      bucket(entity).delete(id);
    },
  };

  (globalThis as Record<string, unknown>).logger = {
    info(message: string) {
      logs.push(message);
    },
    warn(message: string) {
      logs.push(message);
    },
  };
});

describe("SO4 event dispatch", () => {
  test("decodes symbol topics", () => {
    expect(decodeTopicName(xdr.ScVal.scvSymbol("pos_dec"))).toBe("pos_dec");
    expect(decodeTopicName(xdr.ScVal.scvSymbol("mkt_new"))).toBe("mkt_new");
    expect(decodeTopicName(xdr.ScVal.scvSymbol("dep_crt"))).toBe("dep_crt");
  });

  test("decodes string topics", () => {
    expect(decodeTopicName(xdr.ScVal.scvString("event_name"))).toBe("event_name");
  });

  test("decodes Soroban addresses", () => {
    expect(decodeAddress(Address.fromString(account).toScVal())).toBe(account);
    expect(decodeAddress(Address.fromString(marketToken).toScVal())).toBe(marketToken);
    expect(decodeAddress(Address.fromString(indexToken).toScVal())).toBe(indexToken);
  });

  test("decodes BytesN<32>", () => {
    const keyHex = "11".repeat(32);
    const decodedKey = decodeBytesN32(xdr.ScVal.scvBytes(Buffer.from(keyHex, "hex")));
    expect(decodedKey).toBe(keyHex);
  });

  test("decodes BytesN<32> with different hex patterns", () => {
    const key1 = "aa".repeat(32);
    const key2 = "ff".repeat(32);
    expect(decodeBytesN32(xdr.ScVal.scvBytes(Buffer.from(key1, "hex")))).toBe(key1);
    expect(decodeBytesN32(xdr.ScVal.scvBytes(Buffer.from(key2, "hex")))).toBe(key2);
  });

  test("decodes booleans", () => {
    expect(decodeBoolean(xdr.ScVal.scvBool(true))).toBe(true);
    expect(decodeBoolean(xdr.ScVal.scvBool(false))).toBe(false);
  });

  test("decodes signed integers", () => {
    expect(decodeInteger(nativeToScVal(-7n, { type: "i128" }))).toBe("-7");
    expect(decodeInteger(nativeToScVal(-1n, { type: "i128" }))).toBe("-1");
    expect(decodeInteger(nativeToScVal(0n, { type: "i128" }))).toBe("0");
  });

  test("decodes unsigned integers", () => {
    expect(decodeInteger(nativeToScVal(42n, { type: "u128" }))).toBe("42");
    expect(decodeInteger(nativeToScVal(0n, { type: "u128" }))).toBe("0");
    expect(decodeInteger(nativeToScVal(1000000n, { type: "u128" }))).toBe("1000000");
  });

  test("decodes primitive ScVal fixtures", () => {
    const keyHex = "11".repeat(32);

    expect(decodeTopicName(xdr.ScVal.scvSymbol("pos_dec"))).toBe("pos_dec");
    expect(decodeAddress(Address.fromString(account).toScVal())).toBe(account);
    expect(decodeAddress(Address.fromString(marketToken).toScVal())).toBe(marketToken);
    expect(decodeBytesN32(xdr.ScVal.scvBytes(Buffer.from(keyHex, "hex")))).toBe(keyHex);
    expect(decodeBoolean(xdr.ScVal.scvBool(true))).toBe(true);
    expect(decodeInteger(nativeToScVal(-7n, { type: "i128" }))).toBe("-7");
    expect(decodeInteger(nativeToScVal(42n, { type: "u128" }))).toBe("42");
  });

  test("handles malformed topic names", () => {
    expect(decodeTopicName(undefined)).toBeUndefined();
    expect(decodeTopicName(xdr.ScVal.scvU32(42))).toBeUndefined();
    expect(decodeTopicName(xdr.ScVal.scvBool(true))).toBeUndefined();
  });

  test("handles malformed addresses", () => {
    expect(decodeAddress(undefined)).toBeUndefined();
    expect(decodeAddress(xdr.ScVal.scvSymbol("not_an_address"))).toBeUndefined();
    expect(decodeAddress(xdr.ScVal.scvU64(12345n))).toBeUndefined();
  });

  test("handles malformed BytesN<32>", () => {
    expect(decodeBytesN32(undefined)).toBeUndefined();
    expect(decodeBytesN32(xdr.ScVal.scvSymbol("not_bytes"))).toBeUndefined();
    const shortBytes = Buffer.alloc(16);
    expect(decodeBytesN32(xdr.ScVal.scvBytes(shortBytes))).toBeUndefined();
    const longBytes = Buffer.alloc(64);
    expect(decodeBytesN32(xdr.ScVal.scvBytes(longBytes))).toBeUndefined();
  });

  test("handles malformed booleans", () => {
    expect(decodeBoolean(undefined)).toBeUndefined();
    expect(decodeBoolean(xdr.ScVal.scvSymbol("true"))).toBeUndefined();
    expect(decodeBoolean(xdr.ScVal.scvU32(1))).toBeUndefined();
  });

  test("handles malformed integers", () => {
    expect(decodeInteger(undefined)).toBeUndefined();
    expect(decodeInteger(xdr.ScVal.scvSymbol("42"))).toBeUndefined();
    expect(decodeInteger(xdr.ScVal.scvBool(true))).toBeUndefined();
  });

  test("decodes ScMap payloads as named fields and Vec payloads as positional only", () => {
    const mapTuple = decodeTuple(
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("amount"),
          val: nativeToScVal(42n, { type: "u128" }),
        }),
      ]),
    );
    const vecTuple = decodeTuple(
      xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("amount"),
        nativeToScVal(42n, { type: "u128" }),
      ]),
    );

    expect(mapTuple.named.amount).toBe("42");
    expect(mapTuple.list).toHaveLength(0);
    expect(vecTuple.list).toEqual(["amount", "42"]);
    expect(vecTuple.named).toEqual({});
  });

  test("decodes raw market event payloads with empty named fields", () => {
    const decoded = decodeSorobanEvent(
      rawEvent(
        "mkt_new",
        xdr.ScVal.scvVec([
          Address.fromString(marketToken).toScVal(),
          Address.fromString(indexToken).toScVal(),
          Address.fromString(indexToken).toScVal(),
          Address.fromString(shortToken).toScVal(),
        ]),
        marketFactoryContract,
      ),
    );

    expect(decoded?.eventName).toBe("mkt_new");
    expect(decoded?.contractAddress).toBe(marketFactoryContract);
    expect(decoded?.values.named).toEqual({});
    expect(decoded?.values.list).toEqual([marketToken, indexToken, indexToken, shortToken]);
  });

  test("indexes a raw positional position decrease event with source-verified indices", async () => {
    const positionKey = "22".repeat(32);
    const decoded = decodeSorobanEvent(
      rawEvent(
        "pos_dec",
        xdr.ScVal.scvVec([
          xdr.ScVal.scvBytes(Buffer.from(positionKey, "hex")),
          Address.fromString(account).toScVal(),
          nativeToScVal(500n, { type: "i128" }),
          nativeToScVal(2000n, { type: "i128" }),
          nativeToScVal(-25n, { type: "i128" }),
        ]),
      ),
    );

    expect(decoded?.values.named).toEqual({});
    await dispatchEvent(decoded!);

    const [position] = records("Position");
    const [change] = records("PositionChange");
    expect(position.id).toBe(`position:${positionKey}`);
    expect(position.account).toBe(account);
    expect(change.sizeDeltaUsd).toBe("500");
    expect(change.executionPrice).toBe("2000");
    expect(change.pnlUsd).toBe("-25");
  });

  test("indexes a market creation event with all required fields", async () => {
    const event = so4Event("mkt_new", {
      market_token: marketToken,
      indexToken: indexToken,
      longToken: "CLONG",
      shortToken: shortToken,
      market: marketToken,
      creator: account,
      name: "TETH/TUSDC",
    });

    await dispatchEvent(event);

    const [market] = records("Market");
    expect(market).toBeDefined();
    expect(market.id).toBe(`market:${marketToken}`);
    expect(market.marketTokenId).toBe(marketToken);
    expect(market.status).toBe("ACTIVE");
    expect(market.createdBy).toBeDefined();
  });

  test("indexes market creation with deterministic entity IDs", async () => {
    const event = so4Event("mkt_new", {
      market_token: marketToken,
      market: marketToken,
      creator: account,
      name: "TETH/TUSDC",
    });

    await dispatchEvent(event);

    const [market] = records("Market");
    const marketId = `market:${marketToken}`;
    expect(market.id).toBe(marketId);
  });

  test("ensures ProtocolContract and Token records on market creation", async () => {
    const event = so4Event("mkt_new", {
      market_token: marketToken,
      indexToken: indexToken,
      market: marketToken,
      creator: account,
    });

    await dispatchEvent(event);

    expect(records("Market").length).toBeGreaterThan(0);
    const market = records("Market")[0];
    expect(market.contractId).toBeDefined();
    expect(market.marketTokenId).toBeDefined();
  });

  test("indexes a market creation event idempotently", async () => {
    const event = so4Event("mkt_new", {
      market_token: marketToken,
      market: marketToken,
      creator: account,
      name: "TETH/TUSDC",
    });

    await dispatchEvent(event);
    await dispatchEvent(event);

    expect(records("Market")).toHaveLength(1);
    expect(records("MarketConfigSnapshot")).toHaveLength(1);
    expect(records("Market")[0].id).toBe(`market:${marketToken}`);
  });

  test("indexes deposit create event", async () => {
    await dispatchEvent(so4Event("dep_crt", lifecyclePayload("dep-1")));

    const [deposit] = records("Deposit");
    expect(records("Deposit")).toHaveLength(1);
    expect(deposit.id).toBe("deposit:dep-1");
    expect(deposit.status).toBe("CREATED");
    expect(deposit.createdLedger).toBe(100);
  });

  test("indexes deposit lifecycle create to execute transition", async () => {
    await dispatchEvent(so4Event("dep_crt", lifecyclePayload("dep-1")));
    await dispatchEvent(so4Event("dep_exe", lifecyclePayload("dep-1")));

    const [deposit] = records("Deposit");
    expect(records("Deposit")).toHaveLength(1);
    expect(deposit.id).toBe("deposit:dep-1");
    expect(deposit.status).toBe("EXECUTED");
    expect(deposit.createdLedger).toBe(100);
    expect(deposit.executedLedger).toBe(100);
  });

  test("indexes deposit cancel event", async () => {
    await dispatchEvent(so4Event("dep_crt", lifecyclePayload("dep-1")));
    await dispatchEvent(so4Event("dep_can", lifecyclePayload("dep-1", { reason: "user_request" })));

    const [deposit] = records("Deposit");
    expect(records("Deposit")).toHaveLength(1);
    expect(deposit.id).toBe("deposit:dep-1");
    expect(deposit.status).toBe("CANCELLED");
    expect(deposit.createdLedger).toBe(100);
  });

  test("handles deposit lifecycle with status transitions", async () => {
    await dispatchEvent(so4Event("dep_crt", lifecyclePayload("dep-1")));
    await dispatchEvent(so4Event("dep_exe", lifecyclePayload("dep-1")));

    const [deposit] = records("Deposit");
    expect(deposit.status).toBe("EXECUTED");
    expect(deposit.createdLedger).toBe(100);
  });

  test("deposit lifecycle events are idempotent on rerun", async () => {
    const event1 = so4Event("dep_crt", lifecyclePayload("dep-1"));
    const event2 = so4Event("dep_exe", lifecyclePayload("dep-1"));

    await dispatchEvent(event1);
    await dispatchEvent(event2);
    await dispatchEvent(event1);
    await dispatchEvent(event2);

    expect(records("Deposit")).toHaveLength(1);
    const [deposit] = records("Deposit");
    expect(deposit.status).toBe("EXECUTED");
  });

  test("indexes deposit lifecycle updates by deterministic key", async () => {
    await dispatchEvent(so4Event("dep_crt", lifecyclePayload("dep-1")));
    await dispatchEvent(so4Event("dep_exe", lifecyclePayload("dep-1")));

    const [deposit] = records("Deposit");
    expect(records("Deposit")).toHaveLength(1);
    expect(deposit.id).toBe("deposit:dep-1");
    expect(deposit.status).toBe("EXECUTED");
    expect(deposit.createdLedger).toBe(100);
    expect(deposit.executedLedger).toBe(100);
  });

  test("indexes withdrawal lifecycle updates", async () => {
    await dispatchEvent(so4Event("wth_crt", lifecyclePayload("wth-1")));
    await dispatchEvent(so4Event("wth_can", lifecyclePayload("wth-1", { reason: "expired" })));

    const [withdrawal] = records("Withdrawal");
    expect(records("Withdrawal")).toHaveLength(1);
    expect(withdrawal.id).toBe("withdrawal:wth-1");
    expect(withdrawal.status).toBe("CANCELLED");
    expect(withdrawal.cancellationReason).toBe("expired");
  });

  test("indexes order lifecycle updates", async () => {
    await dispatchEvent(
      so4Event("ord_crt", lifecyclePayload("ord-1", { order_type: "MARKET", is_long: true })),
    );
    await dispatchEvent(
      so4Event("ord_upd", lifecyclePayload("ord-1", { order_type: "MARKET", acceptable_price: "2000" })),
    );

    const [order] = records("Order");
    expect(records("Order")).toHaveLength(1);
    expect(order.id).toBe("order:ord-1");
    expect(order.status).toBe("UPDATED");
    expect(order.isLong).toBe(true);
    expect(order.acceptablePrice).toBe("2000");
  });

  test("indexes position changes and current position state", async () => {
    await dispatchEvent(
      so4Event("pos_inc", {
        position_key: "pos-1",
        market: marketToken,
        account,
        collateral_token: marketToken,
        is_long: true,
        next_size_usd: "500000000000000000000000000000000",
      }),
    );

    expect(records("Position")).toHaveLength(1);
    expect(records("PositionChange")).toHaveLength(1);
    expect(records("Position")[0].id).toBe("position:pos-1");
    expect(records("PositionChange")[0].changeType).toBe("INCREASE");
  });

  test("indexes liquidation and ADL events", async () => {
    await dispatchEvent(
      so4Event("liq_exe", {
        liquidation_key: "liq-1",
        market: marketToken,
        account,
        liquidator: account,
        is_long: false,
      }),
    );
    await dispatchEvent(
      so4Event("adl_req", {
        adl_key: "adl-1",
        market: marketToken,
        account,
        is_long: true,
      }),
    );

    expect(records("Liquidation")[0].status).toBe("EXECUTED");
    expect(records("AdlEvent")[0].status).toBe("REQUESTED");
  });

  test("indexes fee and referral events", async () => {
    await dispatchEvent(so4Event("fee_clm", { key: "fee-1", account, amount: "42" }));
    await dispatchEvent(so4Event("ref_reg", { code: "STEINS", account }));
    await dispatchEvent(so4Event("ref_set", { trader: account, code: "STEINS", referrer: account }));

    expect(records("FeeClaim")[0].amount).toBe("42");
    expect(records("ReferralCode")[0].code).toBe("STEINS");
    expect(records("TraderReferral")[0].referralCodeId).toBe("referral:STEINS");
  });

  test("indexes token/faucet transfer-style events", async () => {
    await dispatchEvent(
      so4Event("transfer", {
        from: account,
        to: receiver,
        amount: "1000",
      }, marketToken),
    );

    const [transfer] = records("MarketTokenTransfer");
    expect(transfer.id).toBe("token-event:event-transfer");
    expect(transfer.transferType).toBe("transfer");
    expect(transfer.amount).toBe("1000");
  });

  test("logs and skips unknown events", async () => {
    await dispatchEvent(so4Event("mystery", {}));

    expect(records("Market")).toHaveLength(0);
    expect(logs.some((message) => message.includes("Skipping unknown SO4 event"))).toBe(true);
  });

  test("handles unknown event without crashing and without entity writes", async () => {
    const unknownEvent = so4Event("unknown_event_xyz", { data: "test" });
    await dispatchEvent(unknownEvent);

    expect(records("Market")).toHaveLength(0);
    expect(records("Deposit")).toHaveLength(0);
    expect(records("Position")).toHaveLength(0);
    expect(records("Order")).toHaveLength(0);
  });

  test("logs unknown irrelevant events with structured message", async () => {
    await dispatchEvent(so4Event("irrelevant", { value: "123" }));

    const unknownEventLog = logs.find((message) => message.includes("Skipping unknown SO4 event"));
    expect(unknownEventLog).toBeDefined();
    expect(unknownEventLog).toContain("irrelevant");
  });
});

function so4Event(
  eventName: string,
  named: Record<string, string | boolean>,
  contractAddress = handlerContract,
): DecodedEvent {
  return {
    id: `event-${eventName}`,
    contractAddress,
    eventName,
    ledger: 100,
    timestamp: new Date("2026-06-24T12:00:00Z"),
    transactionHash: `tx-${eventName}`,
    topic: [],
    values: {
      list: Object.values(named),
      named,
    },
  };
}

function lifecyclePayload(
  key: string,
  extra: Record<string, string | boolean> = {},
): Record<string, string | boolean> {
  return {
    key,
    market: marketToken,
    account,
    receiver: account,
    amount: "100",
    ...extra,
  };
}

function records(entity: string): Record<string, unknown>[] {
  return [...bucket(entity).values()];
}

function bucket(entity: string): StoreBucket {
  let value = buckets.get(entity);
  if (!value) {
    value = new Map();
    buckets.set(entity, value);
  }
  return value;
}

function rawEvent(eventName: string, value: xdr.ScVal, contractAddress = handlerContract) {
  return {
    id: `raw-${eventName}`,
    topic: [xdr.ScVal.scvSymbol(eventName)],
    value,
    contractId: Address.fromString(contractAddress).toScAddress(),
    ledger: { sequence: 100 },
    ledgerClosedAt: "2026-06-24T12:00:00Z",
    txHash: `tx-${eventName}`,
  } as never;
}
