import fs from 'node:fs';

describe('Macro N mobile distribution readiness', () => {
  it('has explicit Android and iOS production EAS paths', () => {
    const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    expect(eas.build.production.distribution).toBe('store');
    expect(eas.build.production.android.buildType).toBe('app-bundle');
    expect(eas.build.production.ios.simulator).toBe(false);
    expect(eas.build.preview.ios.simulator).toBe(true);

    expect(pkg.scripts['build:android:prod']).toContain('--platform android');
    expect(pkg.scripts['build:ios:prod']).toContain('--platform ios');
    expect(pkg.scripts['submit:android:prod']).toContain('--platform android');
    expect(pkg.scripts['submit:ios:prod']).toContain('--platform ios');
  });

  it('certifies both Android and iOS production exports in CI', () => {
    const workflow = fs.readFileSync(
      '.github/workflows/mobile-ci.yml',
      'utf8',
    );

    expect(workflow).toContain('Export Android production bundle');
    expect(workflow).toContain('Verify Android production bundle integrity');
    expect(workflow).toContain('Export iOS production bundle');
    expect(workflow).toContain('Verify iOS production bundle integrity');
    expect(workflow).toContain('expo export --platform android');
    expect(workflow).toContain('expo export --platform ios');
  });

  it('keeps store publication and privacy declarations external until evidenced', () => {
    const readiness = fs.readFileSync(
      'docs/N_MOBILE_DISTRIBUTION_READINESS.md',
      'utf8',
    );
    const android = fs.readFileSync(
      'store/android/DATA_SAFETY_READINESS.md',
      'utf8',
    );
    const ios = fs.readFileSync(
      'store/ios/PRIVACY_LABELS_READINESS.md',
      'utf8',
    );

    expect(readiness).toContain('BLOCKED_EXTERNAL');
    expect(readiness).toContain('Google Play Console');
    expect(readiness).toContain('App Store Connect');
    expect(android).toContain('NOT SUBMITTED');
    expect(ios).toContain('NOT SUBMITTED');
    expect(android).toContain('Do not mark this checklist complete');
    expect(ios).toContain('Do not infer');
  });
});
