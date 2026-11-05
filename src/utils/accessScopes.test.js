import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAreaSelection, permittedSubareas, portfolioClientId, sapSourcesForScopes } from './accessScopes.js';

const scopes = [{ area_id: 7, subarea_ids: [14, 16] }, { area_id: 9, subarea_ids: null }];
const subareas = [{ id: 14, area_id: 7 }, { id: 15, area_id: 7 }, { id: 16, area_id: 7 }, { id: 20, area_id: 9 }];

test('permite cambiar entre áreas asignadas sin aceptar áreas ajenas', () => {
  assert.equal(resolveAreaSelection(scopes, 9, 7), 9);
  assert.equal(resolveAreaSelection(scopes, 100, 7), 7);
  assert.equal(resolveAreaSelection([], 100, 7), null);
});

test('subáreas restringidas nunca muestran sus hermanas ni el área completa', () => {
  assert.deepEqual(permittedSubareas(subareas, 7, scopes[0], false).map(item => item.id), [14, 16]);
  assert.deepEqual(permittedSubareas(subareas, 9, scopes[1], false).map(item => item.id), [20]);
  assert.deepEqual(permittedSubareas(subareas, 7, undefined, false), []);
  assert.deepEqual(permittedSubareas(subareas, 7, undefined, true).map(item => item.id), [14, 15, 16]);
});

test('clientes con el mismo código se seleccionan por empresa y fuente', () => {
  const lot = { codigo_cliente: 'CL-1', empresa: 'Empresa A', tipo_cartera: 'lotes' };
  assert.notEqual(portfolioClientId(lot), portfolioClientId({ ...lot, empresa: 'Empresa B' }));
  assert.notEqual(portfolioClientId(lot), portfolioClientId({ ...lot, tipo_cartera: 'edificios' }));
  assert.equal(portfolioClientId(lot), portfolioClientId({ ...lot }));
});

test('las carteras visibles siguen las áreas y subáreas asignadas', () => {
  const areas = [{ id: 7, sap_sources: ['edificios'] }];
  const configured = [
    { id: 14, area_id: 7, sap_sources: ['lotes'] },
    { id: 15, area_id: 7, sap_sources: ['edificios'] },
  ];
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: [14] }], areas, configured), ['lotes']);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: [15] }], areas, configured), ['edificios']);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: [14, 15] }], areas, configured), ['lotes', 'edificios']);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: null }], areas, configured), ['lotes', 'edificios']);
  assert.deepEqual(sapSourcesForScopes([], areas, configured), []);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: null, sap_sources: ['lotes'] }], areas, configured), ['lotes']);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: null, sap_sources: [] }], areas, configured), []);
  assert.deepEqual(sapSourcesForScopes([{ area_id: 7, subarea_ids: [14], sap_sources: ['edificios'] }], areas, configured), []);
});
