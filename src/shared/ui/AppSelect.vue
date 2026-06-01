<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{
  label: string;
  options: Array<{ label: string; value: string }>;
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
    <select
      v-model="model"
      class="form-field__input form-field__input--select"
      :aria-invalid="error ? 'true' : 'false'"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
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
