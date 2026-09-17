import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_PROVIDERS,
  initialVoiceFields,
  validateVoiceFields,
  voicePayload,
} from './agentVoice.js';

test('un agente sin voice_provider conserva el comportamiento legado de ElevenLabs', () => {
  assert.deepEqual(initialVoiceFields({ agent_id: 'agent_legacy' }), {
    voice_provider: 'elevenlabs', agent_id: 'agent_legacy', voice_model: null,
  });
});

test('OpenAI Live ignora agent_id y fuerza GPT-Live-1 en el payload', () => {
  const form = { voice_provider: VOICE_PROVIDERS.OPENAI_LIVE, agent_id: 'agent_legacy' };
  assert.deepEqual(voicePayload(form), {
    voice_provider: 'openai_live', voice_model: 'gpt-live-1', agent_id: null,
  });
});

test('ElevenLabs exige un Agent ID con el prefijo agent_', () => {
  assert.ok(validateVoiceFields({ voice_provider: 'elevenlabs', agent_id: '' }).agent_id);
  assert.ok(validateVoiceFields({ voice_provider: 'elevenlabs', agent_id: 'wrong' }).agent_id);
  assert.deepEqual(validateVoiceFields({ voice_provider: 'elevenlabs', agent_id: 'agent_valid' }), {});
});
