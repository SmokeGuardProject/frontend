<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{
  label: string;
  options: Array<{ label: string; value: string }>;
}>();
</script>

<template>
  <label class="form-field">
    <span class="form-field__label">{{ label }}</span>
    <select
      v-model="model"
      class="form-field__input form-field__input--select"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
