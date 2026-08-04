export const FETCH_TIMEOUT_MS = 5000;

export function getAdanosBaseUrl(): string {
    return (process.env.ADANOS_API_BASE_URL || 'https://api.adanos.org').replace(/\/$/, '');
}

export function getAdanosApiKey(): string {
    return process.env.ADANOS_API_KEY ?? '';
}
