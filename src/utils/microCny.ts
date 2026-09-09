const MICRO_PER_YUAN = 1_000_000n

function normalizeDecimal(value: string): { whole: bigint; fraction: string } {
  const normalized = value.trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{0,6})?$/.test(normalized)) {
    throw new Error('金额必须是非负十进制定点数，最多 6 位小数')
  }
  const [wholeText, fractionText = ''] = normalized.split('.')
  return { whole: BigInt(wholeText), fraction: fractionText.padEnd(6, '0') }
}

/** Converts a decimal Yuan string to an exact integer micro-CNY value. */
export function yuanToMicroCny(value: string): number {
  const parsed = normalizeDecimal(value)
  const micros = parsed.whole * MICRO_PER_YUAN + BigInt(parsed.fraction || '0')
  const result = Number(micros)
  if (!Number.isSafeInteger(result)) throw new Error('金额超出前端安全整数范围')
  return result
}

/** Formats an integer micro-CNY value without using binary floating point. */
export function microCnyToYuan(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('micro_cny 必须是非负安全整数')
  const micros = BigInt(value)
  const whole = micros / MICRO_PER_YUAN
  const fraction = (micros % MICRO_PER_YUAN).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString()
}

export function integerField(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} 必须是整数`)
  const result = Number(value)
  if (!Number.isSafeInteger(result)) throw new Error(`${label} 超出前端安全整数范围`)
  return result
}
