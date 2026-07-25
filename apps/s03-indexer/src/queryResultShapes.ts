export type QueryEntityName = "markets" | "orders" | "positions";

export type FieldShape =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "nullableString"
  | "nullableNumber"
  | "nullableBoolean"
  | "nullableDate"
  | NestedShape;

export type NestedShape = {
  fields: Record<string, FieldShape>;
};

export const frontendQueryResultShapes: Record<QueryEntityName, NestedShape> = {
  markets: {
    fields: {
      id: "string",
      key: "string",
      name: "nullableString",
      status: "string",
      createdBy: "nullableString",
      createdLedger: "number",
      createdTimestamp: "date",
      createdTransactionHash: "string",
      marketToken: tokenSummaryShape(),
      indexToken: tokenSummaryShape(),
      longToken: tokenSummaryShape(),
      shortToken: tokenSummaryShape(),
    },
  },
  orders: {
    fields: {
      id: "string",
      key: "string",
      account: "string",
      orderType: "string",
      status: "string",
      isLong: "nullableBoolean",
      sizeDeltaUsd: "nullableString",
      collateralDeltaAmount: "nullableString",
      triggerPrice: "nullableString",
      acceptablePrice: "nullableString",
      createdTimestamp: "nullableDate",
      updatedTimestamp: "nullableDate",
      frozenTimestamp: "nullableDate",
      frozenTransactionHash: "nullableString",
      executedTimestamp: "nullableDate",
      executedTransactionHash: "nullableString",
      cancelledTimestamp: "nullableDate",
      cancelledTransactionHash: "nullableString",
      cancellationReason: "nullableString",
      market: marketSummaryShape(),
      collateralToken: tokenSummaryWithDecimalsShape(),
    },
  },
  positions: {
    fields: {
      id: "string",
      key: "string",
      account: "string",
      isLong: "boolean",
      status: "string",
      sizeUsd: "nullableString",
      collateralAmount: "nullableString",
      averagePrice: "nullableString",
      entryFundingRate: "nullableString",
      reserveAmount: "nullableString",
      realizedPnlUsd: "nullableString",
      realizedPnlAmount: "nullableString",
      openedLedger: "nullableNumber",
      openedTimestamp: "nullableDate",
      updatedTimestamp: "nullableDate",
      closedTimestamp: "nullableDate",
      market: {
        fields: {
          ...marketSummaryShape().fields,
          indexToken: tokenSummaryShape(),
          longToken: tokenSummaryShape(),
          shortToken: tokenSummaryShape(),
        },
      },
      collateralToken: tokenSummaryWithDecimalsShape(),
    },
  },
};

export function assertFrontendQueryResultShape(
  entityName: QueryEntityName,
  node: Record<string, unknown>,
): void {
  assertShape(entityName, frontendQueryResultShapes[entityName], node);
}

function assertShape(path: string, shape: NestedShape, value: unknown): void {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }

  const expectedKeys = Object.keys(shape.fields).sort();
  const actualKeys = Object.keys(value).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${path} fields changed. Expected ${expectedKeys.join(", ")}; received ${actualKeys.join(", ")}`,
    );
  }

  for (const [field, fieldShape] of Object.entries(shape.fields)) {
    assertField(`${path}.${field}`, fieldShape, value[field]);
  }
}

function assertField(path: string, shape: FieldShape, value: unknown): void {
  if (typeof shape === "object") {
    assertShape(path, shape, value);
    return;
  }

  if (shape.startsWith("nullable") && value === null) {
    return;
  }

  const expectedType = shape.replace("nullable", "").toLowerCase();
  if (expectedType === "date") {
    if (!(value instanceof Date)) {
      throw new Error(`${path} must be a Date or null`);
    }
    return;
  }

  if (typeof value !== expectedType) {
    throw new Error(`${path} must be ${shape}`);
  }
}

function tokenSummaryShape(): NestedShape {
  return {
    fields: {
      address: "string",
      symbol: "nullableString",
    },
  };
}

function tokenSummaryWithDecimalsShape(): NestedShape {
  return {
    fields: {
      address: "string",
      decimals: "nullableNumber",
      symbol: "nullableString",
    },
  };
}

function marketSummaryShape(): NestedShape {
  return {
    fields: {
      id: "string",
      key: "string",
      name: "nullableString",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
