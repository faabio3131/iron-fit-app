import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

// eslint-disable-next-line import/first
import { LoginScreen } from '../src/screens/LoginScreen';

test('login renders the canonical Iron Fit brand', () => {
  const view = render(<LoginScreen />);
  expect(view.getAllByText('Iron Fit').length).toBeGreaterThan(0);
});

test('login password visibility control safely shows and hides the password', () => {
  const view = render(<LoginScreen />);

  expect(view.getByTestId('login-password').props.secureTextEntry).toBe(true);
  expect(view.getByTestId('login-password-toggle').props.accessibilityLabel).toBe('Mostrar senha');

  fireEvent.press(view.getByTestId('login-password-toggle'));
  expect(view.getByTestId('login-password').props.secureTextEntry).toBe(false);
  expect(view.getByTestId('login-password-toggle').props.accessibilityLabel).toBe('Ocultar senha');

  fireEvent.press(view.getByTestId('login-password-toggle'));
  expect(view.getByTestId('login-password').props.secureTextEntry).toBe(true);
});
