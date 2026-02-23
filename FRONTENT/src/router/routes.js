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
          if (process.env.DEV) {
            next({ name: 'login' })
          } else if (isStandalone()) {
            next({ name: 'login' })
          } else {
            next({ name: 'landing' })
          }
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
      { path: '', component: () => import('pages/Dashboard/DashboardIndex.vue') },
      { path: '/profile', component: () => import('pages/ProfilePage/ProfilePage.vue') },
      {
        path: '/transactions/shipments',
        component: () => import('pages/Transactions/ShipmentsPage.vue'),
        meta: { scope: 'transaction', resource: 'Shipments' }
      },
      {
        path: '/transactions/grn',
        component: () => import('pages/Transactions/GoodsReceiptsPage.vue'),
        meta: { scope: 'transaction', resource: 'GoodsReceipts' }
      },
      {
        path: '/masters/:resourceSlug',
        component: () => import('pages/Masters/MasterEntityPage.vue'),
        meta: { scope: 'master' }
      }
    ]
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound/ErrorNotFound.vue'),
    meta: { requiresAuth: true }
  }
]

export default routes
