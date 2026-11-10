export const DEBT_AGE_BUCKETS = ['1-30d', '31-60d', '61-90d', '91-120d', '+120d'];

export function sumPortfolioMetrics(bySource, source, allowedSources) {
  const sources = allowedSources.filter(item => source === 'todo' || item === source);
  if (!sources.length || sources.some(item => !bySource?.[item])) return null;
  return sources.reduce((total, item) => {
    const metrics = bySource[item];
    total.debtors += metrics.total_deudores;
    total.current += metrics.clientes_al_dia;
    total.withoutDelay += metrics.deudores_sin_atraso || 0;
    total.withoutDate += metrics.deudores_sin_fecha || 0;
    DEBT_AGE_BUCKETS.forEach(key => { total.ages[key] += metrics.deudores_por_antiguedad[key] || 0; });
    return total;
  }, { debtors: 0, current: 0, withoutDelay: 0, withoutDate: 0, ages: Object.fromEntries(DEBT_AGE_BUCKETS.map(key => [key, 0])) });
}
