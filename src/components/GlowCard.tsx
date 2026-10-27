import React, { useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, glow, glowRest } from '../theme/colors';

/**
 * Bloco/card com o mesmo efeito do site: borda neutra em repouso e
 * brilho verde neon ao passar o mouse (web). Em touch (mobile), fica
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

  return (
    <Pressable accessibilityRole="button"
      testID={testID}
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
    borderColor: colors.border,
  },
  cardActive: {
    borderColor: colors.accentBorder,
  },
});
