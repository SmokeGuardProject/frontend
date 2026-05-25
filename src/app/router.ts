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
    meta: { guestOnly: true, title: 'Login' },
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
    meta: { guestOnly: true, title: 'Register' },
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
        meta: { title: 'System Dashboard' },
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },
      {
        path: '/sensors',
        name: 'sensors',
        meta: { title: 'Sensors' },
        component: () => import('@/pages/sensors/SensorsPage.vue'),
      },
      {
        path: '/sensors/new',
        name: 'sensors-new',
        meta: { title: 'New Sensor' },
        component: () => import('@/pages/sensors/NewSensorPage.vue'),
      },
      {
        path: '/sensors/:id',
        name: 'sensor-details',
        meta: { title: 'Sensor Details' },
        component: () => import('@/pages/sensors/SensorDetailsPage.vue'),
      },
      {
        path: '/alarms',
        name: 'alarms',
        meta: { title: 'Alarms' },
        component: () => import('@/pages/alarms/AlarmsPage.vue'),
      },
      {
        path: '/alarms/new',
        name: 'alarms-new',
        meta: { title: 'New Alarm' },
        component: () => import('@/pages/alarms/NewAlarmPage.vue'),
      },
      {
        path: '/alarms/:id',
        name: 'alarm-details',
        meta: { title: 'Alarm Details' },
        component: () => import('@/pages/alarms/AlarmDetailsPage.vue'),
      },
      {
        path: '/events',
        name: 'events',
        meta: { title: 'Events' },
        component: () => import('@/pages/events/EventsPage.vue'),
      },
      {
        path: '/notifications',
        name: 'notifications',
        meta: { title: 'Notifications' },
        component: () => import('@/pages/notifications/NotificationsPage.vue'),
      },
      {
        path: '/reports',
        name: 'reports',
        meta: { title: 'Reports' },
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
