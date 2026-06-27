// Re-exports the shared Snwolley clients and auth header helpers.
// Concrete AI services (phases 4-8) import from here.
export {
  hackathonClient,
  agentClient,
  snwolleyConfig,
  hackathonAuthHeader,
  agentAuthHeader,
} from '../../config/snwolley';
