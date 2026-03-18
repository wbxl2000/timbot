import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';

export interface SceneConfig {
  key: string;
  label: string;
  title: string;
  description: string;
  accent?: string;
  enabled: boolean;
  icon?: string;
  children?: SceneConfig[];
}

interface BaseSceneConfig {
  key: string;
  label: string;
  titleKey?: string;
  descriptionKey?: string;
  accent?: string;
  enabled: boolean;
  icon?: string;
  children?: BaseSceneConfig[];
}

// 基础场景配置（不包含翻译）
const BASE_SCENES: BaseSceneConfig[] = [
  {
    key: 'chat',
    label: 'Chat',
    titleKey: 'scenes.chat.title',
    descriptionKey: 'scenes.chat.description',
    accent: '#4F8EF7',
    enabled: true,
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
    children: [],
  },
];

const translateScene = (scene: BaseSceneConfig, t: any): SceneConfig => ({
  key: scene.key,
  label: scene.label,
  title: scene.titleKey ? t(scene.titleKey) : scene.label,
  description: scene.descriptionKey ? t(scene.descriptionKey) : '',
  accent: scene.accent,
  enabled: scene.enabled,
  icon: scene.icon,
  children: scene.children?.map((childrenScene: BaseSceneConfig) => translateScene(childrenScene, t)) || [],
});

export const getScenes = (): SceneConfig[] => {
  const { t } = useUIKit();
  return BASE_SCENES.map((scene: BaseSceneConfig) => translateScene(scene, t));
};

export const getEnabledScenes = (): SceneConfig[] => {
  return getScenes().filter(scene => scene.enabled);
};

export const getSceneByKey = (key: string): SceneConfig | undefined => {
  return getScenes().find((scene: SceneConfig) => scene.key === key);
};

export const getDefaultScene = (): SceneConfig => {
  return getEnabledScenes()[0] || getScenes()[0];
};

export const isSceneEnabled = (key: string): boolean => {
  const baseScene = BASE_SCENES.find(scene => scene.key === key);
  return baseScene ? baseScene.enabled : false;
};