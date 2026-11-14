import type { InvoiceStatus } from '../../types/invoice';
import { Badge } from '../ui/Feedback';

const tones: Record<InvoiceStatus, 'success' | 'warning' | 'danger'> = {
  validated: 'success',
  pending: 'warning',
  rejected: 'danger',
};

const labels: Record<InvoiceStatus, string> = {
  validated: 'Validé',
  pending: 'À vérifier',
  rejected: 'Rejeté',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
