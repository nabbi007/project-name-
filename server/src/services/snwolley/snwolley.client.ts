// Re-exports the shared Snwolley Axios client and auth header helpers.
// Concrete AI services (phases 4-8) import from here.
export {
  snwolleyClient,
  snwolleyConfig,
  getHackathonAuthHeader,
  getAgentAuthHeader,
} from '../../config/snwolley';
