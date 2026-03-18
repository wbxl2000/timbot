<template>
  <div class="side-tab" :class="{ dark: isDark }">
    <div class="avatar-wrapper">
      <Avatar class="avatar" :src="loginUserInfo?.avatarUrl" />
      <div class="tooltip">
        <div class="tooltip-name">{{ loginUserInfo?.userName }}</div>
        <div class="tooltip-id">ID: {{ loginUserInfo?.userId }}</div>
      </div>
    </div>
    <div class="tabs">
      <div
        class="tab-item"
        :class="{ active: props.activeTab === 'conversation' }"
        @click="handleTabChange('conversation')"
      >
        <IconChatNew size="24" />
      </div>
      <div
        class="tab-item"
        :class="{ active: props.activeTab === 'contact' }"
        @click="handleTabChange('contact')"
      >
        <IconContacts size="24" />
      </div>
    </div>
  </div>
</template>


<script lang="ts" setup>
import { computed } from 'vue';
import { useLoginState, useUIKit, Avatar } from '@tencentcloud/chat-uikit-vue3';
import { IconChatNew, IconContacts } from '@tencentcloud/uikit-base-component-vue3';

const { theme } = useUIKit();
const { loginUserInfo } = useLoginState();

const isDark = computed(() => theme.value === 'dark' || theme.value === 'serious');

interface Props {
  activeTab?: 'conversation' | 'contact';
}

const props = withDefaults(defineProps<Props>(), {
  activeTab: 'conversation'
});

const emit = defineEmits<{
  change: [tab: 'conversation' | 'contact'];
}>();

const handleTabChange = (tab: 'conversation' | 'contact') => {
  emit('change', tab);
};
</script>

<style scoped>
.side-tab {
  width: 72px;
  height: 100vh;
  background: var(--bg-color-function);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  transition: background 0.3s;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 24px;
  cursor: pointer;
}

.avatar-wrapper:hover:deep(.avatar) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tooltip {
  position: absolute;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.3s;
  z-index: 1000;
}

.tooltip::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: rgba(0, 0, 0, 0.85);
}

.avatar-wrapper:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.tooltip-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.tooltip-id {
  font-size: 12px;
  opacity: 0.8;
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tab-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  color: var(--text-color-primary);
}

.tab-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tab-item.active {
  background: var(--button-color-primary-default);
  color: var(--text-color-button);
}

.side-tab.dark {
  background: #1a1a1a;
}

.side-tab.dark .avatar-wrapper:hover:deep(.avatar) {
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.side-tab.dark .tooltip {
  background: rgba(255, 255, 255, 0.95);
  color: #1a1a1a;
}

.side-tab.dark .tooltip::before {
  border-right-color: rgba(255, 255, 255, 0.95);
}

.side-tab.dark .tab-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.side-tab.dark .tab-item.active {
  background: #1890ff;
  color: #fff;
}
</style>
