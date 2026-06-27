import axios, { AxiosInstance } from 'axios';
import { env } from './environment';

// Centralised Axios client for the Snwolley AI APIs.
// The React frontend must NEVER call Snwolley directly - every AI request
// flows through this backend. Keys are read from the environment and must
// never be logged or exposed to clients.
//
// This is a stub for the foundation phase: it is configured but not yet used.
// Speech-to-text, agent-chat, vision, and text-to-speech services (phases 4-8)
// will build on top of this client.

export const snwolleyClient: AxiosInstance = axios.create({
  baseURL: env.SNWOLLEY_BASE_URL,
  timeout: env.SNWOLLEY_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getHackathonAuthHeader(): Record<string, string> {
  return env.SNWOLLEY_HACKATHON_API_KEY
    ? { Authorization: `Bearer ${env.SNWOLLEY_HACKATHON_API_KEY}` }
    : {};
}

export function getAgentAuthHeader(): Record<string, string> {
  return env.SNWOLLEY_AGENT_API_KEY
    ? { Authorization: `Bearer ${env.SNWOLLEY_AGENT_API_KEY}` }
    : {};
}

export const snwolleyConfig = {
  baseUrl: env.SNWOLLEY_BASE_URL,
  agentId: env.SNWOLLEY_AGENT_ID,
  timeout: env.SNWOLLEY_TIMEOUT,
};
