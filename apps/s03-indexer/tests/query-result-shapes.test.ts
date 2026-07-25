import { describe, expect, test } from "bun:test";
import { assertFrontendQueryResultShape } from "../src/queryResultShapes";

const account = "GB6YQTHA5COVDNKLV6B4ISXYE6A2ZY5ENBZJTQVI7RI4KOCC6JFZ6C7E";
const timestamp = new Date("2026-06-24T12:00:00Z");

const fixtures = seedQueryFixtures();

describe("frontend indexer query result shapes", () => {
  test("markets query keeps field names and types stable", () => {
    const [market] = queryMarkets(fixtures);

    assertFrontendQueryResultShape("markets", market);
    expect(Object.keys(market).sort()).toEqual([
      "createdBy",
      "createdLedger",
      "createdTimestamp",
      "createdTransactionHash",
      "id",
      "indexToken",
      "key",
      "longToken",
      "marketToken",
      "name",
      "shortToken",
      "status",
    ]);
  });

  test("positions query keeps frontend-consumed field names and types stable", () => {
    const [position] = queryPositionsByAccount(fixtures, account);

    assertFrontendQueryResultShape("positions", position);
    expect(position.market).toEqual({
      id: "market:BTC-USD",
      key: "BTC-USD",
      name: "BTC/USD",
      indexToken: { address: "CBTCINDEX", symbol: "BTC" },
      longToken: { address: "CLONGTOKEN", symbol: "BTC" },
      shortToken: { address: "CSHORTTOKEN", symbol: "USDC" },
    });
    expect(typeof position.isLong).toBe("boolean");
    expect(typeof position.sizeUsd).toBe("string");
  });

  test("orders query keeps frontend-consumed field names and types stable", () => {
    const [order] = queryOrdersByAccount(fixtures, account);

    assertFrontendQueryResultShape("orders", order);
    expect(order.market).toEqual({
      id: "market:BTC-USD",
      key: "BTC-USD",
      name: "BTC/USD",
    });
    expect(typeof order.orderType).toBe("string");
    expect(typeof order.isLong).toBe("boolean");
    expect(order.cancelledTimestamp).toBeNull();
  });
});

type QueryFixtures = ReturnType<typeof seedQueryFixtures>;

function seedQueryFixtures() {
  const market = {
    id: "market:BTC-USD",
    key: "BTC-USD",
    name: "BTC/USD",
    status: "ACTIVE",
    createdBy: account,
    createdLedger: 12345,
    createdTimestamp: timestamp,
    createdTransactionHash: "tx-market",
    marketToken: { address: "CMARKETTOKEN", symbol: "BTC-USD" },
    indexToken: { address: "CBTCINDEX", symbol: "BTC" },
    longToken: { address: "CLONGTOKEN", symbol: "BTC" },
    shortToken: { address: "CSHORTTOKEN", symbol: "USDC" },
  };

  const collateralToken = {
    address: "CSHORTTOKEN",
    symbol: "USDC",
    decimals: 7,
  };

  return {
    markets: [market],
    positions: [
      {
        id: "position:pos-1",
        key: "pos-1",
        account,
        isLong: true,
        status: "open",
        sizeUsd: "500000000000000000000000000000000",
        collateralAmount: "1000000000",
        averagePrice: "50000",
        entryFundingRate: "0",
        reserveAmount: "250000000",
        realizedPnlUsd: "0",
        realizedPnlAmount: "0",
        openedLedger: 12346,
        openedTimestamp: timestamp,
        updatedTimestamp: timestamp,
        closedTimestamp: null,
        market: {
          id: market.id,
          key: market.key,
          name: market.name,
          indexToken: market.indexToken,
          longToken: market.longToken,
          shortToken: market.shortToken,
        },
        collateralToken,
      },
    ],
    orders: [
      {
        id: "order:ord-1",
        key: "ord-1",
        account,
        orderType: "MarketIncrease",
        status: "created",
        isLong: true,
        sizeDeltaUsd: "100000000000000000000000000000000",
        collateralDeltaAmount: "250000000",
        triggerPrice: null,
        acceptablePrice: "51000",
        createdTimestamp: timestamp,
        updatedTimestamp: timestamp,
        frozenTimestamp: null,
        frozenTransactionHash: null,
        executedTimestamp: null,
        executedTransactionHash: null,
        cancelledTimestamp: null,
        cancelledTransactionHash: null,
        cancellationReason: null,
        market: {
          id: market.id,
          key: market.key,
          name: market.name,
        },
        collateralToken,
      },
    ],
  };
}

function queryMarkets(store: QueryFixtures): Array<Record<string, unknown>> {
  return store.markets;
}

function queryPositionsByAccount(
  store: QueryFixtures,
  accountId: string,
): Array<Record<string, unknown>> {
  return store.positions.filter((position) => position.account === accountId);
}

function queryOrdersByAccount(
  store: QueryFixtures,
  accountId: string,
): Array<Record<string, unknown>> {
  return store.orders.filter((order) => order.account === accountId);
}
