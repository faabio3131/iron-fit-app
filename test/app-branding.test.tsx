import React from 'react';
import { render } from '@testing-library/react-native';

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
