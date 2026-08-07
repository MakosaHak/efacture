import type { InvoiceStatus } from '../../types/invoice';

const styles: Record<InvoiceStatus, string> = {
  validated: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
};

const labels: Record<InvoiceStatus, string> = {
  validated: 'Validée',
  pending: 'En attente',
  rejected: 'Rejetée',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
