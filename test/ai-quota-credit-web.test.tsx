import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { AiQuotaUsagePanel } from '../src/components/AiQuotaUsagePanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.spyOn(Linking,'openURL').mockResolvedValue(undefined as never);

const quota = (used: number, allowance: number, extraAllowance=0) => ({
  workouts: { includedAllowance: allowance-extraAllowance,extraAllowance,allowance,used,
    remaining: allowance-used,percent: Math.floor(used*100/allowance),
    periodStart:'2026-11-01T00:00:00.000Z',periodEnd:'2026-12-01T00:00:00.000Z'},
  advisory: {includedAllowance:400,extraAllowance:0,allowance:400,used:15,remaining:385,percent:3,
    periodStart:'2026-11-01T00:00:00.000Z',periodEnd:'2026-12-01T00:00:00.000Z'},
  rollover:false,creditPurchaseStatus:'AVAILABLE',thresholds:{warning:70,critical:90,exhausted:100},
});

beforeEach(()=>{
  mockApi.mockReset();
  jest.mocked(Linking.openURL).mockClear();
});

test('AI quota notices 70%, 90%, exhausted with real backend meter',async()=>{
  mockApi.mockResolvedValue(quota(70,100));
  const view=render(<AiQuotaUsagePanel canPurchase={false}/>);
  await waitFor(()=>expect(view.getByTestId('ai-workout-quota')).toBeTruthy());
  expect(view.getByText(/pelo menos 70%/)).toBeTruthy();
  expect(view.queryByTestId('ai-buy-100')).toBeNull();
  mockApi.mockResolvedValue(quota(90,100));
  fireEvent.press(view.getByTestId('ai-quota-refresh'));
  await waitFor(()=>expect(view.getByText(/pelo menos 90%/)).toBeTruthy());
  mockApi.mockResolvedValue(quota(100,100));
  fireEvent.press(view.getByTestId('ai-quota-refresh'));
  await waitFor(()=>expect(view.getByText(/Cota esgotada/)).toBeTruthy());
});

test('only OWNER-enabled panel opens verified Cakto checkout, never counts payment before callback',async()=>{
  mockApi.mockImplementation(async(path:string)=>{
    if(path==='/ai/quota')return quota(10,50);
    if(path==='/ai/credits/checkout')return {
      packageCode:'IRON_AI_WORKOUT_100',units:100,amountMinor:1990,currency:'BRL',status:'pending',
      checkoutUrl:'https://pay.cakto.com.br/ai100?sck=fa9c7a11-5725-4495-bc16-f09a86c52d3e',
    };
    throw Error('unsupported');
  });
  const view=render(<AiQuotaUsagePanel canPurchase/>);
  await waitFor(()=>expect(view.getByTestId('ai-buy-100')).toBeTruthy());
  fireEvent.press(view.getByTestId('ai-buy-100'));
  await waitFor(()=>expect(jest.mocked(Linking.openURL)).toHaveBeenCalledTimes(1));
  const args=mockApi.mock.calls.find(([path])=>path==='/ai/credits/checkout');
  expect(JSON.parse(args?.[2]?.body)).toMatchObject({packageCode:'IRON_AI_WORKOUT_100'});
  expect(JSON.parse(args?.[2]?.body)).not.toHaveProperty('gymId');
  expect(view.getByText(/só serão adicionados após confirmação financeira/)).toBeTruthy();
});

test('fails closed on invalid checkout URL and does not show fake purchase buttons without plan allowance',async()=>{
  mockApi.mockImplementation(async(path:string)=>{
    if(path==='/ai/quota')return quota(0,50);
    return {packageCode:'IRON_AI_WORKOUT_100',units:100,currency:'BRL',status:'pending',
      checkoutUrl:'https://fraud.example/?sck=fa9c7a11-5725-4495-bc16-f09a86c52d3e'};
  });
  const view=render(<AiQuotaUsagePanel canPurchase/>);
  await waitFor(()=>expect(view.getByTestId('ai-buy-100')).toBeTruthy());
  fireEvent.press(view.getByTestId('ai-buy-100'));
  await waitFor(()=>expect(view.getByTestId('ai-quota-error')).toBeTruthy());
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test('OWNER sees no fake purchase action while commercial backend says NOT_CONFIGURED',async()=>{
  mockApi.mockResolvedValue({...quota(10,50),creditPurchaseStatus:'NOT_CONFIGURED'});
  const view=render(<AiQuotaUsagePanel canPurchase/>);
  await waitFor(()=>expect(view.getByTestId('ai-workout-quota')).toBeTruthy());
  expect(view.queryByTestId('ai-buy-100')).toBeNull();
  expect(view.getByTestId('ai-packs-unavailable')).toBeTruthy();
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test('missing purchase capability fails closed without hiding usable quota meter',async()=>{
  const fromLegacy:Record<string,unknown>={...quota(4,50)};
  delete fromLegacy.creditPurchaseStatus;
  mockApi.mockResolvedValue(fromLegacy);
  const view=render(<AiQuotaUsagePanel canPurchase/>);
  await waitFor(()=>expect(view.getByTestId('ai-workout-quota')).toBeTruthy());
  expect(view.queryByTestId('ai-buy-100')).toBeNull();
});
