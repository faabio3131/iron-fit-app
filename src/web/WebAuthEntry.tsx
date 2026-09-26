import React, { useState } from 'react';
import { LoginScreen } from '../screens/LoginScreen';
import { PasswordRecoveryScreen } from '../screens/PasswordRecoveryScreen';
import { TrialSignupScreen } from './TrialSignupScreen';

type Mode = 'login' | 'trial' | 'recovery';

export function WebAuthEntry() {
  const [mode, setMode] = useState<Mode>('login');
  const [createdEmail, setCreatedEmail] = useState('');
  const [notice, setNotice] = useState('');

  if (mode === 'trial') {
    return (
      <TrialSignupScreen
        onCancel={() => setMode('login')}
        onCreated={(email, trialEndsAt) => {
          setCreatedEmail(email);
          setNotice(
            trialEndsAt
              ? `Trial criado. Acesso liberado até ${new Date(trialEndsAt).toLocaleDateString('pt-BR')}. Entre com a conta criada.`
              : 'Trial criado. Entre com a conta criada.',
          );
          setMode('login');
        }}
      />
    );
  }

  if (mode === 'recovery') {
    return <PasswordRecoveryScreen onBack={() => setMode('login')} />;
  }

  return (
    <LoginScreen
      initialEmail={createdEmail}
      notice={notice}
      onStartTrial={() => setMode('trial')}
      onForgotPassword={() => setMode('recovery')}
    />
  );
}
