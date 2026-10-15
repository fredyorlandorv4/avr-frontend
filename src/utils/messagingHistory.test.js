import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatMessagingLots } from './messagingHistory.js';

test('el historial renderiza lotes de SAP como texto sin pasar objetos a React', () => {
  const lots = [
    { lote: 'Manzana A Lote 4', cantidad_cuotas: 2, total_pendiente: 5500 },
    { lote: 'Manzana A Lote 5', cantidad_cuotas: 2, total_pendiente: 9132.97 },
  ];
  assert.equal(renderToStaticMarkup(createElement('td', null, formatMessagingLots(lots))),
    '<td>Manzana A Lote 4, Manzana A Lote 5</td>');
});

test('admite nombres legados y lotes vacíos o incompletos', () => {
  assert.equal(formatMessagingLots(['Lote 1', 'Lote 2']), 'Lote 1, Lote 2');
  assert.equal(formatMessagingLots([null, {}, { lote: 'Lote 1' }]), 'Lote 1');
  assert.equal(formatMessagingLots(null), '—');
  assert.equal(formatMessagingLots([]), '—');
});
