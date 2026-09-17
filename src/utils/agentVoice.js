export const VOICE_PROVIDERS = {
  ELEVENLABS: 'elevenlabs',
  OPENAI_LIVE: 'openai_live',
};

/** Los agentes creados antes de este campo usaban ElevenLabs. */
export function normalizeVoiceProvider(provider) {
  return provider === VOICE_PROVIDERS.OPENAI_LIVE
    ? VOICE_PROVIDERS.OPENAI_LIVE
    : VOICE_PROVIDERS.ELEVENLABS;
}

export function voiceModelLabel(provider) {
  return normalizeVoiceProvider(provider) === VOICE_PROVIDERS.OPENAI_LIVE
    ? 'GPT-Live-1'
    : 'Administrado por el agente de ElevenLabs';
}

export function initialVoiceFields(agent = {}) {
  const voice_provider = normalizeVoiceProvider(agent.voice_provider);
  return {
    voice_provider,
    // Nunca reutilizar un agent_id legado cuando el proveedor es OpenAI Live.
    agent_id: voice_provider === VOICE_PROVIDERS.ELEVENLABS ? (agent.agent_id || '') : '',
    voice_model: voice_provider === VOICE_PROVIDERS.OPENAI_LIVE ? 'gpt-live-1' : null,
  };
}

/** Devuelve los errores de campos de la configuracion de voz. */
export function validateVoiceFields(form) {
  if (normalizeVoiceProvider(form.voice_provider) !== VOICE_PROVIDERS.ELEVENLABS) return {};
  const agentId = (form.agent_id || '').trim();
  if (!agentId) return { agent_id: 'El Agent ID de ElevenLabs es obligatorio.' };
  if (!agentId.startsWith('agent_')) {
    return { agent_id: 'El Agent ID de ElevenLabs debe comenzar con "agent_".' };
  }
  return {};
}

/** Construye exclusivamente los campos que define el contrato de voz del API. */
export function voicePayload(form) {
  const voice_provider = normalizeVoiceProvider(form.voice_provider);
  if (voice_provider === VOICE_PROVIDERS.OPENAI_LIVE) {
    return { voice_provider, voice_model: 'gpt-live-1', agent_id: null };
  }
  return { voice_provider, voice_model: null, agent_id: form.agent_id.trim() };
}

/** Convierte el detalle 422 de FastAPI en errores que pueden mostrarse por campo. */
export function fieldErrorsFromApi(detail) {
  if (!Array.isArray(detail)) return {};
  return detail.reduce((errors, item) => {
    const field = item?.loc?.[item.loc.length - 1];
    if (typeof field === 'string' && item?.msg) errors[field] = item.msg;
    return errors;
  }, {});
}
