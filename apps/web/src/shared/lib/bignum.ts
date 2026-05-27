const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/

export function toSorobanAmount(
  display: string | number,
  decimals: number,
): bigint {
  const scale = getScale(decimals)
  const input = normalizeDisplay(display)
  const match = DECIMAL_PATTERN.exec(input)

  if (!match) {
    throw new Error(`Invalid decimal amount: ${input}`)
  }

  const [, sign = "", wholePart, fractionalPart = ""] = match

  if (fractionalPart.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places`)
  }

  const whole = BigInt(wholePart) * scale
  const fraction = BigInt(fractionalPart.padEnd(decimals, "0") || "0")
  const raw = whole + fraction

  return sign === "-" ? -raw : raw
}

export function fromSorobanAmount(raw: bigint, decimals: number): number {
  return Number(formatSorobanAmount(raw, decimals))
}

export function formatSorobanAmount(
  raw: bigint,
  decimals: number,
  precision?: number,
): string {
  const scale = getScale(decimals)
  const isNegative = raw < 0n
  let absolute = isNegative ? -raw : raw

  if (precision !== undefined) {
    assertWholeNumber(precision, "precision")

    if (precision < decimals) {
      const divisor = 10n ** BigInt(decimals - precision)
      const quotient = absolute / divisor
      const remainder = absolute % divisor
      absolute =
        remainder * 2n >= divisor ? (quotient + 1n) * divisor : quotient * divisor
    }
  }

  const whole = absolute / scale
  const fraction = absolute % scale
  const prefix = isNegative && absolute !== 0n ? "-" : ""

  if (decimals === 0) {
    return `${prefix}${whole.toString()}`
  }

  const fractionalDigits = fraction.toString().padStart(decimals, "0")
  const limitedFraction =
    precision === undefined
      ? fractionalDigits
      : fractionalDigits.slice(0, precision)
  const trimmedFraction = limitedFraction.replace(/0+$/, "")

  return trimmedFraction
    ? `${prefix}${whole.toString()}.${trimmedFraction}`
    : `${prefix}${whole.toString()}`
}

function normalizeDisplay(display: string | number): string {
  const value = typeof display === "number" ? display : display.trim()

  if (typeof display === "number") {
    if (!Number.isFinite(display)) {
      throw new Error("Amount must be finite")
    }
  }

  return normalizeDecimalNotation(expandExponentialNotation(value.toString()))
}

function expandExponentialNotation(value: string): string {
  const [mantissa, exponent] = value.toLowerCase().split("e")

  if (exponent === undefined) {
    return value
  }

  const shift = Number(exponent)

  if (!Number.isInteger(shift)) {
    return value
  }

  const sign = mantissa.startsWith("-") || mantissa.startsWith("+")
    ? mantissa[0]
    : ""
  const unsignedMantissa = sign ? mantissa.slice(1) : mantissa
  const [wholePart, fractionalPart = ""] = unsignedMantissa.split(".")
  const digits = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, "")
  const decimalIndex = wholePart.length + shift

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
}

function normalizeDecimalNotation(value: string): string {
  const sign = value.startsWith("-") || value.startsWith("+") ? value[0] : ""
  const unsigned = sign ? value.slice(1) : value
  const withLeadingZero = unsigned.startsWith(".") ? `0${unsigned}` : unsigned
  const withTrailingZero = withLeadingZero.endsWith(".")
    ? `${withLeadingZero}0`
    : withLeadingZero

  return `${sign}${withTrailingZero}`
}

function getScale(decimals: number): bigint {
  assertWholeNumber(decimals, "decimals")

  return 10n ** BigInt(decimals)
}

function assertWholeNumber(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}
