export function strongPassword(value: string): boolean {
  return value.length >= 12
    && value.length <= 128
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export const PASSWORD_POLICY_TEXT =
  'Use 12–128 caracteres com maiúscula, minúscula, número e símbolo.';
