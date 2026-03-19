import { createApp } from 'vue'
import './styles/common/normalize.scss';
import './style.css'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia';
import './i18n';

createApp(App).use(router).use(createPinia()).mount('#app')
