import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GET_ACCOUNT_ORDERS,
  GET_ACCOUNT_POSITIONS,
  GET_MARKETS,
} from "../../web/src/lib/graphql/queries";

type ScalarKind = "boolean" | "nullable-string" | "number" | "string";
type ExpectedShape = Record<string, ScalarKind | ExpectedShape>;
type FixtureValue = boolean | null | number | string | FixtureNode;
type FixtureNode = Record<string, FixtureValue>;
type FixtureEnvelope = { nodes: FixtureNode[] };

const account = "GDUKMGUGDZQK6YWNJGVNMYX3KDB3TN2OMY4DQQLPBVKYJ6CQE7WJPW3K";
const otherAccount = "GBMS2RNCHN6GWLWUGDNVVMXQCNLLCVHQV63VB3YJ6NIKL6II4NQGRK7G";
const schema = readFileSync(join(import.meta.dir, "..", "schema.graphql"), "utf8");

const tokenFixture = {
  address: "CCBUUSYZJTGVA6PYUNQDFPZFHTBZ2QSHOUO7YAGRQVA46T3ZLSIYULS4",
  symbol: "TUSDC",
  decimals: 7,
} satisfies FixtureNode;

const marketFixture = {
  id: "market:SO4-TEST",
  key: "SO4-TEST",
  name: "SO4 Test Market",
  status: "ACTIVE",
  createdBy: account,
  createdLedger: 604188,
  createdTimestamp: "2026-06-24T12:00:00.000Z",
  createdTransactionHash: "tx-market-create",
  marketToken: {
    address: "CBK3D6VYJL6N7VQ4OTXWATNXY4E7KSUBWG2XK2JMAU3LUR2SNMKTOKN3",
    symbol: "SO4-LP",
  },
  indexToken: {
    address: "CAJ6BZKGFT47ALGMVFZZGAOXBV2RWIVYVCU4WJCQIURKRNXU346RWVAU",
    symbol: "TETH",
  },
  longToken: {
    address: "CA53VZCXA7ORWS5BNDXB4MJXH7VXUD2Y7W6YTS3KO7ZKX2Y3MJOHD2AY",
    symbol: "TETH-LONG",
  },
  shortToken: {
    address: "CBAN5YU3KRDKPTQ2H76D6S7HQFPRBGUD524F65BUM2RQCITPTRLKWKES",
    symbol: "TETH-SHORT",
  },
} satisfies FixtureNode;

