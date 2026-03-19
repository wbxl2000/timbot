<script setup lang="ts">
import { computed, ref, type PropType } from 'vue';
import { useContactListState, useConversationListState } from '@tencentcloud/chat-uikit-vue3';
import { useLoginState } from 'tuikit-atomicx-vue3';
import {
  IconIconC2c,
  IconSearchMore,
  IconStartGroup,
  TUIDialog,
  TUIDropdown,
  TUIInput,
  TUIOption,
  TUISelect,
  TUIToast,
  useUIKit,
} from '@tencentcloud/uikit-base-component-vue3';

type CreateMode = 'c2c' | 'group' | 'robot' | null;
interface FriendItem {
  userID: string;
  nick?: string;
  remark?: string;
}
interface ConversationItem {
  conversationID: string;
}
interface CreateGroupOptions {
  name: string;
  type: string;
  memberList: Array<{ userID: string }>;
}
type BeforeCreatePayload = string | CreateGroupOptions;

const GROUP_NAME_LIMIT = 20;
const NON_BLOCKING_ADD_FRIEND_PATTERNS = [
  /already.+friend/i,
  /friend.+already/i,
  /already added/i,
  /application.+sent/i,
  /sent.+application/i,
  /already.+apply/i,
  /duplicate.+apply/i,
  /已经.*好友/,
  /已是好友/,
  /已经.*申请/,
  /重复.*申请/,
  /已发.*申请/,
];

const props = defineProps({
  conversationList: {
    type: Array as PropType<ConversationItem[]>,
    default: () => [],
  },
  onBeforeCreateConversation: {
    type: Function as PropType<(payload: BeforeCreatePayload) => BeforeCreatePayload>,
    default: undefined,
  },
  onConversationCreated: {
    type: Function as PropType<(conversation: ConversationItem) => void>,
    default: undefined,
  },
});

const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'before-create': [payload: BeforeCreatePayload];
  created: [conversation: ConversationItem];
}>();

const { t } = useUIKit();
const { loginUserInfo } = useLoginState();
const { friendList, addFriend } = useContactListState();
const {
  conversationList,
  createC2CConversation,
  createGroupConversation,
  setActiveConversation,
} = useConversationListState();

const activeMode = ref<CreateMode>(null);
const loading = ref(false);
const friendKeyword = ref('');
const selectedC2CUserId = ref('');
const selectedGroupMemberIds = ref<string[]>([]);
const groupName = ref('');
const robotId = ref('');

const isDialogVisible = computed(() => activeMode.value !== null);

const filteredFriends = computed(() => {
  const keyword = friendKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return friendList.value;
  }
  return friendList.value.filter(friend => {
    const label = getFriendLabel(friend).toLowerCase();
    return label.includes(keyword) || friend.userID.toLowerCase().includes(keyword);
  });
});

const dialogTitle = computed(() => {
  switch (activeMode.value) {
    case 'c2c':
      return t('TUIConversation.Start C2C Chat');
    case 'group':
      return t('TUIConversation.Start Group Chat');
    case 'robot':
      return '机器人会话';
    default:
      return '';
  }
});

const dialogConfirmText = computed(() => {
  switch (activeMode.value) {
    case 'robot':
      return '添加并开聊';
    case 'group':
      return t('TUIConversation.Start chat');
    default:
      return t('TUIConversation.Start chat');
  }
});

const currentConversationList = computed(() => conversationList.value || props.conversationList || []);

const openDialog = (mode: Exclude<CreateMode, null>) => {
  activeMode.value = mode;
  emit('update:visible', true);
};

const resetState = () => {
  activeMode.value = null;
  loading.value = false;
  friendKeyword.value = '';
  selectedC2CUserId.value = '';
  selectedGroupMemberIds.value = [];
  groupName.value = '';
  robotId.value = '';
  emit('update:visible', false);
};

const getFriendLabel = (friend: FriendItem) => friend.remark || friend.nick || friend.userID;

const generateGroupName = () => {
  const pickedFriends = friendList.value.filter(friend => selectedGroupMemberIds.value.includes(friend.userID));
  const pickedLabels = pickedFriends.map(getFriendLabel).filter(Boolean);
  const selfName = loginUserInfo.value?.userName || loginUserInfo.value?.userId || '';
  const name = [selfName, ...pickedLabels].filter(Boolean).join('、') || '群聊';
  return name.length > GROUP_NAME_LIMIT ? name.slice(0, GROUP_NAME_LIMIT) : name;
};

