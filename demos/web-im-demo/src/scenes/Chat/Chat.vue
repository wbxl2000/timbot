<script lang="ts" setup>
import { computed, h, ref, watch } from 'vue';
import { TUICallKit } from '@tencentcloud/call-uikit-vue';
import {
  ConversationList,
  Chat,
  MessageList,
  MessageInput,
  ContactList,
  ContactInfo,
  ChatSetting,
  Search,
  VariantType,
  EmojiPicker,
  ImagePicker,
  FilePicker,
  VideoPicker,
  AudioCallPicker,
  VideoCallPicker,
  useUIKit,
  ChatHeader,
  useConversationListState,
  useGroupSettingState,
} from '@tencentcloud/chat-uikit-vue3';
import { IconMenu, IconHistory3, TUIDialog, TUIInput, TUIToast } from '@tencentcloud/uikit-base-component-vue3';
import { PlaceholderEmpty } from './components/PlaceholderEmpty';
import RobotConversationCreate from './components/RobotConversationCreate.vue';
import { SideTab } from './components/SideTab';
import CustomMessage from '../../components/StreamMessage/CustomMessage.vue';

const activeContact = ref();
const activeTab = ref<'conversation' | 'contact'>('conversation');
const isChatSettingShow = ref(false);
const isSearchInChatShow = ref(false);
const ConversationCreateComponent = RobotConversationCreate as any;

const { t, theme } = useUIKit();
const { activeConversation } = useConversationListState();
const { groupID, addGroupMember } = useGroupSettingState();

const isGroupChat = computed(() => Boolean(groupID.value));

const isInviteDialogVisible = ref(false);
const inviteUserIds = ref('');
const inviteLoading = ref(false);

const handleInviteMembers = async () => {
  const ids = inviteUserIds.value
    .split(/[,，\s]+/)
    .map(id => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    TUIToast.error({ message: '请输入至少一个用户 ID' });
    return;
  }
  inviteLoading.value = true;
  try {
    const result = await addGroupMember({ userIDList: ids });
    if (result.data.successUserIDList.length < ids.length) {
      TUIToast.warning({ message: `部分用户添加失败，成功 ${result.data.successUserIDList.length}/${ids.length}` });
    } else {
      TUIToast.success({ message: '邀请成功' });
    }
    isInviteDialogVisible.value = false;
    inviteUserIds.value = '';
  } catch (error: any) {
    TUIToast.error({ message: error?.message || '邀请失败' });
  } finally {
    inviteLoading.value = false;
  }
};

// Close sidebar when switching conversations
watch(() => activeConversation.value?.conversationID, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    isChatSettingShow.value = false;
    isSearchInChatShow.value = false;
  }
});

const handleTabChange = (tab: 'conversation' | 'contact') => {
  activeTab.value = tab;
};

const enterChat = () => {
  activeTab.value = 'conversation';
};

</script>

