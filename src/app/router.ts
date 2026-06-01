import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/features/auth/model/use-auth-store';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    component: () => import('@/app/layouts/AuthLayout.vue'),
    meta: { guestOnly: true, title: 'Вхід' },
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/app/layouts/AuthLayout.vue'),
    meta: { guestOnly: true, title: 'Реєстрація' },
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/pages/auth/RegisterPage.vue'),
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/app/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '/dashboard',
        name: 'dashboard',
        meta: { title: 'Дашборд' },
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },
      {
        path: '/sensors',
        name: 'sensors',
        meta: { title: 'Сенсори' },
        component: () => import('@/pages/sensors/SensorsPage.vue'),
      },
      {
        path: '/sensors/new',
        name: 'sensors-new',
        meta: { title: 'Новий сенсор' },
        component: () => import('@/pages/sensors/NewSensorPage.vue'),
      },
      {
        path: '/sensors/:id',
        name: 'sensor-details',
        meta: { title: 'Деталі сенсора' },
        component: () => import('@/pages/sensors/SensorDetailsPage.vue'),
      },
      {
        path: '/alarms',
        name: 'alarms',
        meta: { title: 'Сигналізації' },
        component: () => import('@/pages/alarms/AlarmsPage.vue'),
      },
      {
        path: '/alarms/new',
        name: 'alarms-new',
        meta: { title: 'Нова сигналізація' },
        component: () => import('@/pages/alarms/NewAlarmPage.vue'),
      },
      {
        path: '/alarms/:id',
        name: 'alarm-details',
        meta: { title: 'Деталі сигналізації' },
        component: () => import('@/pages/alarms/AlarmDetailsPage.vue'),
      },
      {
        path: '/events',
        name: 'events',
        meta: { title: 'Події' },
        component: () => import('@/pages/events/EventsPage.vue'),
      },
      {
        path: '/notifications',
        name: 'notifications',
        meta: { title: 'Сповіщення' },
        component: () => import('@/pages/notifications/NotificationsPage.vue'),
      },
      {
        path: '/reports',
        name: 'reports',
        meta: { title: 'Звіти' },
        component: () => import('@/pages/reports/ReportsPage.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.isInitialized && !authStore.isBootstrapping) {
    await authStore.bootstrap();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'dashboard' };
  }

  return true;
});
