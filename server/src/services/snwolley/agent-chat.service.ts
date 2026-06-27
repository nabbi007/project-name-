import { AxiosError } from 'axios';
import { agentClient, agentAuthHeader } from '../../config/snwolley';
import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Snwolley Agents API adapter (Phase 5 / Phase 9).
//
// Contract (Npontu Hackathon 2026):
//   POST {base}/v1/chat/completions
//   Headers: X-API-Key: <platform key>
//   Body: { message, agent, stream: false, chat_id }
//   Success: { content: string, chat_id: string }
//   Error:   { error: string }
// ---------------------------------------------------------------------------

const CHAT_ENDPOINT = '/chat/completions';

export interface AgentResult {
  content: string;
  chatId: string | null;
  raw: unknown;
}

export async function chatWithAgent(
  message: string,
  chatId: string | null = null
): Promise<AgentResult> {
  if (!env.SNWOLLEY_AGENT_API_KEY || !env.SNWOLLEY_AGENT_ID) {
    throw new AppError(
      'Agents API is not configured. Complete the listing manually.',
      503,
      'AGENT_NOT_CONFIGURED'
    );
  }

  try {
    const response = await agentClient.post(
      CHAT_ENDPOINT,
      {
        message,
        agent: String(env.SNWOLLEY_AGENT_ID),
        stream: false,
        chat_id: chatId,
      },
      { headers: { ...agentAuthHeader() } }
    );

    const content =
      typeof response.data?.content === 'string' ? response.data.content : '';
    if (!content) {
      throw new AppError(
        'Agents API returned an empty response.',
        502,
        'AGENT_EMPTY_RESPONSE'
      );
    }

    const rawChatId = response.data?.chat_id;
    return {
      content,
      chatId: rawChatId != null ? String(rawChatId) : null,
      raw: response.data,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw mapAgentError(error);
  }
}

function mapAgentError(error: unknown): AppError {
  const axiosErr = error as AxiosError;

  if (axiosErr.code === 'ECONNABORTED') {
    return new AppError('Agents API request timed out.', 504, 'AGENT_TIMEOUT');
  }

  const status = axiosErr.response?.status;
  if (status === 400) {
    return new AppError('Agents API rejected the request.', 422, 'AGENT_BAD_REQUEST');
  }
  if (status === 401 || status === 403) {
    return new AppError('Agents API authentication failed.', 502, 'AGENT_AUTH_FAILED');
  }
  if (status === 429) {
    return new AppError(
      'Agents API rate limit reached. Please retry shortly.',
      502,
      'AGENT_RATE_LIMITED'
    );
  }
  if (status === 503) {
    return new AppError(
      'Agents API is not currently available.',
      503,
      'AGENT_DISABLED'
    );
  }

  return new AppError(
    'Agents API is unavailable. Complete the listing manually.',
    502,
    'AGENT_UNAVAILABLE'
  );
}
