<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  chunks: string[];
  isFinished: number;
  typingText?: string;
}>();

const chunkText = computed(() => (props.chunks || []).join(''));
const isTypingPlaceholder = computed(
  () => !chunkText.value && Boolean(props.typingText) && props.isFinished !== 1,
);
const displayText = computed(() => chunkText.value || props.typingText || '');
</script>

<template>
  <div class="stream-message" :class="{ 'stream-message--typing': isTypingPlaceholder }">
    <span class="stream-message__text">{{ displayText }}</span>
    <span v-if="props.isFinished !== 1" class="stream-message__cursor" />
  </div>
</template>

<style scoped>
.stream-message {
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.stream-message--typing {
  opacity: 0.72;
}

.stream-message__text {
  display: inline;
}

.stream-message__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 1px;
  background-color: currentColor;
  vertical-align: text-bottom;
  animation: stream-cursor-blink 1s step-end infinite;
}

@keyframes stream-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
