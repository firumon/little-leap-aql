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
        path: '/masters/:resourceSlug',
        component: () => import('pages/Masters/MasterIndexPage.vue'),
        meta: { scope: 'master' }
      }
    ]
  },

  {
    path: '/:catchAll(.*)*',
    redirect: '/dashboard'
  }
]

export default routes
