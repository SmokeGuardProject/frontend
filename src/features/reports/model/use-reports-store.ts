import { ref } from 'vue';
import { defineStore } from 'pinia';
import { reportsApi } from '@/features/reports/api/reports.api';
import type { ReportPayload } from '@/features/reports/model/report.types';
import { normalizeApiError } from '@/shared/api/normalize-api-error';

export const useReportsStore = defineStore('reports', () => {
  const isGenerating = ref(false);
  const lastFilename = ref('');
  const successMessage = ref('');
  const errorMessage = ref('');

  async function generateReport(payload: ReportPayload) {
    isGenerating.value = true;
    successMessage.value = '';
    errorMessage.value = '';

    try {
      const { blob, contentDisposition } = await reportsApi.generateReport(payload);
      const filename = extractFilename(contentDisposition);

      downloadBlob(blob, filename);

      lastFilename.value = filename;
      successMessage.value = `Звіт ${filename} успішно згенеровано.`;
    } catch (error) {
      errorMessage.value = normalizeApiError(
        error,
        'Не вдалося згенерувати PDF-звіт. Перевірте фільтри та спробуйте ще раз.',
      );
      throw new Error(errorMessage.value);
    } finally {
      isGenerating.value = false;
    }
  }

  function clearMessages() {
    successMessage.value = '';
    errorMessage.value = '';
  }

  return {
    errorMessage,
    isGenerating,
    lastFilename,
    successMessage,
    clearMessages,
    generateReport,
  };
});

function extractFilename(contentDisposition?: string) {
  const match = contentDisposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? `smokeguard-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
