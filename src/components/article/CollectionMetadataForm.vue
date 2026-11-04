<script setup lang="ts">
import { reactive, watch } from 'vue'
const props = withDefaults(defineProps<{ title?: string; description?: string; disabled?: boolean; submitLabel?: string }>(), {
  title: '', description: '', disabled: false, submitLabel: '保存合集'
})
const emit = defineEmits<{ submit: [value: { title: string; description: string }] }>()
const form = reactive({ title: '', description: '' })
watch(() => [props.title, props.description], () => { form.title = props.title; form.description = props.description }, { immediate: true })
function submit() { if (!props.disabled && form.title.trim()) emit('submit', { title: form.title.trim(), description: form.description }) }
</script>
<template>
  <a-form name="collection-metadata" :model="form" layout="vertical" :disabled="disabled" @finish="submit">
    <a-form-item label="合集名称" name="title" :rules="[{ required: true, whitespace: true, max: 256, message: '请输入合集名称，最多 256 个字符' }]"><a-input v-model:value="form.title" :maxlength="256" autocomplete="off" placeholder="输入合集名称" /></a-form-item>
    <a-form-item label="简介" name="description"><a-textarea v-model:value="form.description" :rows="3" :maxlength="4000" show-count placeholder="介绍这个合集的内容" /></a-form-item>
    <a-form-item><a-button type="primary" html-type="submit" :disabled="disabled">{{ submitLabel }}</a-button></a-form-item>
  </a-form>
</template>
