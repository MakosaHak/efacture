/** Stub du module Vite PWA — uniquement pour les captures d'écran. */
export function useRegisterSW(_opts?: unknown) {
  return {
    needRefresh: [false, (_v?: boolean) => undefined] as [boolean, (v?: boolean) => void],
    offlineReady: [false, (_v?: boolean) => undefined] as [boolean, (v?: boolean) => void],
    updateServiceWorker: async (_reload?: boolean) => undefined,
  };
}
