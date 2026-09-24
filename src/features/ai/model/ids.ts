/** 名义类型：运行时仍是 T，编译期靠 __brand 区分不同 ID / 语义。 */
export type Brand<T, Name extends string> = T & { readonly __brand: Name }

/** 客户端幂等键等不属于特定资源的公开 ID。 */
export type PublicId = Brand<string, 'PublicId'>
/** 对话公开 ID；匿名首轮也可能使用本地临时值。 */
export type ConversationId = Brand<string, 'ConversationId'>
/** 一轮用户提问及其助手回答版本的公开 ID。 */
export type TurnId = Brand<string, 'TurnId'>
/** 一次 AI 生成任务的公开 ID。 */
export type RunId = Brand<string, 'RunId'>
/** 单条用户或助手消息的公开 ID。 */
export type MessageId = Brand<string, 'MessageId'>

/** 调用方需保证裸字符串已在协议边界完成格式校验。 */
export function toPublicId(value: string): PublicId { return value as PublicId }
export function toConversationId(value: string): ConversationId { return value as ConversationId }
export function toTurnId(value: string): TurnId { return value as TurnId }
export function toRunId(value: string): RunId { return value as RunId }
export function toMessageId(value: string): MessageId { return value as MessageId }
