import axios from 'axios';

export function normalizeApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseMessage = extractResponseMessage(error.response?.data);

    if (responseMessage) {
      return responseMessage;
    }

    if (!error.response) {
      return 'Backend is temporarily unavailable. Check the API connection and try again.';
    }

    if (error.response.status >= 500) {
      return 'Server error. Try again in a moment.';
    }
  }

  return fallback;
}

function extractResponseMessage(data: unknown) {
  if (typeof data === 'string') {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return '';
  }

  const payload = data as {
    message?: string | string[];
    error?: string;
  };

  if (Array.isArray(payload.message)) {
    return payload.message.join('. ');
  }

  return payload.message ?? payload.error ?? '';
}
