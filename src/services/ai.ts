import { api } from './api';

export const AI_REQUEST_TIMEOUT_MS = 4500;

export type AIRecommendation = {
  title: string;
  detail: string;
};

export type AIProjection = {
  label: string;
  value: string;
  detail: string;
};

export type AIWorkoutInsight = {
  source: 'ai' | 'fallback';
  summary: string;
  recommendations: AIRecommendation[];
  projection: AIProjection;
};

export type AIProjectionResult = AIProjection & {
  source: 'ai' | 'fallback';
};

export type AIChatReply = {
  source: 'ai' | 'fallback';
  message: string;
};

export type AIContentRecommendation = {
  exerciseId: string;
  exerciseName: string;
  reason: string;
  contentKind: 'MANAGED_CONTENT' | 'EXTERNAL_REFERENCE';
  url: string;
};

export type AIContentRecommendationResult = {
  source: 'ai' | 'fallback';
  recommendations: AIContentRecommendation[];
  advisory: true;
  reason?: string;
};

const BLOCKED_KEY_PATTERN = /(password|senha|passcode|access.?token|refresh.?token|authorization|api.?key|secret|card.?number|credit.?card|debit.?card|cvv|cvc|bank.?account|pix.?key|billing|charge|financial)/i;

function redactString(value: string) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/((?:password|senha|token|api[-_ ]?key|cvv|cvc|pix(?:[-_ ]?key)?)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CARD]')
    .slice(0, 2000);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizeValue(nested, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

export function sanitizeAiPayload(input: unknown): unknown {
  return sanitizeValue(input);
}

export function getStaticWorkoutInsight(): AIWorkoutInsight {
  return {
    source: 'fallback',
    summary: 'Iron Intelligence está em modo seguro. Seu treino e suas métricas continuam disponíveis normalmente.',
    recommendations: [
      {
        title: 'Consistência primeiro',
        detail: 'Siga a frequência liberada pelo seu instrutor e registre sua evolução sem alterar o plano por conta própria.',
      },
      {
        title: 'Progressão responsável',
        detail: 'Use as cargas e intervalos prescritos. Ajustes devem respeitar sua execução e a orientação profissional.',
      },
    ],
    projection: {
      label: 'Projeção de evolução',
      value: 'Histórico local ativo',
      detail: 'Acompanhe avaliações e regularidade. A indisponibilidade da IA não interrompe seu histórico.',
    },
  };
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRecommendations(value: unknown): AIRecommendation[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).flatMap((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      return [{ title: `Recomendação ${index + 1}`, detail: item.trim() }];
    }
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const title = toText(record.title) ?? toText(record.label) ?? `Recomendação ${index + 1}`;
    const detail = toText(record.detail) ?? toText(record.description) ?? toText(record.text);
    return detail ? [{ title, detail }] : [];
  });
}

function normalizeInsight(payload: unknown): AIWorkoutInsight | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const fallback = getStaticWorkoutInsight();
  const summary = toText(record.summary) ?? toText(record.insight) ?? toText(record.message);
  const recommendations = normalizeRecommendations(record.recommendations);

  const projectionRecord = record.projection && typeof record.projection === 'object'
    ? record.projection as Record<string, unknown>
    : null;
  const projection: AIProjection = projectionRecord
    ? {
        label: toText(projectionRecord.label) ?? fallback.projection.label,
        value: toText(projectionRecord.value) ?? fallback.projection.value,
        detail: toText(projectionRecord.detail) ?? toText(projectionRecord.description) ?? fallback.projection.detail,
      }
    : fallback.projection;

  if (!summary && recommendations.length === 0 && !projectionRecord) return null;

  return {
    source: 'ai',
    summary: summary ?? fallback.summary,
    recommendations: recommendations.length > 0 ? recommendations : fallback.recommendations,
    projection,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IRON_AI_TIMEOUT')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requestAi(path: string, payload: unknown, timeoutMs: number) {
  const safePayload = sanitizeAiPayload(payload);
  return withTimeout(api(path, undefined, {
    method: 'POST',
    body: JSON.stringify(safePayload),
  }), timeoutMs);
}

