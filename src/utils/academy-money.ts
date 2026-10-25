/**
 * IRON academy finance: backend Charge/Subscription/FinancialTransaction amount
 * is the canonical integer number of cents (see FM fiscal amountMinor contract).
 * This does not apply to third-party/Command billing prices or token counts.
 */
export function brlFromMinor(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 'Valor não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

/** Parse a real-denominated field into exact centavos. Blank/invalid => null. */
export function brlToMinor(input: string): number | null {
  const trimmed = input.trim();
  // Brazilian decimal comma. Grouped thousands are allowed only as n.nnn.
  // "100.50" is ambiguous (a decimal vs a grouping) and is rejected.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(/\./g, '').split(',');
  const wholeNumber = Number(whole);
  const cents = wholeNumber * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function positiveBrlToMinor(input: string): number | null {
  const minor = brlToMinor(input);
  return minor !== null && minor > 0 ? minor : null;
}
