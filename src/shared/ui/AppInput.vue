<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{
  label: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
}>();
</script>

<template>
  <label
    class="form-field"
    :class="{ 'form-field--error': error }"
  >
    <span class="form-field__label">{{ label }}</span>
    <input
      v-model="model"
      class="form-field__input"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :aria-invalid="error ? 'true' : 'false'"
    >
    <span
      v-if="error"
      class="form-field__error"
    >
      {{ error }}
    </span>
    <span
      v-else-if="helperText"
      class="form-field__helper"
    >
      {{ helperText }}
    </span>
  </label>
</template>
