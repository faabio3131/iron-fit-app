import React, { useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, glow, glowRest } from '../theme/colors';

/**
 * Bloco/card com o mesmo efeito do site: borda verde neon em repouso e
 * brilho verde neon pleno ao passar o mouse (web). Em touch (mobile), fica
 * só no estilo de repouso, já que não existe hover — o toque em si
 * é o feedback (onPressIn/onPressOut aplicam um aceno rápido).
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
  accessibilityRole,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityRole?: 'button' | 'link';
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered || pressed;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? accessibilityRole ?? 'button' : undefined}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
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
    borderColor: colors.accentEdge,
  },
  cardActive: {
    borderColor: colors.accent,
  },
});
