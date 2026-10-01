import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function RequestErrorState({
  title = 'Não foi possível atualizar',
  message = 'Sem conexão ou serviço indisponível. Verifique sua internet e tente novamente.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.card} testID="mobile-request-error">
      <View style={styles.icon}>
        <Ionicons name="cloud-offline-outline" size={24} color="#67d6ff" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        testID="mobile-request-retry"
        style={styles.button}
        onPress={onRetry}
      >
        <Text style={styles.buttonText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#071528',
    borderWidth: 1,
    borderColor: '#203b55',
    borderRadius: 16,
    padding: 18,
    marginVertical: 10,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#071a31',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { color: '#eef7ff', fontSize: 15, fontWeight: '800' },
  message: {
    color: '#9fb0c5',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#176bc1',
    borderWidth: 1,
    borderColor: '#2f91ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  buttonText: { color: '#eef7ff', fontSize: 11, fontWeight: '800' },
});
