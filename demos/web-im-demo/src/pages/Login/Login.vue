<template>
  <div class="login">
    <div class="login-container">
      <!-- Header -->
      <div class="header">
        <div class="brand">
          RTCube
        </div>
        <h1 class="title">
          {{ t('login') }}
        </h1>
        <p class="subtitle">
          {{ t('login.subtitle') }}
        </p>
      </div>

      <!-- Login Form -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="sdkAppID" class="label">SDK App ID</label>
          <input
            id="sdkAppID"
            v-model="formData.sdkAppID"
            type="number"
            class="input"
            :placeholder="t('login.sdkAppIdPlaceholder')"
            required
          >
        </div>

        <div class="form-group">
          <label for="userID" class="label">User ID</label>
          <input
            id="userID"
            v-model="formData.userID"
            type="text"
            class="input"
            :placeholder="t('login.userIdPlaceholder')"
            required
          >
        </div>

        <div class="form-group">
          <label for="secretKey" class="label">Secret Key</label>
          <input
            id="secretKey"
            v-model="formData.secretKey"
            type="password"
            class="input"
            :placeholder="t('login.secretKeyPlaceholder')"
            required
          >
        </div>

        <div class="agreement-group">
          <label class="checkbox-label">
            <input
              v-model="agreed"
              type="checkbox"
              class="checkbox"
              required
            >
            <span class="checkmark" />
            <span class="agreement-text">
              {{ t('login.agreeToTerms') }}
              <a
                :href="link.privacy.url"
                target="_blank"
                class="link"
              >{{ t('login.privacyPolicy') }}</a>
              {{ t('login.and') }}
              <a
                :href="link.agreement.url"
                target="_blank"
                class="link"
              >{{ t('login.userAgreement') }}</a>
            </span>
          </label>
        </div>
        <TUIButton
          :disabled="!agreed || isLoading"
          :class="{ loading: isLoading }"
          type="primary"
          size="large"
          block
          @click="handleLogin"
        >
          <span v-if="!isLoading">{{ t('login') }}</span>
          <span v-else class="loading-text">{{ t('login.loggingIn') }}</span>
        </TUIButton>
      </form>

      <!-- Back Button -->
      <TUIButton type="text" @click="goBack">
        👈 {{ t('login.backToHome') }}
      </TUIButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useLoginState } from '@tencentcloud/chat-uikit-vue3';
import { TUIButton, TUIToast, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useRoute, useRouter } from 'vue-router';
import { genTestUserSig } from '../../debug';

const { login } = useLoginState();
const { t } = useUIKit();
const route = useRoute();
const router = useRouter();

// 表单数据
const formData = ref({
  sdkAppID: '',
  userID: '',
  secretKey: '',
});

const agreed = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const showError = ref(false);

const link = {
  privacy: {
    url: 'https://web.sdk.qcloud.com/document/Tencent-IM-Privacy-Protection-Guidelines.html',
  },
  agreement: {
    url: 'https://web.sdk.qcloud.com/document/Tencent-IM-User-Agreement.html',
  },
};

const LOCAL_STORAGE_KEY = 'rtcube_login_form';

onMounted(() => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        sdkAppID?: string;
        userID?: string;
        secretKey?: string;
        expireAt?: number;
      };
      if (parsed.expireAt && Date.now() > parsed.expireAt) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }
      formData.value = {
        sdkAppID: parsed.sdkAppID ?? '',
        userID: parsed.userID ?? '',
        secretKey: parsed.secretKey ?? '',
      };
    }
  } catch (e) {
    console.error('Failed to restore login form from localStorage', e);
  }
});

// 显示错误信息
const showErrorMessage = (message: string) => {
  errorMessage.value = message;
  showError.value = true;
  setTimeout(() => {
    showError.value = false;
  }, 4000);
};

