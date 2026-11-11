import React, { useState } from 'react';
import { LoginScreen } from '../screens/LoginScreen';
import { PasswordRecoveryScreen } from '../screens/PasswordRecoveryScreen';
import { TrialSignupScreen } from './TrialSignupScreen';

type Mode = 'login' | 'trial' | 'recovery';

/**
 * The institutional site's "Teste grátis" CTA opens the existing canonical
 * signup screen directly. The query string only selects UI, never grants a
 * role, tenant, trial, or entitlement; those are created by the guarded API.
 */
export function initialTrialEntryMode(href?: string): Mode {
  if (!href) return 'login';
  try {
    return new URL(href).searchParams.get('iniciar-teste') === '1' ? 'trial' : 'login';
  } catch {
    return 'login';
  }
}

function currentTrialEntryMode(): Mode {
  // React Native/Jest may provide a window object without a location object.
  const runtime = globalThis as typeof globalThis & { location?: { href?: string } };
  return initialTrialEntryMode(runtime.location?.href);
}

export function WebAuthEntry() {
  const [mode, setMode] = useState<Mode>(currentTrialEntryMode);
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
              ? `Período gratuito iniciado. Acesso disponível até ${new Date(trialEndsAt).toLocaleDateString('pt-BR')}. Entre com a conta criada.`
              : 'Período gratuito iniciado. Entre com a conta criada.',
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
