const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const field = (source, keys, fallback = '') => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return fallback;
};

function validDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month } : null;
}

export function groupOverdueInstallments(installments) {
  if (!Array.isArray(installments)) return [];
  const groups = new Map();

  installments.forEach((installment, index) => {
    const dueDate = field(installment, ['fecha_compromiso', 'fecha_vencimiento']);
    const date = validDate(dueDate);
    const key = date ? `${date.year}-${String(date.month).padStart(2, '0')}` : `sin-fecha-${index}`;
    const balance = Number(field(installment, ['total_a_pagar', 'saldo', 'monto_pendiente'], 0)) || 0;
    const group = groups.get(key);

    if (group) {
      group.totalCents += Math.round(balance * 100);
      // Ante varias fechas del mismo mes se muestra la primera que vence.
      if (String(dueDate) < String(group.dueDate)) {
        group.dueDate = dueDate;
        group.age = field(installment, ['antiguedad'], '—');
      }
    } else {
      groups.set(key, {
        key,
        dueDate,
        age: field(installment, ['antiguedad'], '—'),
        concept: date ? `Cuota ${monthNames[date.month - 1]}` : field(installment, ['concepto', 'description'], '—'),
        totalCents: Math.round(balance * 100),
      });
    }
  });

  return [...groups.values()]
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .map((group, index) => ({
      ...group,
      number: index + 1,
      total: group.totalCents / 100,
    }));
}
