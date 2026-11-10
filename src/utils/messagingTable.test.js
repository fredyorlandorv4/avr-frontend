import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortMessages, messageStatus } from './messagingTable.js';

const messages = [
  { id: 1, nombre_cliente: 'Ángela', codigo_cliente: 'CL-10', proyecto: 'Zobel', tipo_cartera: 'edificios', lotes: [{ lote: 'Unidad 10' }], status: 'accepted' },
  { id: 2, nombre_cliente: 'Bruno', codigo_cliente: 'CL-2', proyecto: 'Alborada', tipo_cartera: 'lotes', lotes: ['Lote 2'], status: 'failed' },
];

test('filtra por cliente, código, lote, estado, proyecto y cartera', () => {
  for (const search of ['angela', 'CL-10', 'unidad 10']) assert.deepEqual(filterAndSortMessages(messages, { search }).map(x => x.id), [1]);
  assert.deepEqual(filterAndSortMessages(messages, { source: 'lotes', project: 'Alborada', status: 'failed' }).map(x => x.id), [2]);
  assert.deepEqual(filterAndSortMessages(messages, { source: 'edificios', status: 'failed' }), []);
});

test('reconoce los mensajes cancelados como estado independiente', () => {
  assert.equal(messageStatus({ status: 'cancelled' }).label, 'Cancelado');
  assert.deepEqual(filterAndSortMessages([{ id: 3, status: 'cancelled' }], { status: 'cancelled' }).map(item => item.id), [3]);
});

test('ordena alfanuméricamente sin alterar el orden original por defecto', () => {
  assert.deepEqual(filterAndSortMessages(messages, { sortKey: 'client', sortDirection: 'desc' }).map(x => x.id), [2, 1]);
  assert.deepEqual(filterAndSortMessages(messages, { sortKey: 'client', sortDirection: 'asc' }).map(x => x.id), [1, 2]);
  assert.deepEqual(filterAndSortMessages(messages).map(x => x.id), [1, 2]);
});
