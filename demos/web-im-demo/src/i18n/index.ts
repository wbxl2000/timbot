import { i18next } from '@tencentcloud/uikit-base-component-vue3';
import enUS from './en-US/index';
import zhCN from './zh-CN/index';

export const addI18n = (lng: string, resource: { translation: Record<string, string> }, deep = true, overwrite = false) => {
  i18next.addResourceBundle(lng, 'translation', resource.translation, deep, overwrite);
};

addI18n('en-US', enUS);
addI18n('zh-CN', zhCN);

export { enUS, zhCN };
