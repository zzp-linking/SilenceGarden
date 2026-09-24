/** 浏览器选择和压缩图片时采用的限制。 */
export interface ImageLimits {
  /** 单张原始文件允许的最大字节数。 */
  maxBytes: number
  /** 一次提问允许选择的最大图片数量。 */
  maxCount: number
  /** 压缩后最长边允许的最大像素数。 */
  maxDimension: number
}
/** 已完成解码和压缩、可供预览与上传的图片。 */
export interface PreparedImage {
  /** 实际提交给接口的图片二进制。 */
  blob: Blob
  /** UI 预览使用的 Object URL，调用方负责释放。 */
  previewUrl: string
  /** 处理后的图片宽度。 */
  width: number
  /** 处理后的图片高度。 */
  height: number
}

export const DEFAULT_IMAGE_LIMITS: ImageLimits = { maxBytes: 8 * 1024 * 1024, maxCount: 1, maxDimension: 2048 }

/** 在解码前校验浏览器可处理的图片格式和文件大小。 */
export function validateImageFile(file: File, limits: ImageLimits = DEFAULT_IMAGE_LIMITS): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return '仅支持 JPG、PNG 或 WebP 图片。'
  if (file.size > limits.maxBytes) return `图片不能超过 ${Math.round(limits.maxBytes / 1024 / 1024)} MiB。`
  return null
}

/** 解码并等比压缩图片，返回适合上传的 Blob 与本地预览地址。 */
export async function prepareImage(file: File, limits: ImageLimits = DEFAULT_IMAGE_LIMITS): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图片无法解码')) })
    // 只缩小不放大，避免低分辨率图片被无意义重采样。
    const scale = Math.min(1, limits.maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale)); const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不支持图片处理')
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片处理失败')), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88))
    return { blob, previewUrl: URL.createObjectURL(blob), width, height }
  } finally {
    // 解码用的临时 URL 已无引用；返回给 UI 的 previewUrl 是另一份 URL。
    URL.revokeObjectURL(objectUrl)
  }
}
