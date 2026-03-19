<template>
  <ChatHeader>
    <template #ChatHeaderRight>
      <div style="display: flex; align-items: center;">
        <IconHorizontalMore2
         :size="20"
          @click="setIsChatSettingOpen(true)" />
      </div>
    </template>
  </ChatHeader>
</template>

<script setup lang="ts">
import {
  ChatHeader,
} from '@tencentcloud/chat-uikit-vue3';
import { IconHorizontalMore2 } from '@tencentcloud/uikit-base-component-vue3';
import { useComponentOpenStore } from '../../stores';

const { setIsChatSettingOpen } = useComponentOpenStore();
</script>
