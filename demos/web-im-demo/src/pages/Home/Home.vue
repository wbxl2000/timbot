<script setup lang="ts">
import { useLoginState } from '@tencentcloud/chat-uikit-vue3';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useRouter } from 'vue-router';
import { getEnabledScenes } from '@/config';

const { loginUserInfo } = useLoginState();
const { t } = useUIKit();

const router = useRouter();

const products = getEnabledScenes();

function goStages(sceneId: string) {
  if (loginUserInfo.value?.userId) {
    router.push({ name: sceneId });
  } else {
    router.push({ name: 'Login', params: { sceneId } });
  }
}
</script>

<template>
  <div class="home">
    <header class="hero">
      <div class="brand">
        {{ t('home.brand') }}
      </div>
      <h1 class="headline">
        {{ t('home.headline') }}
      </h1>
      <p class="sub">
        {{ t('home.subtitle') }}
      </p>
    </header>

    <section class="grid">
      <article
        v-for="item in products"
        :key="item.key"
        class="card"
        :style="{ '--accent': item.accent }"
      >
        <div class="badge" />
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
        <button class="enter" @click="goStages(item.key)">
          {{ t('home.enterExperience') }}
        </button>
      </article>
    </section>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: radial-gradient(1200px 600px at 20% 0%, rgba(79,142,247,0.18), transparent),
              radial-gradient(900px 500px at 90% 10%, rgba(139,125,255,0.16), transparent),
              linear-gradient(180deg, #0f1222 0%, #0a0c18 100%);
  color: #e8ebff;
}
.hero {
  padding: 72px 24px 48px;
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
}
.headline { font-size: 44px; margin: 16px 0 8px; }
.sub { opacity: 0.8; }
.cta { margin-top: 24px; display: flex; gap: 12px; justify-content: center; }
.primary {
  padding: 10px 18px; border-radius: 12px; border: none; color: #091021; font-weight: 600;
  background: linear-gradient(135deg, #6aa6ff, #4F8EF7); cursor: pointer;
}
.ghost {
  padding: 10px 18px; border-radius: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.24);
  color: #e8ebff; cursor: pointer;
}
.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;
  padding: 24px; max-width: 1100px; margin: 0 auto 60px;
}
.card {
  position: relative; padding: 20px; border-radius: 16px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  transition: transform .25s ease, box-shadow .25s ease;
}
.card:hover { transform: translateY(-3px); box-shadow: 0 16px 42px rgba(0,0,0,0.35); }
.badge {
  position: absolute; right: 18px; top: 18px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent);
}
.enter {
  margin-top: 16px; padding: 8px 12px; border-radius: 10px; border: none; cursor: pointer;
  color: #0b1224; font-weight: 600; background: linear-gradient(135deg, var(--accent), #6ee7b7);
}
</style>