<template>
  <div class="chat-layout">
    <TUICallKit class="call-kit" />

    <!-- SideTab Navigation -->
    <SideTab
      :active-tab="activeTab"
      @change="handleTabChange"
    />

    <!-- Conversation/Contact List Panel -->
    <div class="conversation-list-panel">
      <ConversationList
        v-show="activeTab === 'conversation'"
        enable-create
        :ConversationCreate="ConversationCreateComponent"
      />
      <ContactList v-show="activeTab === 'contact'" />
    </div>

    <!-- Chat Content Panel -->
    <Chat
      v-if="activeTab === 'conversation'"
      :PlaceholderEmpty="() => h(
        PlaceholderEmpty,
        { type: 'chat' })
      "
      class="chat-content-panel"
    >
      <ChatHeader>
        <template #ChatHeaderRight>
          <button
            class="icon-button"
            :title="t('chat.Setting')"
            @click="isChatSettingShow = !isChatSettingShow"
          >
            <IconMenu size="20" />
          </button>
        </template>
      </ChatHeader>
      <MessageList :Message="CustomMessage" />
      <MessageInput class="message-input-container">
        <template #headerToolbar>
          <div class="message-toolbar">
            <div class="message-toolbar-actions">
              <EmojiPicker />
              <ImagePicker />
              <FilePicker />
              <VideoPicker />
              <AudioCallPicker />
              <VideoCallPicker />
            </div>
            <button
              class="icon-button"
              :title="t('chat.Search')"
              @click="isSearchInChatShow = !isSearchInChatShow"
            >
              <IconHistory3 size="20" />
            </button>
          </div>
        </template>
      </MessageInput>

      <!-- Chat Setting Sidebar -->
      <div
        v-show="isChatSettingShow"
        class="chat-sidebar"
        :class="{ dark: theme === 'dark' }"
      >
        <div class="chat-sidebar-header">
          <span class="chat-sidebar-title">{{ t('chat.Setting') }}</span>
          <button
            class="icon-button"
            @click="isChatSettingShow = false"
          >
            ✕
          </button>
        </div>
        <button
          v-if="isGroupChat"
          class="invite-member-button"
          @click="isInviteDialogVisible = true"
        >
          + 邀请成员（输入 ID）
        </button>
        <ChatSetting />
      </div>

      <TUIDialog
        appendTo="body"
        :visible="isInviteDialogVisible"
        title="邀请成员"
        confirm-text="邀请"
        cancel-text="取消"
        @confirm="handleInviteMembers"
        @cancel="isInviteDialogVisible = false; inviteUserIds = ''"
        @close="isInviteDialogVisible = false; inviteUserIds = ''"
      >
        <div class="invite-dialog-content">
          <p class="invite-dialog-hint">
            输入用户 ID，多个用逗号分隔，可添加非好友用户（如机器人）。
          </p>
          <TUIInput
            v-model="inviteUserIds"
            :disabled="inviteLoading"
            placeholder="例如 @RBT#001, user123"
            @keydown.enter.prevent="handleInviteMembers"
          />
          <p v-if="inviteLoading" class="invite-dialog-status">
            正在处理中，请稍候...
          </p>
        </div>
      </TUIDialog>

      <!-- Search in Chat Sidebar -->
      <div
        v-show="isSearchInChatShow"
        class="chat-sidebar"
        :class="{ dark: theme === 'dark' }"
      >
        <div class="chat-sidebar-header">
          <span class="chat-sidebar-title">{{ t('chat.Search') }}</span>
          <button
            class="icon-button"
            @click="isSearchInChatShow = false"
          >
            ✕
          </button>
        </div>
        <Search :variant="VariantType.EMBEDDED" />
      </div>
    </Chat>

    <!-- Contact Detail Panel -->
    <ContactInfo
      v-else
      :active-contact-item="activeContact"
      :PlaceholderEmpty="() => h(
        PlaceholderEmpty,
        { type: 'contact' })
      "
      class="contact-detail-panel"
      @send-message="enterChat"
      @enter-group="enterChat"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles/mixins' as mixins;

.chat-layout {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background-color: var(--bg-color-operate);
  color: var(--text-color-primary);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08), inset 0 -1px 0 rgba(255,255,255,0.05);
  border-radius: 24px;

  @include mixins.tablet {
    margin: 4vh 4vw;
  }

  @include mixins.xl-desktop {
    flex-direction: row;
    margin: 4vh 8vw;
  }
}

.conversation-list-panel {
  width: 300px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  border-right: 1px solid var(--stroke-color-primary);

  @include mixins.desktop {
    width: 350px;
  }
}

.chat-content-panel {
  flex: 1;
  position: relative;
}

.contact-detail-panel {
  flex: 1;
}

.message-input-container {
  border-top: 1px solid var(--stroke-color-primary);
}

.call-kit {
  position: fixed;
  width: 800px;
  height: 600px;
  top: 50%;
  left: 50%;
  z-index: 999;
  transform: translate(-50%, -50%);
}

.message-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.message-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-button {
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 20px;
  color: var(--text-color-primary);
  cursor: pointer;
  transition: background-color 0.2s;
  outline: none;

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: var(--button-color-secondary-hover);
  }

  &:active {
    background-color: var(--button-color-secondary-active);
  }
}

.chat-sidebar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  min-width: 300px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color-operate);
  box-shadow: var(--shadow-color) 0 0 10px;
  overflow: auto;
  z-index: 1000;

  &.dark {
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4), -1px 0 0 rgba(255, 255, 255, 0.1);
  }
}

.chat-sidebar-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-color-operate);
  border-bottom: 1px solid var(--stroke-color-primary);
  z-index: 10;
}

.chat-sidebar-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.invite-member-button {
  margin: 8px 16px;
  padding: 8px 12px;
  border: 1px dashed var(--stroke-color-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--text-color-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #2563eb;
    color: #2563eb;
    background-color: rgba(37, 99, 235, 0.04);
  }
}

.invite-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
}

.invite-dialog-hint {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.invite-dialog-status {
  margin: 0;
  font-size: 12px;
  color: var(--text-color-secondary);
}
</style>
