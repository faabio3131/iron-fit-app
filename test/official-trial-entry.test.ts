import { initialTrialEntryMode } from '../src/web/WebAuthEntry';

describe('IRON public institutional CTA -> canonical signup', () => {
  test('opens the real existing trial registration on the official CTA URL', () => {
    expect(initialTrialEntryMode('https://app.ironfitcore.com.br/?iniciar-teste=1')).toBe('trial');
  });

  test('keeps ordinary login, malformed URLs and disabled params on login', () => {
    expect(initialTrialEntryMode('https://app.ironfitcore.com.br/')).toBe('login');
    expect(initialTrialEntryMode('https://app.ironfitcore.com.br/?iniciar-teste=0')).toBe('login');
    expect(initialTrialEntryMode('https://app.ironfitcore.com.br/?iniciar-teste=sim')).toBe('login');
    expect(initialTrialEntryMode('invalid-url')).toBe('login');
    expect(initialTrialEntryMode(undefined)).toBe('login');
  });

  test('a query string is only a UI selector; it cannot select another privilege or payment mode', () => {
    expect(initialTrialEntryMode('https://app.ironfitcore.com.br/?role=SUPER_ADMIN&paid=true')).toBe('login');
  });
});
