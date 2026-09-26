import React, { useState } from 'react';
import { LoginScreen } from '../screens/LoginScreen';
import { TrialSignupScreen } from './TrialSignupScreen';

export function WebAuthEntry() {
  const [trialMode, setTrialMode] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [notice, setNotice] = useState('');

  if (trialMode) {
    return (
      <TrialSignupScreen
        onCancel={() => setTrialMode(false)}
        onCreated={(email, trialEndsAt) => {
          setCreatedEmail(email);
          setNotice(trialEndsAt ? `Trial criado. Acesso liberado até ${new Date(trialEndsAt).toLocaleDateString('pt-BR')}. Entre com a conta criada.` : 'Trial criado. Entre com a conta criada.');
          setTrialMode(false);
        }}
      />
    );
  }

  return (
    <LoginScreen
      initialEmail={createdEmail}
      notice={notice}
      onStartTrial={() => setTrialMode(true)}
    />
  );
}
