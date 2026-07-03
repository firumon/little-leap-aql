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
    path: '/master',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'bulk-upload', component: () => import('pages/master/BulkUploadPage.vue'), meta: { scope: 'master' } }
    ]
  },
  {
    path: '/:scope(operations|masters|accounts)/:resourceSlug',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('pages/_common/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'index',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: '_add',
            name: 'add',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':pageSlug',
            name: 'resource-page',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'resource-page', level: 'resource' }
          },
          {
            path: ':code/_view',
            name: 'view',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/_edit',
            name: 'edit',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/_action/:action',
            name: 'action',
            component: () => import('pages/PageResolver.vue'),
            meta: { action: 'action', level: 'record' }
          },
          {
            path: ':code/:pageSlug',
            name: 'record-page',
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

