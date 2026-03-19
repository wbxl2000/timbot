<script setup lang="ts">
import { computed } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';

interface Props {
  type?: 'chat' | 'contact';
  title?: string;
  description?: string;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'chat',
  title: '',
  description: '',
  icon: '',
});

const { t } = useUIKit();

const content = computed(() => {
  switch (props.type) {
    case 'chat':
      return {
        title: props.title || t('chat.noMessages'),
        description: props.description || t('chat.noMessagesDesc'),
        defaultIcon: 'chat',
      };
    case 'contact':
      return {
        title: props.title || t('chat.noContacts'),
        description: props.description || t('chat.noContactsDesc'),
        defaultIcon: 'contact',
      };
    default:
      return {
        title: props.title || t('chat.noContent'),
        description: props.description || t('chat.noContentDesc'),
        defaultIcon: 'chat',
      };
  }
});
</script>

<template>
  <div class="placeholder-empty">
    <div class="content">
      <div class="icon-wrapper">
        <template v-if="icon">
          {{ icon }}
        </template>
        <template v-else-if="content.defaultIcon === 'chat'">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="40"
              cy="40"
              r="40"
              fill="url(#chatGradient)"
              fill-opacity="0.1"
            />
            <path d="M25 35C25 29.4772 29.4772 25 35 25H55C60.5228 25 65 29.4772 65 35V45C65 50.5228 60.5228 55 55 55H45L35 65V55H35C29.4772 55 25 50.5228 25 45V35Z" fill="url(#chatGradient)" />
            <circle
              cx="35"
              cy="40"
              r="3"
              fill="white"
            />
            <circle
              cx="45"
              cy="40"
              r="3"
              fill="white"
            />
            <circle
              cx="55"
              cy="40"
              r="3"
              fill="white"
            />
            <defs>
              <linearGradient
                id="chatGradient"
                x1="25"
                y1="25"
                x2="65"
                y2="65"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#646cff" />
                <stop offset="1" stop-color="#4172ea" />
              </linearGradient>
            </defs>
          </svg>
        </template>
        <template v-else-if="content.defaultIcon === 'contact'">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="40"
              cy="40"
              r="40"
              fill="url(#contactGradient)"
              fill-opacity="0.1"
            />
            <circle
              cx="40"
              cy="32"
              r="8"
              fill="url(#contactGradient)"
            />
            <path d="M25 55C25 48.3726 30.3726 43 37 43H43C49.6274 43 55 48.3726 55 55V57H25V55Z" fill="url(#contactGradient)" />
            <defs>
              <linearGradient
                id="contactGradient"
                x1="25"
                y1="25"
                x2="55"
                y2="55"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#646cff" />
                <stop offset="1" stop-color="#4172ea" />
              </linearGradient>
            </defs>
          </svg>
        </template>
      </div>
      <h3 class="title">
        {{ content.title }}
      </h3>
      <p class="description">
        {{ content.description }}
      </p>
      <div class="decorative-elements">
        <div class="dot" />
        <div class="dot" />
        <div class="dot" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.placeholder-empty {
  height: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgba(100, 108, 255, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(65, 114, 234, 0.02) 0%, transparent 50%);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-10px) scale(1.02);
    opacity: 0.8;
  }
}

.content {
  text-align: center;
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.icon-wrapper {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;

  svg {
    filter: drop-shadow(0 4px 12px rgba(100, 108, 255, 0.15));
    animation: pulse 3s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes ripple {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary, #333);
  margin: 0 0 12px;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #333 0%, #666 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.description {
  font-size: 16px;
  color: var(--text-secondary, #666);
  margin: 0 0 32px;
  line-height: 1.6;
  opacity: 0.8;
}

.decorative-elements {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #646cff 0%, #4172ea 100%);
  animation: dotPulse 2s ease-in-out infinite;

  &:nth-child(1) {
    animation-delay: 0s;
  }

  &:nth-child(2) {
    animation-delay: 0.3s;
  }

  &:nth-child(3) {
    animation-delay: 0.6s;
  }
}

@keyframes dotPulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

:global([data-theme="dark"]) .title {
  background: linear-gradient(135deg, #e8ebff 0%, rgba(232, 235, 255, 0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

:global([data-theme="dark"]) .description {
  color: rgba(232, 235, 255, 0.7);
}

@media (max-width: 768px) {
  .placeholder-empty {
    min-height: 300px;
    padding: 32px 16px;
  }

  .title {
    font-size: 20px;
  }

  .description {
    font-size: 14px;
    margin-bottom: 24px;
  }

  .icon-wrapper svg {
    width: 64px;
    height: 64px;
  }
}

// 减少动画偏好
@media (prefers-reduced-motion: reduce) {
  .placeholder-empty::before,
  .icon-wrapper svg,
  .icon-wrapper::after,
  .dot {
    animation: none;
  }

  .content {
    animation: none;
  }
}
</style>
