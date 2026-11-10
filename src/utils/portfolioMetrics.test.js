import test from 'node:test';
import assert from 'node:assert/strict';
import { sumPortfolioMetrics } from './portfolioMetrics.js';

const metrics = {
  lotes: { total_deudores: 3, clientes_al_dia: 2, deudores_por_antiguedad: { '1-30d': 1, '+120d': 2 } },
  edificios: { total_deudores: 1, clientes_al_dia: 5, deudores_por_antiguedad: { '31-60d': 1 } },
};
test('agrega únicamente las carteras seleccionadas y autorizadas', () => {
  assert.equal(sumPortfolioMetrics(metrics, 'todo', ['lotes', 'edificios']).debtors, 4);
  assert.equal(sumPortfolioMetrics(metrics, 'todo', ['lotes', 'edificios']).current, 7);
  assert.equal(sumPortfolioMetrics(metrics, 'edificios', ['lotes', 'edificios']).ages['31-60d'], 1);
  assert.equal(sumPortfolioMetrics(metrics, 'todo', ['lotes']).current, 2);
});
test('la ausencia de datos completos no se presenta como un conteo de cero', () => {
  assert.equal(sumPortfolioMetrics({}, 'todo', ['lotes']), null);
  assert.equal(sumPortfolioMetrics(metrics, 'edificios', ['lotes']), null);
});
