import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import {
  decodeAddress,
  decodeBoolean,
  decodeBytesN32,
  decodeInteger,
  decodeSorobanEvent,
  decodeTopicName,
  decodeTuple,
  dispatchEvent,
  handleEvent,
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
const reorgFixture = JSON.parse(
  readFileSync(`${import.meta.dir}/fixtures/reorged-ledger-sequence.json`, "utf8"),
) as ReorgFixture;

type StoreBucket = Map<string, Record<string, unknown>>;
type ReorgFixtureEvent = {
  id: string;
  eventName: string;
  ledger: number;
  transactionHash: string;
  named: Record<string, string | boolean>;
};
type ReorgFixture = {
  orphaned: ReorgFixtureEvent[];
  canonical: ReorgFixtureEvent[];
};

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

  test("indexes withdrawal create event with all key fields", async () => {
    await dispatchEvent(so4Event("wth_crt", lifecyclePayload("wth-2")));

    const [withdrawal] = records("Withdrawal");
    expect(records("Withdrawal")).toHaveLength(1);
    expect(withdrawal.id).toBe("withdrawal:wth-2");
    expect(withdrawal.status).toBe("CREATED");
    expect(withdrawal.account).toBe(account);
    expect(withdrawal.marketId).toBe(`market:${marketToken}`);
    expect(withdrawal.createdLedger).toBe(100);
  });

  test("indexes withdrawal execute event", async () => {
    await dispatchEvent(so4Event("wth_crt", lifecyclePayload("wth-3")));
    await dispatchEvent(so4Event("wth_exe", lifecyclePayload("wth-3")));

    const [withdrawal] = records("Withdrawal");
    expect(records("Withdrawal")).toHaveLength(1);
    expect(withdrawal.id).toBe("withdrawal:wth-3");
    expect(withdrawal.status).toBe("EXECUTED");
    expect(withdrawal.executedLedger).toBe(100);
  });

  test("withdrawal lifecycle events are idempotent on rerun", async () => {
    const event1 = so4Event("wth_crt", lifecyclePayload("wth-4"));
    const event2 = so4Event("wth_exe", lifecyclePayload("wth-4"));

    await dispatchEvent(event1);
    await dispatchEvent(event2);
    await dispatchEvent(event1);
    await dispatchEvent(event2);

    expect(records("Withdrawal")).toHaveLength(1);
    const [withdrawal] = records("Withdrawal");
    expect(withdrawal.status).toBe("EXECUTED");
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

  test("indexes order freeze event", async () => {
    await dispatchEvent(
      so4Event("ord_crt", lifecyclePayload("ord-2", { order_type: "LIMIT", is_long: false })),
    );
    await dispatchEvent(
      so4Event("ord_frz", lifecyclePayload("ord-2")),
    );

    const [order] = records("Order");
    expect(records("Order")).toHaveLength(1);
    expect(order.id).toBe("order:ord-2");
    expect(order.status).toBe("FROZEN");
    expect(order.isLong).toBe(false);
  });

  test("indexes order execute event", async () => {
    await dispatchEvent(
      so4Event("ord_crt", lifecyclePayload("ord-3", { order_type: "MARKET", is_long: true })),
    );
    await dispatchEvent(
      so4Event("ord_exe", lifecyclePayload("ord-3")),
    );

    const [order] = records("Order");
    expect(records("Order")).toHaveLength(1);
    expect(order.id).toBe("order:ord-3");
    expect(order.status).toBe("EXECUTED");
  });

  test("indexes order cancel event", async () => {
    await dispatchEvent(
      so4Event("ord_crt", lifecyclePayload("ord-4", { order_type: "LIMIT" })),
    );
    await dispatchEvent(
      so4Event("ord_can", lifecyclePayload("ord-4", { reason: "user_request" })),
    );

    const [order] = records("Order");
    expect(records("Order")).toHaveLength(1);
    expect(order.id).toBe("order:ord-4");
    expect(order.status).toBe("CANCELLED");
  });

  test("order lifecycle events are idempotent on rerun", async () => {
    const event1 = so4Event("ord_crt", lifecyclePayload("ord-5", { order_type: "MARKET" }));
    const event2 = so4Event("ord_exe", lifecyclePayload("ord-5"));

    await dispatchEvent(event1);
    await dispatchEvent(event2);
    await dispatchEvent(event1);
    await dispatchEvent(event2);

    expect(records("Order")).toHaveLength(1);
    const [order] = records("Order");
    expect(order.status).toBe("EXECUTED");
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

  test("rewrites stale entities when a reorged ledger is replayed", async () => {
    for (const fixtureEvent of reorgFixture.orphaned) {
      await dispatchEvent(reorgEvent(fixtureEvent));
    }

    expect(records("Position")).toHaveLength(1);
    expect(records("PositionChange")).toHaveLength(1);
    expect(records("Order")).toHaveLength(1);
    expect(records("Position")[0].sizeUsd).toBe("100");
    expect(records("PositionChange")[0].transactionHash).toBe("tx-orphan-pos");
    expect(records("Order")[0].acceptablePrice).toBe("10");

    for (const fixtureEvent of reorgFixture.canonical) {
      await dispatchEvent(reorgEvent(fixtureEvent));
    }
    for (const fixtureEvent of reorgFixture.canonical) {
      await dispatchEvent(reorgEvent(fixtureEvent));
    }

    const [position] = records("Position");
    const [positionChange] = records("PositionChange");
    const [order] = records("Order");

    expect(records("Position")).toHaveLength(1);
    expect(records("PositionChange")).toHaveLength(1);
    expect(records("Order")).toHaveLength(1);
    expect(position).toMatchObject({
      id: "position:reorg-pos-1",
      key: "reorg-pos-1",
      sizeUsd: "250",
      collateralAmount: "8",
      updatedLedger: 200,
      updatedTransactionHash: "tx-canonical-pos",
    });
    expect(positionChange).toMatchObject({
      id: "position-change:reorg-pos-1:200:INCREASE",
      key: "reorg-pos-1",
      sizeDeltaUsd: "250",
      executionPrice: "12",
      transactionHash: "tx-canonical-pos",
    });
    expect(order).toMatchObject({
      id: "order:reorg-order-1",
      key: "reorg-order-1",
      sizeDeltaUsd: "250",
      acceptablePrice: "12",
      createdLedger: 200,
      createdTransactionHash: "tx-canonical-order",
    });
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

  test("indexes funding fee claim event", async () => {
    await dispatchEvent(
      so4Event("fnd_clm", {
        key: "fnd-1",
        market: marketToken,
        account,
        receiver: account,
        token: marketToken,
        amount: "100",
        amount_usd: "200000000",
      }),
    );

    const [claim] = records("FundingFeeClaim");
    expect(claim).toBeDefined();
    expect(claim.id).toBe("funding-claim:fnd-1");
    expect(claim.amount).toBe("100");
    expect(claim.amountUsd).toBe("200000000");
    expect(claim.status).toBe("CLAIMED");
  });

  test("indexes UI fee accrual event", async () => {
    await dispatchEvent(
      so4Event("ui_fee_acc", {
        key: "ord-1",
        market: marketToken,
        account,
        receiver: account,
        token: marketToken,
        amount: "50",
        amount_usd: "100000000",
      }),
    );

    const [accrual] = records("UiFeeAccrual");
    expect(accrual).toBeDefined();
    expect(accrual.id).toBe("ui-fee:ord-1:ui_fee_acc");
    expect(accrual.amount).toBe("50");
    expect(accrual.amountUsd).toBe("100000000");
  });

  test("indexes UI fee claim event", async () => {
    await dispatchEvent(
      so4Event("ui_fee_clm", {
        key: "ord-2",
        market: marketToken,
        account,
        receiver: account,
        token: marketToken,
        amount: "75",
      }),
    );

    const [claim] = records("UiFeeAccrual");
    expect(claim).toBeDefined();
    expect(claim.id).toBe("ui-fee:ord-2:ui_fee_clm");
    expect(claim.amount).toBe("75");
  });

  test("indexes referral ownership transfer event", async () => {
    const newOwner = Keypair.random().publicKey();
    await dispatchEvent(so4Event("ref_reg", { code: "TRANSFER_ME", account }));
    await dispatchEvent(
      so4Event("ref_xfr", {
        code: "TRANSFER_ME",
        previous_owner: account,
        new_owner: newOwner,
        account,
      }),
    );

    const [code] = records("ReferralCode");
    expect(code.owner).toBe(newOwner);

    const transfers = records("ReferralOwnershipTransfer");
    expect(transfers).toHaveLength(1);
    expect(transfers[0].code).toBe("TRANSFER_ME");
    expect(transfers[0].previousOwner).toBe(account);
    expect(transfers[0].newOwner).toBe(newOwner);
  });

  test("indexes fee claim with deterministic id", async () => {
    await dispatchEvent(so4Event("fee_clm", { key: "fee-det", account, amount: "99" }));

    const [claim] = records("FeeClaim");
    expect(claim.id).toBe("fee-claim:fee-det");
    expect(claim.amount).toBe("99");
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

  test("indexes token mint event with zero-address from", async () => {
    await dispatchEvent(
      so4Event("mint", {
        from: undefined as unknown as string, // prevent fallback to positional mapping
        to: receiver,
        amount: "5000",
      }, marketToken),
    );

    const transfers = records("MarketTokenTransfer");
    const mintTransfer = transfers.find(
      (t) => t.transferType === "mint",
    );
    expect(mintTransfer).toBeDefined();
    expect(mintTransfer.from).toBe("00000000000000000000000000000000000000000000000000000000");
    expect(mintTransfer.to).toBe(receiver);
    expect(mintTransfer.amount).toBe("5000");
  });

  test("indexes token burn event", async () => {
    await dispatchEvent(
      so4Event("burn", {
        from: account,
        to: receiver,
        amount: "250",
      }, marketToken),
    );

    const transfers = records("MarketTokenTransfer");
    const burnTransfer = transfers.find(
      (t) => t.transferType === "burn",
    );
    expect(burnTransfer).toBeDefined();
    expect(burnTransfer.from).toBe(account);
    expect(burnTransfer.amount).toBe("250");
  });

  test("indexes token approve event", async () => {
    await dispatchEvent(
      so4Event("approve", {
        from: account,
        to: receiver,
        amount: "10000",
      }, marketToken),
    );

    const transfers = records("MarketTokenTransfer");
    const approveTransfer = transfers.find(
      (t) => t.transferType === "approve",
    );
    expect(approveTransfer).toBeDefined();
    expect(approveTransfer.from).toBe(account);
    expect(approveTransfer.to).toBe(receiver);
    expect(approveTransfer.amount).toBe("10000");
  });

  test("indexes token claim event", async () => {
    await dispatchEvent(
      so4Event("claim", {
        from: account,
        to: receiver,
        amount: "777",
      }, marketToken),
    );

    const transfers = records("MarketTokenTransfer");
    const claimTransfer = transfers.find(
      (t) => t.transferType === "claim",
    );
    expect(claimTransfer).toBeDefined();
    expect(claimTransfer.from).toBe(account);
    expect(claimTransfer.amount).toBe("777");
  });

  test("indexes faucet claim event", async () => {
    await dispatchEvent(
      so4Event("faucet_claim", {
        from: account,
        to: receiver,
        amount: "3000",
      }, marketToken),
    );

    const transfers = records("MarketTokenTransfer");
    const faucetTransfer = transfers.find(
      (t) => t.transferType === "faucet_claim",
    );
    expect(faucetTransfer).toBeDefined();
    expect(faucetTransfer.from).toBe(account);
    expect(faucetTransfer.to).toBe(receiver);
    expect(faucetTransfer.amount).toBe("3000");
  });

  test("ensures Token entity is created for token events", async () => {
    await dispatchEvent(
      so4Event("transfer", {
        from: account,
        to: receiver,
        amount: "100",
      }, marketToken),
    );

    const tokens = records("Token");
    const token = tokens.find((t) => t.address === marketToken);
    expect(token).toBeDefined();
    expect(token.id).toBe(marketToken);
    expect(token.tokenType).toBe("market");
  });

  test("created MarketTokenTransfer references correct contract address", async () => {
    await dispatchEvent(
      so4Event("transfer", {
        from: account,
        to: receiver,
        amount: "500",
      }, marketToken),
    );

    const [transfer] = records("MarketTokenTransfer");
    expect(transfer.contractAddress).toBe(marketToken);
    expect(transfer.tokenId).toBe(marketToken);
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

  test("indexes position increase and decrease lifecycle with high-precision values", async () => {
    // 1. Position Increase
    const posIncPayload = {
      position_key: "pos-lifecycle-test-1",
      market: marketToken,
      account,
      collateral_token: marketToken,
      is_long: true,
      next_size_usd: "10000000000000000000000000000000000000000000000000000000000", // 1e56 USD
      next_collateral_amount: "5000000000000000000000000000000000", // 5e33
      average_price: "2500000000000000000000000000000", // 2.5e30
      entry_funding_rate: "100",
      reserve_amount: "3000",
      order_key: "order-pos-inc-1",
    };
    await dispatchEvent(so4Event("pos_inc", posIncPayload));

    const positionsAfterInc = records("Position");
    const positionChangesAfterInc = records("PositionChange");

    expect(positionsAfterInc).toHaveLength(1);
    expect(positionChangesAfterInc).toHaveLength(1);

    const position = positionsAfterInc[0];
    expect(position.id).toBe("position:pos-lifecycle-test-1");
    expect(position.status).toBe("OPEN");
    expect(position.account).toBe(account);
    expect(position.marketId).toBe(`market:${marketToken}`);
    expect(position.isLong).toBe(true);
    // Asserting numeric fields are preserved as high-precision strings
    expect(position.sizeUsd).toBe("10000000000000000000000000000000000000000000000000000000000");
    expect(position.collateralAmount).toBe("5000000000000000000000000000000000");
    expect(position.averagePrice).toBe("2500000000000000000000000000000");

    const change = positionChangesAfterInc[0];
    expect(change.positionId).toBe("position:pos-lifecycle-test-1");
    expect(change.changeType).toBe("INCREASE");

    // 2. Position Decrease
    const posDecPayload = {
      position_key: "pos-lifecycle-test-1",
      market: marketToken,
      account,
      collateral_token: marketToken,
      is_long: true,
      next_size_usd: "8000000000000000000000000000000000000000000000000000000000", // reduced
      next_collateral_amount: "4000000000000000000000000000000000", // reduced
      average_price: "2500000000000000000000000000000",
      entry_funding_rate: "100",
      reserve_amount: "3000",
      realized_pnl_usd: "-2000000000000000000000000000000000",
      realized_pnl_amount: "-800000000",
      order_key: "order-pos-dec-1",
    };
    await dispatchEvent(so4Event("pos_dec", posDecPayload));

    const positionsAfterDec = records("Position");
    const positionChangesAfterDec = records("PositionChange");

    expect(positionsAfterDec).toHaveLength(1);
    expect(positionChangesAfterDec).toHaveLength(2); // One increase, one decrease

    const positionDec = positionsAfterDec[0];
    expect(positionDec.status).toBe("DECREASED");
    expect(positionDec.sizeUsd).toBe("8000000000000000000000000000000000000000000000000000000000");
    expect(positionDec.collateralAmount).toBe("4000000000000000000000000000000000");
    expect(positionDec.realizedPnlUsd).toBe("-2000000000000000000000000000000000");

    const changeDec = positionChangesAfterDec.find((c) => c.changeType === "DECREASE");
    expect(changeDec).toBeDefined();
    expect(changeDec!.positionId).toBe("position:pos-lifecycle-test-1");
  });

  test("indexes liquidation risk events (liq_req and liq_exe)", async () => {
    // 1. Liquidation Request
    const liqReqPayload = {
      liquidation_key: "liq-test-key-1",
      market: marketToken,
      account,
      is_long: true,
      position_key: "pos-liq-test-1",
      liquidator: "GDZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
      collateral_token: marketToken,
      size_delta_usd: "1500000000000000000000000000000000",
      collateral_liquidated_amount: "500000000000",
      remaining_collateral_amount: "1000000",
    };
    await dispatchEvent(so4Event("liq_req", liqReqPayload));

    const liquidationsAfterReq = records("Liquidation");
    expect(liquidationsAfterReq).toHaveLength(1);

    const liquidation = liquidationsAfterReq[0];
    expect(liquidation.id).toBe("liquidation:liq-test-key-1");
    expect(liquidation.key).toBe("liq-test-key-1");
    expect(liquidation.status).toBe("REQUESTED");
    expect(liquidation.account).toBe(account);
    expect(liquidation.marketId).toBe(`market:${marketToken}`);
    expect(liquidation.positionId).toBe("position:pos-liq-test-1");
    expect(liquidation.isLong).toBe(true);
    expect(liquidation.sizeDeltaUsd).toBe("1500000000000000000000000000000000");
    expect(liquidation.ledger).toBe(100);
    expect(liquidation.transactionHash).toBe("tx-liq_req");

    // 2. Liquidation Execution
    const liqExePayload = {
      liquidation_key: "liq-test-key-1",
      market: marketToken,
      account,
      pnl_usd: "-1500000000000000000000000000000000",
      liquidation_price: "2450000000000000000000000000000",
    };
    await dispatchEvent(so4Event("liq_exe", liqExePayload));

    const liquidationsAfterExe = records("Liquidation");
    expect(liquidationsAfterExe).toHaveLength(1);

    const liquidationExe = liquidationsAfterExe[0];
    expect(liquidationExe.status).toBe("EXECUTED");
    expect(liquidationExe.pnlUsd).toBe("-1500000000000000000000000000000000");
    expect(liquidationExe.liquidationPrice).toBe("2450000000000000000000000000000");
  });

  test("indexes ADL risk events (adl_req and adl_exe)", async () => {
    // 1. ADL Request
    const adlReqPayload = {
      adl_key: "adl-test-key-1",
      market: marketToken,
      account,
      is_long: false,
      position_key: "pos-adl-test-1",
      collateral_token: marketToken,
      size_reduction_usd: "2000000000000000000000000000000000",
      pnl_usd: "30000000000000000000000000000000",
    };
    await dispatchEvent(so4Event("adl_req", adlReqPayload));

    const adlAfterReq = records("AdlEvent");
    expect(adlAfterReq).toHaveLength(1);

    const adl = adlAfterReq[0];
    expect(adl.id).toBe("adl:adl-test-key-1");
    expect(adl.key).toBe("adl-test-key-1");
    expect(adl.status).toBe("REQUESTED");
    expect(adl.account).toBe(account);
    expect(adl.marketId).toBe(`market:${marketToken}`);
    expect(adl.positionId).toBe("position:pos-adl-test-1");
    expect(adl.isLong).toBe(false);
    expect(adl.sizeReductionUsd).toBe("2000000000000000000000000000000000");
    expect(adl.pnlUsd).toBe("30000000000000000000000000000000");
    expect(adl.ledger).toBe(100);
    expect(adl.transactionHash).toBe("tx-adl_req");

    // 2. ADL Execution
    const adlExePayload = {
      adl_key: "adl-test-key-1",
      market: marketToken,
      account,
      size_reduction_usd: "2000000000000000000000000000000000",
      pnl_usd: "30000000000000000000000000000000",
      execution_price: "2600000000000000000000000000000",
    };
    await dispatchEvent(so4Event("adl_exe", adlExePayload));

    const adlAfterExe = records("AdlEvent");
    expect(adlAfterExe).toHaveLength(1);

    const adlExe = adlAfterExe[0];
    expect(adlExe.status).toBe("EXECUTED");
    expect(adlExe.executionPrice).toBe("2600000000000000000000000000000");
  });

  test("handles malformed risk events safely", async () => {
    // If event value has corrupted XDR, decoding throws and handleEvent catches it safely.
    const malformedEvent = {
      id: "raw-malformed-liq",
      topic: [xdr.ScVal.scvSymbol("liq_req")],
      value: {
        switch() {
          throw new Error("Corrupted event value");
        },
      } as any,
      contractId: Address.fromString(handlerContract).toScAddress(),
      ledger: { sequence: 100 },
      ledgerClosedAt: "2026-06-24T12:00:00Z",
      txHash: "tx-malformed-liq",
    } as any;

    await handleEvent(malformedEvent);

    expect(records("Liquidation")).toHaveLength(0);
    expect(logs.some((message) => message.includes("Skipping malformed SO4 event"))).toBe(true);
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

function reorgEvent(fixtureEvent: ReorgFixtureEvent): DecodedEvent {
  const named = Object.fromEntries(
    Object.entries(fixtureEvent.named).map(([key, value]) => [
      key,
      value === "MARKET_TOKEN" ? marketToken : value === "ACCOUNT" ? account : value,
    ]),
  ) as Record<string, string | boolean>;

  return {
    ...so4Event(fixtureEvent.eventName, named),
    id: fixtureEvent.id,
    ledger: fixtureEvent.ledger,
    timestamp: new Date("2026-06-24T12:01:00Z"),
    transactionHash: fixtureEvent.transactionHash,
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
