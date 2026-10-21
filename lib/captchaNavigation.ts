/** Keep the challenge's navigation inside its exact trusted origins. Never bypass TLS errors. */
export function challengeNavigationAllowed(target: string, origin: string) {
  if (target === 'about:blank' || target === 'about:srcdoc') return true;
  try {
    const url = new URL(target);
    const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return ((url.protocol === 'https:' || local) && url.origin === origin) || url.origin === 'https://challenges.cloudflare.com';
  } catch { return false; }
}
export const CAPTCHA_LOAD_ERROR = 'Human verification could not be loaded. Check your connection and try again.';
export const CAPTCHA_CERTIFICATE_ERROR = 'This device cannot trust the verification certificate. Check automatic date and time, then update Android System WebView, Chrome and Android. Do not bypass the certificate warning.';
export function captchaLoadError(description: string, code: number) {
  return /ssl|certificate|cert_authority|cert_date|cert_invalid/i.test(description) || [-1200, -1202, -1203, -1204].includes(code)
    ? CAPTCHA_CERTIFICATE_ERROR : CAPTCHA_LOAD_ERROR;
}