const notifyCreated = (conversation?: ConversationItem) => {
  if (!conversation) {
    return;
  }
  emit('created', conversation);
  props.onConversationCreated?.(conversation);
};

const runBeforeCreate = <T extends BeforeCreatePayload>(payload: T) => {
  emit('before-create', payload);
  const next = props.onBeforeCreateConversation?.(payload);
  return (next ?? payload) as T;
};

const resolveConversation = (conversationID: string) =>
  currentConversationList.value.find(item => item.conversationID === conversationID);

const openExistingConversation = (conversationID: string) => {
  setActiveConversation(conversationID);
  const existingConversation = resolveConversation(conversationID);
  notifyCreated(existingConversation);
  return existingConversation;
};

const openC2CConversation = async (userID: string) => {
  const normalizedUserID = userID.trim();
  const nextUserID = runBeforeCreate(normalizedUserID);
  try {
    const conversation = await createC2CConversation(nextUserID);
    setActiveConversation(conversation.conversationID);
    notifyCreated(conversation);
    return conversation;
  } catch (error) {
    return openExistingConversation(`C2C${nextUserID}`) || Promise.reject(error);
  }
};

const isSelfUser = (value: string) => value === loginUserInfo.value?.userId;

const canContinueAfterAddFriendError = (targetUserID: string, errorMessage: string) => {
  if (friendList.value.some(friend => friend.userID === targetUserID)) {
    return true;
  }
  return NON_BLOCKING_ADD_FRIEND_PATTERNS.some(pattern => pattern.test(errorMessage));
};

const handleCreateSingleConversation = async () => {
  if (!selectedC2CUserId.value) {
    TUIToast.error({ message: '请选择一个好友' });
    return;
  }

  loading.value = true;
  try {
    await openC2CConversation(selectedC2CUserId.value);
    resetState();
  } catch (error: any) {
    TUIToast.error({ message: error?.message || '发起单聊失败' });
  } finally {
    loading.value = false;
  }
};

const handleCreateGroupConversation = async () => {
  if (selectedGroupMemberIds.value.length === 0) {
    TUIToast.error({ message: '请选择至少一个群成员' });
    return;
  }

  const options = runBeforeCreate({
    name: groupName.value.trim() || generateGroupName(),
    type: 'Private',
    joinOption: 'DisableApply',
    memberList: selectedGroupMemberIds.value.map(userID => ({ userID })),
  });

  loading.value = true;
  try {
    const conversation = await createGroupConversation(options);
    setActiveConversation(conversation.conversationID);
    notifyCreated(conversation);
    resetState();
  } catch (error: any) {
    TUIToast.error({ message: error?.message || '创建群聊失败' });
  } finally {
    loading.value = false;
  }
};

const handleCreateRobotConversation = async () => {
  const normalizedRobotId = robotId.value.trim();
  if (!normalizedRobotId) {
    TUIToast.error({ message: '请输入机器人 ID' });
    return;
  }
  if (isSelfUser(normalizedRobotId)) {
    TUIToast.error({ message: '不能添加自己' });
    return;
  }

  loading.value = true;
  try {
    try {
      await addFriend({
        userID: normalizedRobotId,
        addSource: 'AddSource_Type_Web',
      });
    } catch (error: any) {
      const errorMessage = error?.message || '';
      if (!canContinueAfterAddFriendError(normalizedRobotId, errorMessage)) {
        throw error;
      }
    }

    await openC2CConversation(normalizedRobotId);
    resetState();
  } catch (error: any) {
    TUIToast.error({ message: error?.message || '创建机器人会话失败' });
  } finally {
    loading.value = false;
  }
};

const handleConfirm = async () => {
  if (loading.value) {
    return;
  }

  if (activeMode.value === 'c2c') {
    await handleCreateSingleConversation();
    return;
  }

  if (activeMode.value === 'group') {
    await handleCreateGroupConversation();
    return;
  }

  if (activeMode.value === 'robot') {
    await handleCreateRobotConversation();
  }
};
</script>

