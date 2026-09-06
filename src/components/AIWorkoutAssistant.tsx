import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatWithWorkoutAssistant } from '../services/ai';

type Props = {
  visible: boolean;
  onClose: () => void;
  workoutCount: number;
  weeklyFrequency: number;
};

type Message = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  source?: 'ai' | 'fallback';
};

export function AIWorkoutAssistant({ visible, onClose, workoutCount, weeklyFrequency }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Posso complementar seu treino com explicações e sugestões gerais. A prescrição do seu instrutor continua sendo a referência principal.',
      source: 'fallback',
    },
  ]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: Message = { id: Date.now(), role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const reply = await chatWithWorkoutAssistant(text, { workoutCount, weeklyFrequency });
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: 'assistant', text: reply.message, source: reply.source },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.titleRow}><Ionicons name="sparkles" size={19} color="#a78bfa" /><Text style={styles.title}>Assistente de Treino</Text></View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar assistente"><Ionicons name="close" size={24} color="#cbd5e1" /></TouchableOpacity>
          </View>
          <Text style={styles.notice}>Orientação complementar. Não substitui avaliação ou prescrição profissional.</Text>
          <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
            {messages.map((message) => (
              <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.messageText}>{message.text}</Text>
                {message.role === 'assistant' && message.source === 'fallback' ? <Text style={styles.safeLabel}>MODO SEGURO</Text> : null}
              </View>
            ))}
            {sending ? <ActivityIndicator size="small" color="#a78bfa" style={styles.loading} /> : null}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Pergunte sobre seu treino..."
              placeholderTextColor="#64748b"
              style={styles.input}
              multiline
              maxLength={600}
            />
            <TouchableOpacity style={[styles.send, sending ? styles.sendDisabled : null]} onPress={sendMessage} disabled={sending} accessibilityLabel="Enviar pergunta">
              <Ionicons name="send" size={18} color="#f5f3ff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#020617cc', justifyContent: 'flex-end' },
  panel: { backgroundColor: '#0f1423', borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: '68%', maxHeight: '90%', padding: 18, borderWidth: 1, borderColor: '#312e81' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#f5f3ff', fontSize: 18, fontWeight: '800' },
  notice: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 12 },
  messages: { flex: 1 },
  messagesContent: { paddingVertical: 8, gap: 8 },
  bubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6d28d9' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#1e293b' },
  messageText: { color: '#f8fafc', fontSize: 13, lineHeight: 18 },
  safeLabel: { color: '#fbbf24', fontSize: 9, fontWeight: '800', marginTop: 5 },
  loading: { alignSelf: 'flex-start', margin: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: '#131826', color: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed' },
  sendDisabled: { opacity: 0.55 },
});
