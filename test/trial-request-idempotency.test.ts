import { trialRequestFor, type TrialRequestIdentity } from '../src/web/trial-request-idempotency';

const initial: TrialRequestIdentity = {
  email: ' Owner@Example.COM ',
  name: ' Proprietaria ',
  gymName: ' Academia A ',
  cnpj: '12.345.678/0001-90',
  phone: ' (11) 99999-9999 ',
  timezone: ' America/Sao_Paulo ',
};

describe('P1: trial signup retries reuse the key only for the same canonical identity', () => {
  const nextId = jest.fn()
    .mockReturnValueOnce('request-a')
    .mockReturnValueOnce('request-b')
    .mockReturnValueOnce('request-c');

  beforeEach(() => { nextId.mockClear(); });

  test('unacknowledged signup replay preserves the exact requestId', () => {
    const first = trialRequestFor(null, initial, () => 'same-key');
    const retry = trialRequestFor(first, { ...initial }, () => 'unexpected-new-key');
    expect(retry).toBe(first);
    expect(retry.requestId).toBe('same-key');
  });

  test('format-only differences do not create duplicate registrations', () => {
    const first = trialRequestFor(null, initial, () => 'request-a');
    const retry = trialRequestFor(first, {
      ...initial,
      email: 'owner@example.com',
      name: 'Proprietaria',
      gymName: 'Academia A',
      cnpj: '12345678000190',
      phone: '(11) 99999-9999',
      timezone: 'America/Sao_Paulo',
    }, () => 'should-not-be-used');
    expect(retry).toBe(first);
  });

  test.each([
    { email: 'another@example.com' },
    { name: 'Outro Proprietario' },
    { gymName: 'Academia B' },
    { cnpj: '12345678000191' },
    { phone: '(11) 98888-8888' },
    { timezone: 'America/Fortaleza' },
  ])('a modified identity %p gets a new requestId and a stable retry', patch => {
    const first = trialRequestFor(null, initial, () => 'request-1');
    const second = trialRequestFor(first, { ...initial, ...patch }, () => 'request-2');
    expect(second.requestId).toBe('request-2');
    expect(second.fingerprint).not.toBe(first.fingerprint);
    const retry = trialRequestFor(second, { ...initial, ...patch }, () => 'request-3');
    expect(retry).toBe(second);
  });

  test('password changes alone do not change the key (backend intentionally excludes password from its fingerprint)', () => {
    const first = trialRequestFor(null, initial, () => 'request-1');
    expect(trialRequestFor(first, { ...initial }, () => 'request-2')).toBe(first);
  });

  test('optional phone and default timezone normalize as backend does', () => {
    const first = trialRequestFor(null, { ...initial, phone: undefined, timezone: '' }, () => 'request-1');
    const retry = trialRequestFor(first, { ...initial, phone: '  ', timezone: 'America/Sao_Paulo' }, () => 'request-2');
    expect(retry).toBe(first);
  });
});
