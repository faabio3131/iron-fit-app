import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../src/auth-session', () => ({
  restoreSession: jest.fn(async () => null),
  saveSession: jest.fn(async () => undefined),
}));

jest.mock('../src/api', () => ({
  api: jest.fn(),
  logoutSession: jest.fn(async () => undefined),
  setSessionInvalidatedHandler: jest.fn(),
}));

// eslint-disable-next-line import/first
import App from '../App';

test('login renders the canonical Iron Fit brand', async () => {
  const view = render(<App />);
  await waitFor(() => {
    expect(view.getAllByText('Iron Fit').length).toBeGreaterThan(0);
  }, { timeout: 5000 });
});