// 处理登录
const handleLogin = async () => {
  if (!agreed.value) {
    showErrorMessage(t('login.pleaseAgreeToTerms'));
    return;
  }

  if (!formData.value.sdkAppID || !formData.value.userID || !formData.value.secretKey) {
    showErrorMessage(t('login.pleaseCompleteInfo'));
    return;
  }

  isLoading.value = true;

  try {
    // 生成 userSig
    const userInfo = genTestUserSig({
      userID: formData.value.userID,
      SDKAppID: Number(formData.value.sdkAppID),
      secretKey: formData.value.secretKey,
    });

    // 持久化表单数据（7天过期）
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        sdkAppID: formData.value.sdkAppID,
        userID: formData.value.userID,
        secretKey: formData.value.secretKey,
        expireAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    );

    // 执行登录
    await login({
      sdkAppId: userInfo.SDKAppID,
      userId: userInfo.userID,
      userSig: userInfo.userSig,
      useUploadPlugin: true,
    });
    localStorage.setItem('userInfo', JSON.stringify({ ...userInfo, expireAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
    router.push({ name: route.params.sceneId as string });
  } catch (error) {
    TUIToast.error({
      message: t('login.loginFailed'),
    });
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

// 返回首页
const goBack = () => {
  router.push({ name: 'Home' });
};
</script>

<style scoped lang="scss">
@use "../../styles/mixins" as mixins;

.login {
  flex: 1;
  height: 100%;
  background: radial-gradient(1200px 600px at 20% 0%, rgba(79,142,247,0.18), transparent),
              radial-gradient(900px 500px at 90% 10%, rgba(139,125,255,0.16), transparent),
              linear-gradient(180deg, #0f1222 0%, #0a0c18 100%);
  color: #e8ebff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  @include mixins.mobile {
    padding: 16px;
  }
}

.login-container {
  width: 100%;
  max-width: 90vw;
  animation: slideUp 0.8s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;

  @include mixins.tablet {
    max-width: 60vw;
  }

  @include mixins.desktop {
    max-width: 440px;
  }
}

.header {
  text-align: center;
}

.brand {
  display: inline-block;
  font-weight: 700;
  letter-spacing: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 24px;
  animation: fadeIn 0.6s ease-out 0.2s both;
}

.title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #6aa6ff, #4F8EF7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: fadeIn 0.6s ease-out 0.4s both;
}

.subtitle {
  opacity: 0.8;
  margin: 0;
  animation: fadeIn 0.6s ease-out 0.6s both;
}

.login-form {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 40px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  animation: fadeIn 0.8s ease-out 0.8s both;
}

.form-group {
  margin-bottom: 24px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #a8b3cf;
  font-size: 14px;
}

.input {
  width: 100%;
  padding: 16px 20px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  color: #e8ebff;
  font-size: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;

  &::placeholder {
    color: rgba(168,179,207,0.6);
  }

  &:focus {
    outline: none;
    border-color: #4F8EF7;
    background: rgba(255,255,255,0.08);
    box-shadow: 0 0 0 3px rgba(79,142,247,0.15);
    transform: translateY(-1px);
  }
}

.agreement-group {
  margin-bottom: 32px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.5;
  color: #a8b3cf;
}

.checkbox {
  display: none;
}

.checkmark {
  min-width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  margin-right: 12px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255,255,255,0.05);

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 6px;
    height: 10px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: translate(-50%, -60%) rotate(45deg) scale(0);
    transition: transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
}

.checkbox:checked + .checkmark {
  background: linear-gradient(135deg, #6aa6ff, #4F8EF7);
  border-color: #4F8EF7;

  &::after {
    transform: translate(-50%, -60%) rotate(45deg) scale(1);
  }
}

.agreement-text {
  margin-top: 1px;
}

.link {
  color: #6aa6ff;
  text-decoration: none;
  transition: color 0.3s ease;

  &:hover {
    color: #4F8EF7;
    text-decoration: underline;
  }
}

.submit-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #6aa6ff, #4F8EF7);
  color: #091021;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(79,142,247,0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  &.loading {
    pointer-events: none;
  }
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(9,16,33,0.3);
  border-top: 2px solid #091021;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  background: none;
  border: none;
  color: #a8b3cf;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.3s ease;
  width: 100%;
  justify-content: center;

  &:hover {
    color: #e8ebff;
  }

  svg {
    transition: transform 0.3s ease;
  }

  &:hover svg {
    transform: translateX(-2px);
  }
}

// 动画定义
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.form-group {
  animation: fadeIn 0.6s ease-out calc(1s + var(--delay, 0) * 0.1s) both;
}

.form-group:nth-child(1) { --delay: 1; }
.form-group:nth-child(2) { --delay: 2; }
.form-group:nth-child(3) { --delay: 3; }

.agreement-group {
  animation: fadeIn 0.6s ease-out 1.4s both;
}

.submit-btn {
  animation: fadeIn 0.6s ease-out 1.6s both;
}

.back-btn {
  animation: fadeIn 0.6s ease-out 1.8s both;
}
</style>
