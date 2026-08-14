import { createRouter, createWebHashHistory } from 'vue-router'

import { hasCompletedWelcome } from '@/core/storage/preferences'

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('@/features/home/WelcomeView.vue'),
      beforeEnter: () => (hasCompletedWelcome() ? { name: 'home' } : true),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/features/home/HomeView.vue'),
      meta: { mainNav: true },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/features/projects/ProjectsView.vue'),
      meta: { mainNav: true },
    },
    {
      path: '/projects/new',
      name: 'create-project',
      component: () => import('@/features/projects/CreateProjectView.vue'),
    },
    {
      path: '/projects/folder/:folderId',
      name: 'project-folder',
      component: () => import('@/features/projects/ProjectsView.vue'),
      props: true,
      meta: { mainNav: true },
    },
    {
      path: '/project/:id',
      name: 'workspace',
      component: () => import('@/features/studio/ProjectWorkspaceView.vue'),
      props: true,
    },
    {
      path: '/project/:projectId/models',
      name: 'models',
      component: () => import('@/features/model-studio/ModelsView.vue'),
      props: true,
    },
    {
      path: '/project/:projectId/models/:modelId',
      name: 'model-studio',
      component: () => import('@/features/model-studio/ModelStudioView.vue'),
      props: true,
    },
    {
      path: '/learn',
      name: 'learn',
      component: () => import('@/features/learn/LearnView.vue'),
      meta: { mainNav: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/features/settings/SettingsView.vue'),
      meta: { mainNav: true },
    },
    {
      path: '/settings/whats-new',
      name: 'whats-new',
      component: () => import('@/features/settings/WhatsNewView.vue'),
    },
    {
      path: '/settings/developer-beta',
      name: 'developer-beta',
      component: () => import('@/features/settings/DeveloperBetaView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
