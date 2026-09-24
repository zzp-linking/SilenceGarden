const byteToHex = (value: number): string => value.toString(16).padStart(2, '0')

/** 创建时间有序的 UUIDv7，用作客户端幂等请求 ID。 */
export function createUuidV7(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('当前浏览器不支持安全随机数，无法创建请求')
  }

  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)

  // UUIDv7 的前 48 位保存 Unix 毫秒时间戳，保持请求 ID 大致按时间排序。
  let timestamp = Date.now()
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256
    timestamp = Math.floor(timestamp / 256)
  }

  // 写入版本位（7）和 RFC 4122 variant 位，其余位继续保留安全随机数。
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byteToHex).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
