/**
 * Identidade visual oficial do Iron Fit: a mesma do site institucional
 * (fm-site-novo) — fundo preto/quase-preto com acento em verde neon.
 * Fonte única de cor para telas e componentes do app (mobile e web).
 *
 * Histórico: o produto usava roxo (#7c3aed/#8b5cf6) como acento legado.
 * A partir desta mudança, o acento oficial é o verde abaixo, igual ao
 * site. Não reintroduzir roxo como cor de destaque.
 */

export const colors = {
  // Fundos
  bg: '#0a0e1a',
  bgAlt: '#080c17',
  surface: '#131826',
  surfaceAlt: '#1a2035',
  surfaceRaised: '#0d1321',

  // Verde neon — acento oficial
  accent: '#2BF47A',
  accentPressed: '#2BF47A',
  accentSoft: 'rgba(43, 244, 122, 0.12)',
  accentSofter: 'rgba(43, 244, 122, 0.08)',
  accentBorder: 'rgba(43, 244, 122, 0.35)',
  accentGlow: 'rgba(43, 244, 122, 0.55)',
  // Texto/ícone sobre preenchimento sólido do verde (contraste AA)
  onAccent: '#04140b',
  onAccentMuted: 'rgba(4, 20, 11, 0.7)',

  // Texto
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',

  // Bordas neutras
  border: '#252d47',
  borderSoft: '#202a3e',

  // Estados
  danger: '#fca5a5',
  dangerBg: '#301215',
  warning: '#fbbf24',
  warningBg: '#261c08',
  success: '#4ade80',
  successBg: '#0b2a1e',
} as const;

/**
 * Sombra/brilho verde neon para estado de hover (web) — o mesmo efeito
 * de "acender" usado nos cards e no globo do site institucional.
 * Usar junto com um estado de hover (onHoverIn/onHoverOut) em
 * componentes Pressable; em mobile (sem mouse) o estilo de repouso
 * já aplica, sem o brilho extra.
 */
export const glow = {
  shadowColor: colors.accent,
  shadowOpacity: 0.55,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
} as const;

export const glowRest = {
  shadowColor: colors.accent,
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;
