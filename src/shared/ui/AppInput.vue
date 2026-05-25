<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{
  label: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  required?: boolean;
}>();
</script>

<template>
  <label class="form-field">
    <span class="form-field__label">{{ label }}</span>
    <input
      v-model="model"
      class="form-field__input"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
    >
  </label>
</template>
