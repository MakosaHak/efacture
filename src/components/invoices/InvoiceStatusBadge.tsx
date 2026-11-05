import type { InvoiceStatus } from '../../types/invoice';

const styles: Record<InvoiceStatus, string> = {
  validated: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
};

const labels: Record<InvoiceStatus, string> = {
  validated: 'Validée',
  pending: 'En attente',
  rejected: 'Rejetée',
};

export function InvoiceStatusBadge({
  status,
  queued = false,
}: {
  status: InvoiceStatus;
  queued?: boolean;
}) {
  if (queued) {
    return (
      <span className="inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
        À envoyer
      </span>
    );
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