<template>
  <div class="robot-conversation-create">
    <TUIDropdown trigger="click" placement="bottom-end">
      <IconSearchMore
        class="robot-conversation-create__button"
        size="24px"
      />
      <template #dropdown>
        <div class="robot-conversation-create__dropdown">
          <button
            class="robot-conversation-create__action"
            type="button"
            @click="openDialog('c2c')"
          >
            <IconIconC2c />
            <span>{{ t('TUIConversation.Start C2C Chat') }}</span>
          </button>
          <button
            class="robot-conversation-create__action"
            type="button"
            @click="openDialog('group')"
          >
            <IconStartGroup />
            <span>{{ t('TUIConversation.Start Group Chat') }}</span>
          </button>
          <button
            class="robot-conversation-create__action"
            type="button"
            @click="openDialog('robot')"
          >
            <span class="robot-conversation-create__ai-badge">AI</span>
            <span>机器人会话</span>
          </button>
        </div>
      </template>
    </TUIDropdown>

    <TUIDialog
      appendTo="body"
      :visible="isDialogVisible"
      :title="dialogTitle"
      :confirm-text="dialogConfirmText"
      :cancel-text="t('TUIConversation.Cancel')"
      @confirm="handleConfirm"
      @cancel="resetState"
      @close="resetState"
    >
      <div class="robot-conversation-create__dialog">
        <template v-if="activeMode === 'robot'">
          <p class="robot-conversation-create__hint">
            输入机器人 ID，系统会先发起好友申请，再自动打开会话。
          </p>
          <TUIInput
            v-model="robotId"
            auto-focus
            :disabled="loading"
            placeholder="请输入机器人 ID，例如 @RBT#001"
            @keydown.enter.prevent="handleConfirm"
          />
        </template>

        <template v-else-if="activeMode === 'c2c'">
          <p class="robot-conversation-create__hint">
            从现有好友中选择一个联系人开始单聊。
          </p>
          <TUIInput
            v-model="friendKeyword"
            :disabled="loading"
            placeholder="搜索好友昵称或 ID"
          />
          <TUISelect
            v-model="selectedC2CUserId"
            class="robot-conversation-create__select"
            :disabled="loading"
            placeholder="请选择好友"
          >
            <TUIOption
              v-for="friend in filteredFriends"
              :key="friend.userID"
              :label="`${getFriendLabel(friend)} (${friend.userID})`"
              :value="friend.userID"
            />
          </TUISelect>
        </template>

        <template v-else-if="activeMode === 'group'">
          <p class="robot-conversation-create__hint">
            选择群成员并填写群名称，默认创建工作群。
          </p>
          <TUIInput
            v-model="groupName"
            :disabled="loading"
            :max-length="GROUP_NAME_LIMIT"
            placeholder="群名称，留空时自动生成"
          />
          <TUIInput
            v-model="friendKeyword"
            :disabled="loading"
            placeholder="搜索群成员昵称或 ID"
          />
          <TUISelect
            v-model="selectedGroupMemberIds"
            class="robot-conversation-create__select"
            :disabled="loading"
            multiple
            placeholder="请选择群成员"
          >
            <TUIOption
              v-for="friend in filteredFriends"
              :key="friend.userID"
              :label="`${getFriendLabel(friend)} (${friend.userID})`"
              :value="friend.userID"
            />
          </TUISelect>
        </template>

        <p
          v-if="loading"
          class="robot-conversation-create__status"
        >
          正在处理中，请稍候...
        </p>
      </div>
    </TUIDialog>
  </div>
</template>

<style scoped lang="scss">
.robot-conversation-create {
  display: flex;
  align-items: center;
}

.robot-conversation-create__button {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-right: 10px;
}

.robot-conversation-create__dropdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
}

.robot-conversation-create__action {
  width: 100%;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-color-primary);
  cursor: pointer;
  text-align: left;
  font-size: 14px;
}

.robot-conversation-create__ai-badge {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.robot-conversation-create__dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
}

.robot-conversation-create__hint {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.robot-conversation-create__select {
  width: 100%;
}

.robot-conversation-create__status {
  margin: 0;
  font-size: 12px;
  color: var(--text-color-secondary);
}
</style>
