import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FinancialScreen } from '../src/screens/FinancialScreen';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('O19 mobile plan payments', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('formats charge minor units and opens only a real HTTPS payment link', async () => {
    mockApi.mockResolvedValue([
      {
        id: 'charge-a',
        amount: 26900,
        status: 'PENDING',
        dueDate: '2026-10-05T12:00:00.000Z',
        paymentLink: 'https://pay.example.com/session-a',
      },
    ]);

    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const view = render(<FinancialScreen />);

    await waitFor(() => expect(view.getByText(/269,00/)).toBeTruthy());
    fireEvent.press(view.getByTestId('student-charge-payment-charge-a'));

    expect(openUrl).toHaveBeenCalledWith('https://pay.example.com/session-a');
    openUrl.mockRestore();
  });

  test('does not render a payment action for a non-HTTPS value', async () => {
    mockApi.mockResolvedValue([
      {
        id: 'charge-b',
        amount: 10000,
        status: 'PENDING',
        dueDate: '2026-10-05T12:00:00.000Z',
        paymentLink: 'invalid-payment-target',
      },
    ]);

    const view = render(<FinancialScreen />);

    await waitFor(() => expect(view.getByText(/100,00/)).toBeTruthy());
    expect(view.queryByTestId('student-charge-payment-charge-b')).toBeNull();
  });
});
