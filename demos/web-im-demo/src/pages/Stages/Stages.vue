<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted } from 'vue';
import {
  IconLogout,
  IconArrowStrokeSelectDown,
  IconLanguage,
  useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useLoginState, Avatar } from 'tuikit-atomicx-vue3';
import { useRoute, useRouter } from 'vue-router';
import LogoImage from '@/assets/RTCubeLogo.png';

const { login, logout: _logout, loginUserInfo } = useLoginState();
const { t, setLanguage, language } = useUIKit();

const route = useRoute();
const router = useRouter();

const currentKey = computed<string>(() => (route.name as string) || 'chat');

const showUserMenu = ref(false);
const isSceneReady = ref(false);
const showLanguageSwitcher = ref(false);
const availableLanguages = [
  { code: 'zh-CN', name: '中文', nativeName: '中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

function closeUserMenu() {
  showUserMenu.value = false;
}

function handleClickOutside() {
  if (showUserMenu.value) {
    showUserMenu.value = false;
  }
  if (showLanguageSwitcher.value) {
    showLanguageSwitcher.value = false;
  }
}

function getCurrentLanguageName() {
  const lang = availableLanguages.find(l => l.code === language.value);
  return lang ? lang.nativeName : 'Unknown';
}

function logout() {
  closeUserMenu();
  _logout();
  isSceneReady.value = false;
  localStorage.removeItem('userInfo');
  router.replace({ name: 'Home' });
}

async function init() {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.expireAt && Date.now() > userInfo.expireAt) {
      localStorage.removeItem('userInfo');
      localStorage.removeItem('rtcube_login_form');
      router.replace({ name: 'Login', params: { sceneId: currentKey.value } });
      return;
    }
    if (userInfo.userID && !loginUserInfo.value?.userId) {
      const { SDKAppID, userID, userSig } = userInfo;
      await login({
        sdkAppId: SDKAppID,
        userId: userID,
        userSig,
        useUploadPlugin: true,
      });
    }
    // Not logged in, redirect to login page directly without calling logout()
    if (!userInfo.userID && !loginUserInfo.value?.userId) {
      router.replace({ name: 'Login', params: { sceneId: currentKey.value } });
      return;
    }
    isSceneReady.value = true;
  } catch (error) {
    // Login failed, clean up localStorage and redirect to login page
    console.error('Login failed:', error);
    localStorage.removeItem('userInfo');
    router.replace({ name: 'Login', params: { sceneId: currentKey.value } });
  }
}

onMounted(() => {
  init();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="stage-page">
    <header class="stage-header">
      <div class="stage-header__left">
        <img
          :src="LogoImage"
          alt="RTCube Logo"
          class="stage-header__logo"
          @click="router.replace('/')"
        >
        <span class="brand-text">OpenClaw Web Test</span>
        <span class="brand-badge">TEST</span>
      </div>
      <div class="stage-header__right">
        <div class="language-switcher" @click.stop>
          <button class="language-btn" @click="showLanguageSwitcher = !showLanguageSwitcher">
            <IconLanguage />
            <span>{{ getCurrentLanguageName() }}</span>
            <IconArrowStrokeSelectDown :class="{ 'dropdown-icon': true, active: showLanguageSwitcher }" />
          </button>

          <div
            v-if="showLanguageSwitcher"
            class="language-menu"
            @click.stop
          >
            <div class="language-menu-header">
              {{ t('language.switch') }}
            </div>
            <div
              v-for="lang in availableLanguages"
              :key="lang.code"
              class="language-menu-item"
              :class="{ active: lang.code === language }"
              @click="setLanguage(lang.code)"
            >
              <span class="language-name">{{ lang.nativeName }}</span>
              <span v-if="lang.code === language" class="current-indicator">{{ t('language.current') }}</span>
            </div>
          </div>
        </div>

        <div class="user-info-container" @click.stop>
          <div class="user-info" @click="toggleUserMenu">
            <Avatar
              :src="loginUserInfo?.avatarUrl"
              :alt="loginUserInfo?.userName || loginUserInfo?.userId"
            />
            <div class="user-details">
              <div class="user-name">
                {{ loginUserInfo?.userName || loginUserInfo?.userId || 'Unknown User' }}
              </div>
              <div class="user-id">
                userID: {{ loginUserInfo?.userId || 'N/A' }}
              </div>
            </div>
            <IconArrowStrokeSelectDown :class="{ 'dropdown-icon': true, active: showUserMenu }" />
          </div>

          <div
            v-if="showUserMenu"
            class="user-menu"
            @click.stop
          >
            <div class="user-menu-item logout" @click="logout()">
              <IconLogout />
              {{ t('logout') }}
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="stage-notice">
      腾讯云 IM TIMBot 插件支持全平台，本页面仅供 Web 测试，请勿用于正式环境。教程文档：<a href="https://cloud.tencent.com/document/product/269/128326" target="_blank">OpenClaw：微信小程序快速接入指南
      </a>
    </div>

    <div class="stage-main">
      <main class="stage-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.stage-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

.stage-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__logo {
    height: 32px;
    cursor: pointer;
  }

  .brand-text {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 1px;
  }

  .brand-badge {
    font-size: 11px;
    font-weight: 600;
    color: #f59e0b;
    background: #fef3c7;
    padding: 2px 8px;
    border-radius: 6px;
    letter-spacing: 0.5px;
  }

  &__right {
    display: flex;
    align-items: center;
    position: relative;
  }
}

.stage-notice {
  padding: 8px 24px;
  background: #fef3c7;
  color: #92400e;
  font-size: 13px;
  text-align: center;
  border-bottom: 1px solid #fde68a;
}

.stage-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.stage-content {
  flex: 1;
  display: flex;
  background: #ffffff;
  min-height: 0;
  position: relative;
  min-width: 0;

  .scene {
    flex: 1;
  }
}

.user-info-container {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.2;
    }

    .user-id {
      font-size: 12px;
      color: #64748b;
      line-height: 1.2;
    }
  }

  .dropdown-icon {
    color: #64748b;
    transition: transform 0.2s ease;

    &.active {
      transform: rotate(180deg);
    }
  }
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  min-width: 180px;
  z-index: 1000;
  overflow: hidden;

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-size: 14px;
    color: #374151;

    &:hover {
      background: #f9fafb;
    }

    &.logout {
      color: #dc2626;

      &:hover {
        background: #fef2f2;
      }
    }

    svg {
      flex-shrink: 0;
    }
  }
}

.language-switcher {
  position: relative;
  margin-right: 16px;

  .language-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    color: #374151;

    &:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .language-icon {
      font-size: 16px;
      line-height: 1;
    }

    .dropdown-icon {
      color: #64748b;
      transition: transform 0.2s ease;
      font-size: 12px;

      &.active {
        transform: rotate(180deg);
      }
    }
  }

  .language-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    min-width: 160px;
    z-index: 1000;
    overflow: hidden;

    .language-menu-header {
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .language-menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 14px;
      color: #374151;

      &:hover {
        background: #f9fafb;
      }

      &.active {
        background: #f0f9ff;
        color: #0369a1;

        .current-indicator {
          background: #0ea5e9;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
      }

      .language-name {
        font-weight: 500;
      }

      .current-indicator {
        font-size: 11px;
        color: #64748b;
      }
    }
  }
}
</style>
