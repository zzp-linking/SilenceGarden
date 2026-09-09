import { isRunEvent, type RunEvent } from '@/types/ai'

export interface SseParser {
  push(chunk: string): RunEvent[]
  flush(): RunEvent[]
}

function parseBlock(block: string): RunEvent | null {
  const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
  if (!data || data === '[DONE]') return null
  try {
    const parsed: unknown = JSON.parse(data)
    return isRunEvent(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function createSseParser(maxBuffer = 1024 * 1024): SseParser {
  let buffer = ''
  const consume = (): RunEvent[] => {
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    return blocks.map(parseBlock).filter((event): event is RunEvent => event !== null)
  }
  return {
    push(chunk: string): RunEvent[] {
      buffer += chunk
      if (buffer.length > maxBuffer) throw new Error('SSE event buffer exceeded limit')
      return consume()
    },
    flush(): RunEvent[] {
      if (!buffer.trim()) return []
      const event = parseBlock(buffer)
      buffer = ''
      return event ? [event] : []
    }
  }
}
