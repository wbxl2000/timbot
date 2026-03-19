import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/Home/Home.vue'),
  },
  {
    path: '/login/:sceneId?',
    name: 'Login',
    component: () => import('../pages/Login/Login.vue'),
  },
  {
    path: '/stages',
    name: 'Stages',
    redirect: { name: 'chat' },
    component: () => import('../pages/Stages/Stages.vue'),
    children: [
      {
        path: '/stages/chat',
        name: 'chat',
        component: () => import('../scenes/Chat/Chat.vue'),
      },
    ]
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;


