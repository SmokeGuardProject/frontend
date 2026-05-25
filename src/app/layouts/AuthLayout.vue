<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__hero">
      <div class="auth-layout__brand">
        <span class="auth-layout__eyebrow">SmokeGuard</span>
        <h1>Центр моніторингу</h1>
      </div>
    </div>

    <main class="auth-layout__content">
      <RouterView />
    </main>
  </div>
</template>
