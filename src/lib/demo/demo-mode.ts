const DEMO_KEY = 'e-facture-demo-local';

export const DEMO_USER_ID = 'demo-local-user';

export function isDemoMode(): boolean {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DEMO_KEY) === '1';
}

export function enableDemoMode(): void {
  sessionStorage.setItem(DEMO_KEY, '1');
}

export function disableDemoMode(): void {
  sessionStorage.removeItem(DEMO_KEY);
}
