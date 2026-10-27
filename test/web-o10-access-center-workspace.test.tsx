import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessCenterWorkspace } from '../src/web/AccessCenterWorkspace';

const students = [
  { id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } },
];

const credentials = [
  {
    id: 'credential-1',
    studentId: 'student-1',
    type: 'QR_CODE',
    active: true,
    status: 'ACTIVE',
    expiresAt: null,
    student: { id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } },
  },
];

const devices = [
  {
    id: 'device-1',
    name: 'Catraca principal',
    type: 'QR_CODE',
    active: true,
    protocol: 'HTTPS',
    lastSyncAt: '2026-09-30T12:00:00.000Z',
    tokenRotatedAt: '2026-09-29T12:00:00.000Z',
  },
];

const events = [
  {
    id: 'event-allowed',
    studentId: 'student-1',
    deviceId: 'device-1',
    allowed: true,
    denialReason: null,
    occurredAt: '2026-09-30T12:05:00.000Z',
    student: { id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } },
    device: { id: 'device-1', name: 'Catraca principal', type: 'QR_CODE', active: true },
  },
  {
    id: 'event-denied',
    studentId: 'student-1',
    deviceId: 'device-1',
    allowed: false,
    denialReason: 'Credencial expirada',
    occurredAt: '2026-09-30T11:55:00.000Z',
    student: { id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } },
    device: { id: 'device-1', name: 'Catraca principal', type: 'QR_CODE', active: true },
  },
];

describe('O10 AccessCenterWorkspace', () => {
  test('issues a one-time credential and revokes an active credential', async () => {
    const onCreateCredential = jest.fn().mockResolvedValue({
      credentialId: 'credential-new',
      qrToken: 'one-time-qr-secret',
      type: 'QR_CODE',
      active: true,
    });
    const onRevokeCredential = jest.fn().mockResolvedValue(undefined);

    const view = render(
      <AccessCenterWorkspace
        students={students}
        credentials={credentials}
        events={events}
        devices={devices}
        saving={false}
        canManageDevices
        onCreateCredential={onCreateCredential}
        onRevokeCredential={onRevokeCredential}
        onRotateDeviceToken={jest.fn()}
      />,
    );

    fireEvent.press(view.getByTestId('access-student-student-1'));
    fireEvent.press(view.getByTestId('access-credential-create'));

    await waitFor(() => expect(onCreateCredential).toHaveBeenCalledWith({
      studentId: 'student-1',
      type: 'QR_CODE',
    }));
    await waitFor(() => expect(view.getByTestId('access-credential-one-time')).toBeTruthy());
    expect(view.getByText('one-time-qr-secret')).toBeTruthy();

    fireEvent.press(view.getByTestId('access-credential-revoke-credential-1'));
    await waitFor(() => expect(onRevokeCredential).toHaveBeenCalledWith('credential-1'));
  });

  test('shows allowed/denied timeline and rotates device token only in governed device surface', async () => {
    const onRotateDeviceToken = jest.fn().mockResolvedValue({
      deviceId: 'device-1',
      deviceToken: 'one-time-device-secret',
    });

    const view = render(
      <AccessCenterWorkspace
        students={students}
        credentials={credentials}
        events={events}
        devices={devices}
        saving={false}
        canManageDevices
        onCreateCredential={jest.fn()}
        onRevokeCredential={jest.fn()}
        onRotateDeviceToken={onRotateDeviceToken}
      />,
    );

    expect(view.getByText('Credencial expirada')).toBeTruthy();
    expect(view.getAllByText('Permitido').length).toBeGreaterThan(0);
    expect(view.getAllByText('Negado').length).toBeGreaterThan(0);

    fireEvent.press(view.getByTestId('access-device-rotate-device-1'));
    await waitFor(() => expect(onRotateDeviceToken).toHaveBeenCalledWith('device-1'));
    await waitFor(() => expect(view.getByTestId('access-device-token-one-time')).toBeTruthy());
    expect(view.getByText('one-time-device-secret')).toBeTruthy();
  });

  test('hides device administration from reception-level surface', () => {
    const view = render(
      <AccessCenterWorkspace
        students={students}
        credentials={credentials}
        events={events}
        devices={[]}
        saving={false}
        canManageDevices={false}
        onCreateCredential={jest.fn()}
        onRevokeCredential={jest.fn()}
        onRotateDeviceToken={jest.fn()}
      />,
    );

    expect(view.queryByText('Dispositivos de acesso')).toBeNull();
  });
});
