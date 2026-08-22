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
      meta: { mainNav: true, section: 'home' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/features/projects/ProjectsView.vue'),
      meta: { mainNav: true, section: 'project' },
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
      meta: { mainNav: true, section: 'project' },
    },
    {
      path: '/project/:id',
      name: 'workspace',
      component: () => import('@/features/studio/ProjectWorkspaceView.vue'),
      props: true,
      meta: { mainNav: true, section: 'project' },
    },
    {
      path: '/project/:projectId/create',
      name: 'create-hub',
      component: () => import('@/features/create/CreateHubView.vue'),
      props: true,
      meta: { mainNav: true, section: 'create' },
    },
    {
      path: '/project/:projectId/assets',
      name: 'assets-hub',
      component: () => import('@/features/assets/AssetsHubView.vue'),
      props: true,
      meta: { mainNav: true, section: 'assets' },
    },
    {
      path: '/project/:projectId/code',
      name: 'code-hub',
      component: () => import('@/features/code/CodeHubView.vue'),
      props: true,
      meta: { mainNav: true, section: 'code' },
    },
    {
      path: '/project/:projectId/world',
      name: 'world-hub',
      component: () => import('@/features/world/WorldHubView.vue'),
      props: true,
      meta: { mainNav: true, section: 'world' },
    },
    {
      path: '/project/:projectId/create/models',
      alias: '/project/:projectId/models',
      name: 'models',
      component: () => import('@/features/model-studio/ModelsView.vue'),
      props: true,
      meta: { mainNav: true, section: 'create' },
    },
    {
      path: '/project/:projectId/models/:modelId',
      redirect: (route) => ({ name: 'models', params: { projectId: route.params.projectId } }),
    },
    {
      path: '/project/:projectId/models/:modelId/:pathMatch(.*)*',
      redirect: (route) => ({ name: 'models', params: { projectId: route.params.projectId } }),
    },
    {
      path: '/project/:projectId/assets/materials',
      alias: '/project/:projectId/materials',
      name: 'materials',
      component: () => import('@/features/texture-core/MaterialsView.vue'),
      props: true,
      meta: { mainNav: true, section: 'assets' },
    },
    {
      path: '/project/:projectId/textures',
      redirect: (route) => ({ name: 'materials', params: { projectId: route.params.projectId } }),
    },
    {
      path: '/project/:projectId/textures/:pathMatch(.*)*',
      redirect: (route) => ({ name: 'materials', params: { projectId: route.params.projectId } }),
    },
    {
      path: '/project/:projectId/create/blocks',
      name: 'blocks',
      component: () => import('@/features/blocks/BlocksView.vue'),
      props: (route) => ({ projectId: route.params.projectId, resourceType: 'block' }),
      meta: { mainNav: true, section: 'create' },
    },
    {
      path: '/project/:projectId/create/blocks/edit/:resourceId?',
      name: 'block-editor',
      component: () => import('@/features/blocks/BlockEditorView.vue'),
      props: (route) => ({ projectId: route.params.projectId, resourceId: route.params.resourceId, resourceType: 'block' }),
      meta: { mainNav: true, section: 'create' },
    },
    {
      path: '/project/:projectId/create/block-models',
      name: 'block-models',
      component: () => import('@/features/blocks/BlocksView.vue'),
      props: (route) => ({ projectId: route.params.projectId, resourceType: 'block_model' }),
      meta: { mainNav: true, section: 'create' },
    },
    {
      path: '/project/:projectId/create/block-models/edit/:resourceId?',
      name: 'block-model-editor',
      component: () => import('@/features/blocks/BlockEditorView.vue'),
      props: (route) => ({ projectId: route.params.projectId, resourceId: route.params.resourceId, resourceType: 'block_model' }),
      meta: { mainNav: true, section: 'create' },
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
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
