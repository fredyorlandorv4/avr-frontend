import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCallAnalysis } from './callAnalysis.js';

test('solo muestra análisis real, incluso en llamadas históricas', () => {
  assert.equal(hasCallAnalysis(null), false);
  assert.equal(hasCallAnalysis({}), false);
  assert.equal(hasCallAnalysis({ voicemail_detection: { detected: true } }), false);
  assert.equal(hasCallAnalysis({ summary: 'Resumen previo' }), true);
  assert.equal(hasCallAnalysis('{"title":"Histórico"}'), true);
  assert.equal(hasCallAnalysis('Texto de análisis anterior'), true);
  assert.equal(hasCallAnalysis('null'), false);
  assert.equal(hasCallAnalysis(''), false);
});
