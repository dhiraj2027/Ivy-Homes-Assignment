const DEFAULT_BASE_URL = 'https://solve.ivy.homes';

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export const BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_BASE_URL || DEFAULT_BASE_URL
);

export const API_KEY = String(import.meta.env.VITE_API_KEY || '').trim();

export function isConfigured() {
  return Boolean(API_KEY);
}

export function getApiKey() {
  return API_KEY;
}

export function getBaseUrl() {
  return BASE_URL;
}