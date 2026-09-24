<script setup lang="ts">
/**
 * 隐藏文件选择器。open() 由「+」菜单调用；校验失败走 reject，成功走 prepared。
 */
import { ref } from 'vue'
import { prepareImage, validateImageFile, type PreparedImage } from '@/utils/image'

/** 只保留隐藏的文件输入与校验逻辑，通过 open() 由外部触发（「+」菜单）。 */
const emit = defineEmits<{ prepared: [image: PreparedImage]; reject: [message: string] }>()

const input = ref<HTMLInputElement | null>(null)

function open(): void {
  input.value?.click()
}

async function choose(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  const error = validateImageFile(file)
  if (error) {
    emit('reject', error)
    return
  }
  try {
    emit('prepared', await prepareImage(file))
  } catch (error) {
    emit('reject', error instanceof Error ? error.message : '图片处理失败')
  }
}

defineExpose({ open })
</script>

<template>
  <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" hidden aria-hidden="true" @change="choose" />
</template>
