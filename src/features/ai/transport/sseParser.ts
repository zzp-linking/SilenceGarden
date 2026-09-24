/**
 * SSE 增量解析器。
 * 按空行切帧，只取 `data:` 行；`[DONE]` 与非法 JSON 丢弃。
 * maxBuffer 同时限制单帧和未完成缓冲，防止恶意超长事件撑爆内存。
 */
import { isRunEvent, type RunEvent } from '@/features/ai/model'

export interface SseParser {
  /** 追加一段解码后的文本，返回本段内完整的 RunEvent。 */
  push(chunk: string): RunEvent[]
  /** 流结束时把剩余缓冲当最后一帧解析。 */
  flush(): RunEvent[]
}

/** 解析一块 SSE（以空行分隔）。超限抛错；非 RunEvent 返回 null。 */
function parseBlock(block: string, maxEventBytes: number): RunEvent | null {
  if (new TextEncoder().encode(block).byteLength > maxEventBytes) throw new Error('SSE event exceeded size limit')
  const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
  if (!data || data === '[DONE]') return null
  try {
    const parsed: unknown = JSON.parse(data)
    return isRunEvent(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * @param maxBuffer 单帧与未完成缓冲的字节上限，默认 1MiB
 */
export function createSseParser(maxBuffer = 1024 * 1024): SseParser {
	if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) throw new Error('SSE buffer limit must be positive')
  let buffer = ''
  const consume = (): RunEvent[] => {
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    return blocks.map(block => parseBlock(block, maxBuffer)).filter((event): event is RunEvent => event !== null)
  }
  return {
    push(chunk: string): RunEvent[] {
      buffer += chunk
      const events = consume()
      if (new TextEncoder().encode(buffer).byteLength > maxBuffer) throw new Error('SSE event buffer exceeded limit')
      return events
    },
    flush(): RunEvent[] {
      if (!buffer.trim()) return []
      const event = parseBlock(buffer, maxBuffer)
      buffer = ''
      return event ? [event] : []
    }
  }
}
