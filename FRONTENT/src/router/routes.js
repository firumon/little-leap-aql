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
        component: () => import('pages/Masters/Warehouse/ManageStockPage.vue'),
        meta: { scope: 'operation', requiresAuth: true }
      },
      {
        path: '/operations/purchase-requisitions/initiate-purchase-requisitions',
        component: () => import('pages/Procurement/PRInitiationPage.vue'),
        meta: { scope: 'operation', requiresAuth: true }
      },
      {
        path: '/operations/purchase-requisitions/:code/draft',
        component: () => import('pages/Procurement/PRDraftViewPage.vue'),
        meta: { scope: 'operation', requiresAuth: true }
      },
      {
        path: '/operations/purchase-requisitions/:code/view',
        component: () => import('pages/Procurement/PRViewPage.vue'),
        meta: { scope: 'operation', requiresAuth: true }
      },
      {
        path: '/operations/:resourceSlug',
        component: () => import('pages/Operations/ResourcePageShell.vue'),
        props: true,
        children: [
          {
            path: '',
            name: 'operations-list',
            component: () => import('pages/Operations/ActionResolverPage.vue'),
            meta: { action: 'index', level: 'resource' }
          },
          {
            path: 'add',
            name: 'operations-add',
            component: () => import('pages/Operations/ActionResolverPage.vue'),
            meta: { action: 'add', level: 'resource' }
          },
          {
            path: ':code',
            name: 'operations-view',
            component: () => import('pages/Operations/ActionResolverPage.vue'),
            meta: { action: 'view', level: 'record' }
          },
          {
            path: ':code/edit',
            name: 'operations-edit',
            component: () => import('pages/Operations/ActionResolverPage.vue'),
            meta: { action: 'edit', level: 'record' }
          },
          {
            path: ':code/:action',
            name: 'operations-action',
            component: () => import('pages/Operations/ActionResolverPage.vue'),
            meta: { level: 'record' }
          }
        ]
      },
      {
        path: '/masters/:resourceSlug',
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
