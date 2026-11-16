/**
 * Presentation-only idempotency key lifecycle for the canonical /commercial/trial/start.
 *
 * Backend binds requestId to the normalized identity of the submitted trial.
 * Retrying identical details must preserve the key so a committed but unacknowledged
 * signup is replayed, whereas editing any identity detail must use a fresh key.
 *
 * Never keep a password in this identity or grant tenant/plan authority here.
 */
export interface TrialRequestIdentity {
  email: string;
  name: string;
  gymName: string;
  cnpj: string;
  timezone: string;
  phone?: string | null;
}

export interface TrialRequestState {
  fingerprint: string;
  requestId: string;
}

function fingerprint(input: TrialRequestIdentity): string {
  return JSON.stringify({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    gymName: input.gymName.trim(),
    cnpj: input.cnpj.trim().replace(/[.\/-]/g, '').toUpperCase(),
    timezone: input.timezone.trim() || 'America/Sao_Paulo',
  });
}

export function trialRequestFor(
  previous: TrialRequestState | null,
  input: TrialRequestIdentity,
  makeRequestId: () => string,
): TrialRequestState {
  const next = fingerprint(input);
  if (previous?.fingerprint === next) return previous;
  return { fingerprint: next, requestId: makeRequestId() };
}