async function loadInsight(kind: 'workout_insights' | 'evolution_projection', context: unknown, timeoutMs: number) {
  try {
    const payload = await requestAi('/me/ai/workout-insights', { kind, context }, timeoutMs);
    return normalizeInsight(payload) ?? getStaticWorkoutInsight();
  } catch {
    return getStaticWorkoutInsight();
  }
}

export async function getWorkoutInsights(context: unknown = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS): Promise<AIWorkoutInsight> {
  return loadInsight('workout_insights', context, timeoutMs);
}

export async function getEvolutionProjection(context: unknown = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS): Promise<AIProjectionResult> {
  const insight = await loadInsight('evolution_projection', context, timeoutMs);
  return { source: insight.source, ...insight.projection };
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeContentRecommendation(value: unknown): AIContentRecommendation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const exerciseId = toText(record.exerciseId);
  const exerciseName = toText(record.exerciseName);
  const reason = toText(record.reason);
  const content = record.content && typeof record.content === 'object' && !Array.isArray(record.content)
    ? record.content as Record<string, unknown>
    : null;
  const kind = toText(content?.kind);
  const delivery = content?.delivery && typeof content.delivery === 'object' && !Array.isArray(content.delivery)
    ? content.delivery as Record<string, unknown>
    : null;
  const url = kind === 'MANAGED_CONTENT'
    ? safeHttpsUrl(delivery?.url)
    : kind === 'EXTERNAL_REFERENCE'
      ? safeHttpsUrl(content?.url)
      : null;

  if (
    !exerciseId
    || !exerciseName
    || !reason
    || !url
    || (kind !== 'MANAGED_CONTENT' && kind !== 'EXTERNAL_REFERENCE')
  ) {
    return null;
  }

  return {
    exerciseId,
    exerciseName,
    reason,
    contentKind: kind,
    url,
  };
}

export async function getContentRecommendations(
  exerciseIds: string[],
  limit = 4,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<AIContentRecommendationResult> {
  const uniqueIds = [...new Set(exerciseIds.filter((value) => typeof value === 'string' && value.trim()))].slice(0, 20);
  if (uniqueIds.length === 0) {
    return { source: 'fallback', recommendations: [], advisory: true, reason: 'NO_EXERCISES' };
  }

  try {
    const payload = await requestAi('/me/ai/content-recommendations', {
      exerciseIds: uniqueIds,
      limit: Math.min(Math.max(Math.trunc(limit), 1), 10),
    }, timeoutMs);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('IRON_AI_CONTENT_INVALID');
    }
    const record = payload as Record<string, unknown>;
    const recommendations = Array.isArray(record.recommendations)
      ? record.recommendations
          .map(normalizeContentRecommendation)
          .filter((item): item is AIContentRecommendation => item !== null)
      : [];

    return {
      source: 'ai',
      recommendations,
      advisory: true,
      ...(toText(record.reason) ? { reason: toText(record.reason)! } : {}),
    };
  } catch {
    return {
      source: 'fallback',
      recommendations: [],
      advisory: true,
      reason: 'AI_CONTENT_UNAVAILABLE',
    };
  }
}

export async function chatWithWorkoutAssistant(message: string, context: unknown = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS): Promise<AIChatReply> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { source: 'fallback', message: 'Digite uma pergunta sobre seu treino para continuar.' };
  }

  try {
    const payload = await requestAi('/me/ai/chat', { message: trimmed, context }, timeoutMs);
    const reply = typeof payload === 'string'
      ? toText(payload)
      : payload && typeof payload === 'object'
        ? toText((payload as Record<string, unknown>).message)
          ?? toText((payload as Record<string, unknown>).reply)
          ?? toText((payload as Record<string, unknown>).answer)
        : null;

    if (reply) return { source: 'ai', message: reply };
  } catch {
    // Fail-open by design: the assistant must never block the training experience.
  }

  return {
    source: 'fallback',
    message: 'O assistente está temporariamente indisponível. Seu treino continua funcionando normalmente; siga a prescrição atual e tente novamente mais tarde.',
  };
}
