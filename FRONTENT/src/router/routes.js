import { isStandalone } from 'src/utils/pwa-utils'

const routes = [
  {
    path: '/',
    component: () => import('layouts/AuthLayout/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        beforeEnter: (to, from) => {
          const isProdNonStandalone = !process.env.DEV && !isStandalone()
          if (isProdNonStandalone) {
            return { name: 'landing' }
          }

          const isAuthenticated = !!localStorage.getItem('token')
          return { name: isAuthenticated ? 'dashboard' : 'login' }
        }
      },
      {
        path: 'landing',
        name: 'landing',
        component: () => import('pages/AuthPage/LandingPage.vue')
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('pages/AuthPage/LoginPage.vue')
      },
      {
        path: 'select-tenant',
        name: 'select-tenant',
        component: () => import('pages/AuthPage/SelectTenantPage.vue')
      }
    ]
  },
  {
    path: '/dashboard',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('pages/Dashboard/DashboardIndex.vue') }
    ]
  },
  {
    path: '/profile',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'profile', component: () => import('pages/ProfilePage/ProfilePage.vue') }
    ]
  },
  {
    path: '/masters',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'bulk-upload', component: () => import('pages/Masters/BulkUploadPage.vue'), meta: { scope: 'master' } }
    ]
  },
  {
    path: '/:scope(operations)/:resourceSlug',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('pages/Operations/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'operations-list',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: '_add',
            name: 'operations-add',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':pageSlug',
            name: 'operations-resource-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'resource-page', level: 'resource' }
          },
          {
            path: ':code/_view',
            name: 'operations-view',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/_edit',
            name: 'operations-edit',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/_action/:action',
            name: 'operations-action',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'action', level: 'record' }
          },
          {
            path: ':code/:pageSlug',
            name: 'operations-record-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'record-page', level: 'record' }
          }
        ]
      }
    ]
  },
  {
    path: '/:scope(masters)/:resourceSlug',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('pages/Masters/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'resource-list',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: '_add',
            name: 'resource-add',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':pageSlug',
            name: 'resource-resource-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'resource-page', level: 'resource' }
          },
          {
            path: ':code/_view',
            name: 'resource-view',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/_edit',
            name: 'resource-edit',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/_action/:action',
            name: 'resource-action',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'action', level: 'record' }
          },
          {
            path: ':code/:pageSlug',
            name: 'resource-record-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'record-page', level: 'record' }
          }
        ]
      }
    ]
  },
  {
    path: '/:scope(accounts)/:resourceSlug',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('pages/Masters/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'accounts-list',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: '_add',
            name: 'accounts-add',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':pageSlug',
            name: 'accounts-resource-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'resource-page', level: 'resource' }
          },
          {
            path: ':code/_view',
            name: 'accounts-view',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/_edit',
            name: 'accounts-edit',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/_action/:action',
            name: 'accounts-action',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'action', level: 'record' }
          },
          {
            path: ':code/:pageSlug',
            name: 'accounts-record-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'record-page', level: 'record' }
          }
        ]
      }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    redirect: '/dashboard'
  }
]

export default routes
