/**
 * Presentation routing only: never grants roles, plans or permissions.
 * Only the backend may confirm an active trial, onboarding and entitlement.
 */
export function shouldGuideNewTrialOnboarding(input: {
  activeTenantId: string | null;
  roles: readonly string[];
  subscriptionStatus?: string | null;
  trialStatus?: string | null;
  onboardingStatus?: string | null;
  nextStep?: string | null;
}): boolean {
  return Boolean(
    input.activeTenantId &&
    (input.roles.includes('OWNER') || input.roles.includes('MANAGER')) &&
    input.subscriptionStatus === 'ACTIVE' &&
    input.trialStatus === 'TRIALING' &&
    (input.onboardingStatus === 'NOT_STARTED' || input.onboardingStatus === 'IN_PROGRESS') &&
    ['ACADEMY_PROFILE', 'EQUIPMENT_INVENTORY', 'TEAM_REVIEW', 'FINISH'].includes(input.nextStep ?? ''),
  );
}
