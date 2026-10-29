import { createRouter, createWebHashHistory } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { useAdminSession } from '@/lib/admin-session'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: PublicLayout,
      children: [
        { path: '', redirect: '/booking' },
        {
          path: 'booking',
          name: 'booking',
          component: () => import('@/views/BookingView.vue'),
          meta: { title: '预约状态' },
        },
        {
          path: 'machines',
          name: 'machines',
          component: () => import('@/views/MachinesView.vue'),
          meta: { title: '机台状态' },
        },
      ],
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/AdminLoginView.vue'),
      meta: { title: '管理员登录' },
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/dashboard' },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/AdminDashboardView.vue'),
          meta: { title: '管理概览' },
        },
        {
          path: 'machines',
          name: 'admin-machines',
          component: () => import('@/views/admin/AdminMachinesView.vue'),
          meta: { title: '机台管理' },
        },
        {
          path: 'reservations',
          name: 'admin-reservations',
          component: () => import('@/views/admin/AdminReservationsView.vue'),
          meta: { title: '预约审批' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAdminSession()
  if (to.meta.requiresAdmin && !isAuthenticated.value) {
    return {
      path: '/admin/login',
      query: { redirect: to.fullPath },
    }
  }
  if (to.name === 'admin-login' && isAuthenticated.value) {
    return { path: '/admin/dashboard' }
  }
  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · a_Perfect 实验室机台预约` : 'a_Perfect · 实验室机台预约'
})

export default router
