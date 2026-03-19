<script lang="ts" setup>
import {
  IconMessageSelected,
  IconMessage,
  IconContacts,
  IconContactsSelected,
  useUIKit,
} from '@tencentcloud/uikit-base-component-vue3';
import {
  useLoginState,
  Avatar,
} from 'tuikit-atomicx-vue3';

type TabKey = 'conversation' | 'contact';

defineProps<{
  activeTab: TabKey;
  labels?: Partial<Record<TabKey, string>>;
}>();

const emit = defineEmits(['update:activeTab', 'change']);

const { loginUserInfo } = useLoginState();
const { t } = useUIKit();

const onClick = (tab: TabKey) => {
  emit('update:activeTab', tab);
  emit('change', tab);
};
</script>

<template>
  <div
    class="tab-navigation"
    role="tablist"
    :aria-label="t('chat.viewSwitch')"
  >
    <Avatar
      shape="rounded"
      :src="loginUserInfo?.avatarUrl"
      :alt="loginUserInfo?.userName || loginUserInfo?.userId"
    />

    <div class="tab-buttons">
      <IconMessageSelected v-if="activeTab === 'conversation'" />
      <IconMessage v-else @click="onClick('conversation')" />
      <IconContactsSelected v-if="activeTab === 'contact'" size="24px" />
      <IconContacts
        v-else
        size="24px"
        style="color: #999;"
        @click="onClick('contact')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/mixins' as mixins;

.tab-navigation {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
  height: 100%;
  background: #F8FAFB;
  padding: 40px 0;
  gap: 24px;
}

.tab-buttons {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