const queryFixtures = {
  markets: {
    nodes: [marketFixture],
  },
  orders: {
    nodes: [
      {
        id: "order:SO4-ORDER-1",
        key: "SO4-ORDER-1",
        account,
        orderType: "MARKET",
        status: "UPDATED",
        isLong: true,
        sizeDeltaUsd: "500000000000000000000000000000000",
        collateralDeltaAmount: "125000000",
        triggerPrice: null,
        acceptablePrice: "2000000000000000000000000000000000",
        createdTimestamp: "2026-06-24T12:01:00.000Z",
        updatedTimestamp: "2026-06-24T12:02:00.000Z",
        frozenTimestamp: null,
        frozenTransactionHash: null,
        executedTimestamp: null,
        executedTransactionHash: null,
        cancelledTimestamp: null,
        cancelledTransactionHash: null,
        cancellationReason: null,
        market: pickFields(marketFixture, ["id", "key", "name"]),
        collateralToken: tokenFixture,
      },
      {
        id: "order:SO4-ORDER-2",
        key: "SO4-ORDER-2",
        account: otherAccount,
        orderType: "LIMIT",
        status: "CREATED",
        isLong: false,
        sizeDeltaUsd: "250000000000000000000000000000000",
        collateralDeltaAmount: "75000000",
        triggerPrice: "1900000000000000000000000000000000",
        acceptablePrice: "1880000000000000000000000000000000",
        createdTimestamp: "2026-06-24T12:03:00.000Z",
        updatedTimestamp: "2026-06-24T12:03:00.000Z",
        frozenTimestamp: null,
        frozenTransactionHash: null,
        executedTimestamp: null,
        executedTransactionHash: null,
        cancelledTimestamp: null,
        cancelledTransactionHash: null,
        cancellationReason: null,
        market: pickFields(marketFixture, ["id", "key", "name"]),
        collateralToken: tokenFixture,
      },
    ],
  },
  positions: {
    nodes: [
      {
        id: "position:SO4-POSITION-1",
        key: "SO4-POSITION-1",
        account,
        isLong: true,
        status: "OPEN",
        sizeUsd: "500000000000000000000000000000000",
        collateralAmount: "125000000",
        averagePrice: "2000000000000000000000000000000000",
        entryFundingRate: "0",
        reserveAmount: "400000000",
        realizedPnlUsd: "0",
        realizedPnlAmount: "0",
        openedLedger: 604189,
        openedTimestamp: "2026-06-24T12:01:00.000Z",
        updatedTimestamp: "2026-06-24T12:02:00.000Z",
        closedTimestamp: null,
        market: pickFields(marketFixture, ["id", "key", "name", "indexToken", "longToken", "shortToken"]),
        collateralToken: tokenFixture,
      },
      {
        id: "position:SO4-POSITION-2",
        key: "SO4-POSITION-2",
        account: otherAccount,
        isLong: false,
        status: "OPEN",
        sizeUsd: "250000000000000000000000000000000",
        collateralAmount: "75000000",
        averagePrice: "1900000000000000000000000000000000",
        entryFundingRate: "0",
        reserveAmount: "200000000",
        realizedPnlUsd: "0",
        realizedPnlAmount: "0",
        openedLedger: 604190,
        openedTimestamp: "2026-06-24T12:03:00.000Z",
        updatedTimestamp: "2026-06-24T12:03:00.000Z",
        closedTimestamp: null,
        market: pickFields(marketFixture, ["id", "key", "name", "indexToken", "longToken", "shortToken"]),
        collateralToken: tokenFixture,
      },
    ],
  },
} satisfies Record<"markets" | "orders" | "positions", FixtureEnvelope>;

const marketShape = {
  id: "string",
  key: "string",
  name: "nullable-string",
  status: "string",
  createdBy: "nullable-string",
  createdLedger: "number",
  createdTimestamp: "string",
  createdTransactionHash: "string",
  marketToken: {
    address: "string",
    symbol: "nullable-string",
  },
  indexToken: {
    address: "string",
    symbol: "nullable-string",
  },
  longToken: {
    address: "string",
    symbol: "nullable-string",
  },
  shortToken: {
    address: "string",
    symbol: "nullable-string",
  },
} satisfies ExpectedShape;

const orderShape = {
  id: "string",
  key: "string",
  account: "string",
  orderType: "string",
  status: "string",
  isLong: "boolean",
  sizeDeltaUsd: "nullable-string",
  collateralDeltaAmount: "nullable-string",
  triggerPrice: "nullable-string",
  acceptablePrice: "nullable-string",
  createdTimestamp: "nullable-string",
  updatedTimestamp: "nullable-string",
  frozenTimestamp: "nullable-string",
  frozenTransactionHash: "nullable-string",
  executedTimestamp: "nullable-string",
  executedTransactionHash: "nullable-string",
  cancelledTimestamp: "nullable-string",
  cancelledTransactionHash: "nullable-string",
  cancellationReason: "nullable-string",
  market: {
    id: "string",
    key: "string",
    name: "nullable-string",
  },
  collateralToken: {
    address: "string",
    symbol: "nullable-string",
    decimals: "number",
  },
} satisfies ExpectedShape;

const positionShape = {
  id: "string",
  key: "string",
  account: "string",
  isLong: "boolean",
  status: "string",
  sizeUsd: "nullable-string",
  collateralAmount: "nullable-string",
  averagePrice: "nullable-string",
  entryFundingRate: "nullable-string",
  reserveAmount: "nullable-string",
  realizedPnlUsd: "nullable-string",
  realizedPnlAmount: "nullable-string",
  openedLedger: "number",
  openedTimestamp: "nullable-string",
  updatedTimestamp: "nullable-string",
  closedTimestamp: "nullable-string",
  market: {
    id: "string",
    key: "string",
    name: "nullable-string",
    indexToken: {
      address: "string",
      symbol: "nullable-string",
    },
    longToken: {
      address: "string",
      symbol: "nullable-string",
    },
    shortToken: {
      address: "string",
      symbol: "nullable-string",
    },
  },
  collateralToken: {
    address: "string",
    symbol: "nullable-string",
    decimals: "number",
  },
} satisfies ExpectedShape;

