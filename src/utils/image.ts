export interface ImageLimits { maxBytes: number; maxCount: number; maxDimension: number }
export interface PreparedImage { blob: Blob; previewUrl: string; width: number; height: number }

export const DEFAULT_IMAGE_LIMITS: ImageLimits = { maxBytes: 8 * 1024 * 1024, maxCount: 1, maxDimension: 2048 }

export function validateImageFile(file: File, limits: ImageLimits = DEFAULT_IMAGE_LIMITS): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return '仅支持 JPG、PNG 或 WebP 图片。'
  if (file.size > limits.maxBytes) return `图片不能超过 ${Math.round(limits.maxBytes / 1024 / 1024)} MiB。`
  return null
}

export async function prepareImage(file: File, limits: ImageLimits = DEFAULT_IMAGE_LIMITS): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图片无法解码')) })
    const scale = Math.min(1, limits.maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale)); const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不支持图片处理')
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片处理失败')), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88))
    return { blob, previewUrl: URL.createObjectURL(blob), width, height }
  } finally { URL.revokeObjectURL(objectUrl) }
}
