import { isStandalone } from 'src/utils/pwa-utils'

const routes = [
  {
    path: '/',
    component: () => import('layouts/AuthLayout/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        beforeEnter: (to, from, next) => {
          const isProdNonStandalone = !process.env.DEV && !isStandalone()
          if (isProdNonStandalone) {
            next({ name: 'landing' })
            return
          }

          const isAuthenticated = !!localStorage.getItem('token')
          next({ name: isAuthenticated ? 'dashboard' : 'login' })
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
      }
    ]
  },

  {
    path: '/dashboard',
    component: () => import('layouts/MainLayout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('pages/Dashboard/DashboardIndex.vue') },
      { path: '/profile', component: () => import('pages/ProfilePage/ProfilePage.vue') },
      {
        path: '/masters/bulk-upload',
        component: () => import('pages/Masters/BulkUploadPage.vue'),
        meta: { scope: 'master', requiresAuth: true }
      },
      {
        path: '/operations/stock-movements/direct-entry',
        component: () => import('pages/Warehouse/ManageStockPage.vue'),
        meta: { scope: 'operation', requiresAuth: true }
      },
      {
        path: '/:scope(masters|operations|accounts)/:resourceSlug',
        component: () => import('pages/Masters/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'resource-list',
            component: () => import('pages/Masters/ActionResolverPage.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: 'add',
            name: 'resource-add',
            component: () => import('pages/Masters/ActionResolverPage.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':code',
            name: 'resource-view',
            component: () => import('pages/Masters/ActionResolverPage.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/edit',
            name: 'resource-edit',
            component: () => import('pages/Masters/ActionResolverPage.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/:action',
            name: 'resource-action',
            component: () => import('pages/Masters/ActionResolverPage.vue'),
            meta: { level: 'record' }
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
