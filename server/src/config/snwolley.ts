import axios, { AxiosInstance } from 'axios';
import { env } from './environment';

// Centralised Snwolley AI clients.
// The React frontend must NEVER call Snwolley directly - every AI request
// flows through this backend. Keys are read from the environment and must
// never be logged or exposed to clients.
//
// Per the Npontu Hackathon 2026 API reference there are two API groups:
//   - Hackathon STT/TTS/Vision : base /api/v1/hackathon, header X-API-Key (team key)
//   - Agents API (chat)        : base /v1,                header X-API-Key (platform key)

// STT / TTS / Vision client (uses the per-team hackathon key).
export const hackathonClient: AxiosInstance = axios.create({
  baseURL: `${env.SNWOLLEY_BASE_URL}/api/v1/hackathon`,
  timeout: env.SNWOLLEY_TIMEOUT,
});

// Agents API client (uses the Snwolley platform key).
export const agentClient: AxiosInstance = axios.create({
  baseURL: `${env.SNWOLLEY_BASE_URL}/v1`,
  timeout: env.SNWOLLEY_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

export function hackathonAuthHeader(): Record<string, string> {
  return env.SNWOLLEY_HACKATHON_API_KEY
    ? { 'X-API-Key': env.SNWOLLEY_HACKATHON_API_KEY }
    : {};
}

export function agentAuthHeader(): Record<string, string> {
  return env.SNWOLLEY_AGENT_API_KEY
    ? { 'X-API-Key': env.SNWOLLEY_AGENT_API_KEY }
    : {};
}

export const snwolleyConfig = {
  baseUrl: env.SNWOLLEY_BASE_URL,
  agentId: env.SNWOLLEY_AGENT_ID,
  timeout: env.SNWOLLEY_TIMEOUT,
};
