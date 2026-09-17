export type VoiceProvider = 'elevenlabs' | 'openai_live';

export interface Agent {
  id: number;
  nombre: string;
  agent_id: string | null;
  voice_provider: VoiceProvider;
  voice_model: string | null;
  prompt: string;
  area_uuid: string;
  nota?: string | null;
  status: boolean;
}
