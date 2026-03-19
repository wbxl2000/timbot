<script lang="ts" setup>
import { computed, watchEffect } from 'vue';
import { Message } from '@tencentcloud/chat-uikit-vue3';
import StreamMessage from './StreamMessage.vue';

const props = defineProps<{
  message: any;
  nick?: string;
  alignment?: 'left' | 'right' | 'two-sided';
  messageActionList?: any[];
  isAggregated?: boolean;
  isFirstInChunk?: boolean;
  isLastInChunk?: boolean;
  isHiddenMessageAvatar?: boolean;
  isHiddenMessageNick?: boolean;
  isHiddenMessageMeta?: boolean;
}>();

interface BotPayload {
  chatbotPlugin: number;
  src: number;
  chunks?: string[];
  isFinished?: number;
  typingText?: string;
  errorInfo?: string;
}

const botPayload = computed<BotPayload | null>(() => {
  try {
    const data = JSON.parse(props.message?.payload?.data || '{}');
    if (data?.chatbotPlugin === 2) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
});

const isStreamMessage = computed(() => botPayload.value?.src === 2);
const isBotError = computed(() => botPayload.value?.src === 23);
const isBotMessage = computed(() => isStreamMessage.value || isBotError.value);

const isOwner = computed(() => props.message?.flow === 'out');

if (import.meta.env.DEV) {
  watchEffect(() => {
    const message = props.message;
    const data = message?.payload?.data;
    if (!message || typeof data !== 'string' || !data.trim()) {
      return;
    }

    console.debug('[StreamMessage debug]', {
      id: message.ID,
      type: message.type,
      flow: message.flow,
      payload: message.payload,
      parsedPayload: botPayload.value,
    });
  });
}
</script>

<template>
  <!-- non-bot messages: delegate to default Message -->
  <Message
    v-if="!isBotMessage"
    v-bind="props"
  />

  <!-- bot stream / error messages: custom layout -->
  <div
    v-else
    class="bot-message-layout"
    :class="{
      'bot-message-layout--left': !isOwner,
      'bot-message-layout--right': isOwner,
    }"
    :data-message-id="message.ID"
  >
    <div class="bot-message-layout__wrapper">
      <div v-if="!props.isHiddenMessageNick" class="bot-message-layout__nick">
        {{ props.nick || message.nameCard || message.nick || message.from }}
      </div>
      <div
        class="bot-message-bubble"
        :class="{ 'bot-message-bubble--left': !isOwner, 'bot-message-bubble--right': isOwner }"
      >
        <StreamMessage
          v-if="isStreamMessage"
          :chunks="botPayload!.chunks || []"
          :is-finished="botPayload!.isFinished || 0"
          :typing-text="botPayload!.typingText"
        />
        <div v-else-if="isBotError" class="bot-error-message">
          {{ botPayload!.errorInfo }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bot-message-layout {
  display: flex;
  width: 100%;
  gap: 8px;
}

.bot-message-layout--left {
  flex-direction: row;
}

.bot-message-layout--right {
  flex-direction: row-reverse;
}

.bot-message-layout__wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 70%;
}

.bot-message-layout--left .bot-message-layout__wrapper {
  align-items: flex-start;
}

.bot-message-layout--right .bot-message-layout__wrapper {
  align-items: flex-end;
}

.bot-message-layout__nick {
  font-size: 12px;
  color: var(--text-color-tertiary, #999);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bot-message-bubble {
  border-radius: 10px;
  overflow: hidden;
  word-break: break-word;
}

.bot-message-bubble--left {
  background-color: var(--bg-color-float, #f3f3f3);
  color: var(--text-color-primary, #333);
}

.bot-message-bubble--right {
  background-color: var(--bg-color-primary, #006eff);
  color: #fff;
}

.bot-error-message {
  padding: 12px;
  font-size: 14px;
  color: var(--text-color-error, #ff584c);
}
</style>
