export const messageLots = delivery => (Array.isArray(delivery.lotes) ? delivery.lotes : [])
  .map(lot => typeof lot === 'string' ? lot : lot?.lote).filter(Boolean).join(', ');

export function messageStatus(delivery) {
  const status = String(delivery.status || '').toLowerCase();
  if (['accepted', 'sent', 'completed'].includes(status)) return { key: 'sent', label: 'Enviado', className: 'bg-emerald-100 text-emerald-800' };
  if (['sending', 'processing', 'in_progress'].includes(status) || (status === 'pending' && Number(delivery.attempts) > 0)) return { key: 'sending', label: 'Enviando', className: 'bg-blue-100 text-blue-800' };
  if (['pending', 'scheduled', 'queued', 'enqueued'].includes(status)) return { key: 'queued', label: 'En cola', className: 'bg-amber-100 text-amber-800' };
  if (status === 'failed') return { key: 'failed', label: 'Fallido', className: 'bg-red-100 text-red-800' };
  return { key: status || 'unknown', label: status || '—', className: 'bg-slate-100 text-slate-700' };
}

export const messageTypeLabel = type => ({ collection: 'Cobro', reminder: 'Recordatorio', combined: 'Cobro y recordatorio', unknown: 'Sin identificar' }[type] || 'Sin identificar');
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const columnValue = (delivery, key) => ({
  date: delivery.runDate || '', client: delivery.nombre_cliente || '', project: delivery.displayProject || delivery.proyecto || '',
  lot: messageLots(delivery), type: messageTypeLabel(delivery.displayType),
  message: delivery.message || '', status: messageStatus(delivery).label,
})[key] || '';

export function filterAndSortMessages(deliveries, { search = '', status = '', project = '', source = '', sortKey = '', sortDirection = '' } = {}) {
  const query = normalized(search.trim());
  const filtered = deliveries.filter(delivery =>
    (!query || [delivery.nombre_cliente, delivery.codigo_cliente, messageLots(delivery)].some(value => normalized(value).includes(query))) &&
    (!status || messageStatus(delivery).key === status) &&
    (!project || (delivery.displayProject || delivery.proyecto) === project) &&
    (!source || delivery.tipo_cartera === source));
  if (sortKey && sortDirection) {
    const sign = sortDirection === 'desc' ? -1 : 1;
    filtered.sort((a, b) => sign * collator.compare(columnValue(a, sortKey), columnValue(b, sortKey)));
  }
  return filtered;
}
