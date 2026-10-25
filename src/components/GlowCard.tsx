import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, glow, glowRest } from '../theme/colors';

/**
 * Tempo que o brilho do toque permanece aceso depois que o dedo solta
 * o card (touch, sem mouse). No site institucional isso acontece "de
 * graça" porque ele usa :hover puro em CSS, e navegadores mobile (Chrome
 * Android/iOS Safari) aplicam :hover num tap e só removem no próximo
 * toque em outro lugar da tela. Como aqui o brilho é controlado via
 * Pressable (onPressIn/onPressOut), sem esse comportamento "grudento"
 * do :hover, replicamos o efeito com um atraso para apagar — em vez de
 * sumir instantaneamente ao soltar o dedo.
 */
const TOUCH_LINGER_MS = 900;

/**
 * Bloco/card com o mesmo efeito do site: borda neutra em repouso e
 * brilho verde neon ao passar o mouse (web) ou tocar (mobile/touch).
 * Com mouse, acende/apaga junto com o hover. No toque, acende no toque
 * e permanece por um instante depois de soltar (TOUCH_LINGER_MS), pra
 * ficar perceptível em vez de sumir imediatamente.
 *
 * Uso: envolver qualquer bloco/card que hoje é só uma View estática.
 * Não deve carregar lógica de negócio — é puramente visual.
 */
export function GlowCard({
  children,
  style,
  onPress,
  disabled,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered || pressed;
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    };
  }, []);

  function handlePressIn() {
    if (lingerTimer.current) {
      clearTimeout(lingerTimer.current);
      lingerTimer.current = null;
    }
    setPressed(true);
  }

  function handlePressOut() {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    lingerTimer.current = setTimeout(() => setPressed(false), TOUCH_LINGER_MS);
  }

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        style,
        active ? styles.cardActive : null,
        active ? glow : glowRest,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: {
    borderColor: colors.accentBorder,
  },
});