describe("GraphQL resolver result shapes", () => {
  test("schema exposes the fields selected by the frontend market/order/position queries", () => {
    expectTypeFields("Market", topLevelFields(marketShape));
    expectTypeFields("Order", topLevelFields(orderShape));
    expectTypeFields("Position", topLevelFields(positionShape));
    expectTypeFields("Token", ["address", "symbol", "decimals"]);
  });

  test("frontend query documents keep the expected envelopes and nested nodes", () => {
    expectQuery(GET_MARKETS, ["markets", "nodes", ...topLevelFields(marketShape)]);
    expectQuery(GET_ACCOUNT_ORDERS, ["orders", "nodes", ...topLevelFields(orderShape)]);
    expectQuery(GET_ACCOUNT_POSITIONS, ["positions", "nodes", ...topLevelFields(positionShape)]);
  });

  test("fixture-backed queries return stable market nodes without a live SubQuery node", () => {
    const result = queryMarkets();

    expect(result.nodes).toHaveLength(1);
    expectNodeShape(result.nodes[0], marketShape);
  });

  test("fixture-backed account queries preserve order and position field names and types", () => {
    const orders = queryByAccount("orders", account);
    const positions = queryByAccount("positions", account);

    expect(orders.nodes).toHaveLength(1);
    expect(positions.nodes).toHaveLength(1);
    expect(orders.nodes[0].account).toBe(account);
    expect(positions.nodes[0].account).toBe(account);
    expectNodeShape(orders.nodes[0], orderShape);
    expectNodeShape(positions.nodes[0], positionShape);
  });
});

function queryMarkets(): FixtureEnvelope {
  return queryFixtures.markets;
}

function queryByAccount(collection: "orders" | "positions", accountId: string): FixtureEnvelope {
  return {
    nodes: queryFixtures[collection].nodes.filter((node) => node.account === accountId),
  };
}

function expectTypeFields(typeName: string, expectedFields: string[]) {
  const fields = schemaFields(typeName);

  for (const field of expectedFields) {
    expect(fields.has(field), `${typeName}.${field} should exist in schema.graphql`).toBe(true);
  }
}

function schemaFields(typeName: string) {
  const match = schema.match(new RegExp(`type\\s+${typeName}\\s+@entity\\s+{([\\s\\S]*?)\\n}`));
  if (!match) {
    throw new Error(`Missing ${typeName} entity in schema.graphql`);
  }

  return new Set([...match[1].matchAll(/^  ([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((field) => field[1]));
}

function expectQuery(document: { loc?: { source?: { body?: string } } }, expectedFields: string[]) {
  const body = document.loc?.source?.body;
  expect(body).toBeDefined();

  for (const field of expectedFields) {
    expect(body).toContain(field);
  }
}

function expectNodeShape(node: FixtureNode, shape: ExpectedShape, path = "node") {
  for (const [field, expected] of Object.entries(shape)) {
    expect(Object.prototype.hasOwnProperty.call(node, field), `${path}.${field} should be present`).toBe(true);

    const value = node[field];
    if (typeof expected === "string") {
      expectScalarKind(value, expected, `${path}.${field}`);
    } else {
      expect(value && typeof value === "object" && !Array.isArray(value), `${path}.${field} should be an object`).toBe(
        true,
      );
      expectNodeShape(value as FixtureNode, expected, `${path}.${field}`);
    }
  }
}

function expectScalarKind(value: FixtureValue, kind: ScalarKind, path: string) {
  if (kind === "nullable-string") {
    expect(value === null || typeof value === "string", `${path} should be a string or null`).toBe(true);
    return;
  }

  expect(typeof value, `${path} should be a ${kind}`).toBe(kind);
}

function topLevelFields(shape: ExpectedShape) {
  return Object.keys(shape);
}

function pickFields(source: FixtureNode, fields: string[]) {
  const picked: FixtureNode = {};

  for (const field of fields) {
    picked[field] = source[field];
  }

  return picked;
}
