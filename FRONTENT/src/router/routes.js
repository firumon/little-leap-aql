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
    path: '/settings',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'settings', component: () => import('pages/SettingsPage/SettingsPage.vue') }
    ]
  },
  {
    path: '/master',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'bulk-upload', component: () => import('../pages/Master/BulkUploadPage.vue'), meta: { scope: 'master' } }
    ]
  },
  {
    path: '/:scope(operation|master|accounts)/:resourceSlug',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    props: true,
    children: [
      {
        path: '',
        name: 'index',
        component: () => import('pages/Page.vue'),
        meta: { page: 'index', level: 'resource' }
      },
      {
        path: '_add',
        name: 'add',
        component: () => import('pages/Page.vue'),
        meta: { page: 'add', level: 'resource' }
      },
      {
        path: ':pageSlug',
        name: 'resource',
        component: () => import('pages/Page.vue'),
        meta: { page: 'resource', level: 'resource' }
      },
      {
        path: ':code/_view',
        name: 'view',
        component: () => import('pages/Page.vue'),
        meta: { page: 'view', level: 'record' }
      },
      {
        path: ':code/_edit',
        name: 'edit',
        component: () => import('pages/Page.vue'),
        meta: { page: 'edit', level: 'record' }
      },
      {
        path: ':code/_action/:action',
        name: 'action',
        component: () => import('pages/Page.vue'),
        meta: { page: 'action', level: 'record' }
      },
      {
        path: ':code/:pageSlug',
        name: 'record',
        component: () => import('pages/Page.vue'),
        meta: { page: 'record', level: 'record' }
      }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    redirect: '/dashboard'
  }
]

export default routes

