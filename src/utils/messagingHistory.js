export function formatMessagingLots(value) {
  if (typeof value === 'string') return value || '—';
  if (!Array.isArray(value)) return '—';
  const names = value.map(lot => {
    if (typeof lot === 'string') return lot;
    const name = lot?.lote ?? lot?.name ?? lot?.lot;
    return typeof name === 'string' ? name : '';
  }).filter(Boolean);
  return names.length ? names.join(', ') : '—';
}
