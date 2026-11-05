import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isDemoMode } from '../../lib/demo/demo-mode';
import { flushOfflineQueue } from '../../lib/invoices';

/** Envoie la file IndexedDB dès que le réseau revient. */
export function OfflineSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || isDemoMode()) return;

    const run = () => {
      void flushOfflineQueue(user.id);
    };

    window.addEventListener('online', run);
    run();
    return () => window.removeEventListener('online', run);
  }, [user]);

  return null;
}
