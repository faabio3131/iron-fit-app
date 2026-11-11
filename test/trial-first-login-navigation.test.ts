import { shouldGuideNewTrialOnboarding } from '../src/web/trial-onboarding-entry';

const source = {
  activeTenantId: 'tenant-issued-by-auth',
  roles: ['OWNER'],
  subscriptionStatus: 'ACTIVE',
  trialStatus: 'TRIALING',
  onboardingStatus: 'NOT_STARTED',
  nextStep: 'ACADEMY_PROFILE',
};

describe('official trial first-login navigation', () => {
  test('verified new OWNER starts in the real onboarding workspace', () => {
    expect(shouldGuideNewTrialOnboarding(source)).toBe(true);
    expect(shouldGuideNewTrialOnboarding({
      ...source, onboardingStatus: 'IN_PROGRESS', nextStep: 'TEAM_REVIEW',
    })).toBe(true);
    expect(shouldGuideNewTrialOnboarding({
      ...source, roles: ['MANAGER'],
    })).toBe(true);
  });

  test.each([
    { activeTenantId: null },
    { roles: ['STUDENT'] },
    { roles: ['RECEPTION'] },
    { subscriptionStatus: 'SUSPENDED' },
    { subscriptionStatus: null },
    { trialStatus: 'INACTIVE' },
    { trialStatus: 'EXPIRED' },
    { trialStatus: null },
    { onboardingStatus: 'COMPLETED', nextStep: null },
    { onboardingStatus: null },
    { onboardingStatus: 'NOT_STARTED', nextStep: 'INVALID_STEP' },
  ])('does not bypass backend authorization, trial status or onboarding authority: %p', patch => {
    expect(shouldGuideNewTrialOnboarding({ ...source, ...patch })).toBe(false);
  });
});
