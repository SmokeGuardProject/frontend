import { apiClient } from '@/shared/api/client';
import type { ReportPayload } from '@/features/reports/model/report.types';

export const reportsApi = {
  async generateReport(payload: ReportPayload) {
    const response = await apiClient.post('/reports/generate', payload, {
      responseType: 'blob',
    });

    return {
      blob: response.data as Blob,
      contentDisposition: response.headers['content-disposition'] as string | undefined,
    };
  },
};
