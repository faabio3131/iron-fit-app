import fs from 'node:fs';

const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const easConfig = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectPngAsset(path: string) {
  expect(fs.existsSync(path)).toBe(true);
  const bytes = fs.readFileSync(path);
  expect(bytes.length).toBeGreaterThan(1024);
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
}

describe('release packaging configuration', () => {
  test('required API URL fails explicitly when missing and normalizes when present', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;

    try {
      delete process.env.EXPO_PUBLIC_API_URL;
      jest.resetModules();
      expect(() => jest.requireActual('../src/config/env')).toThrow('EXPO_PUBLIC_API_URL não configurada');

      process.env.EXPO_PUBLIC_API_URL = 'https://api.ironfit.example/api/v1///';
      jest.resetModules();
      const { API_URL } = jest.requireActual<{ API_URL: string }>('../src/config/env');
      expect(API_URL).toBe('https://api.ironfit.example/api/v1');
    } finally {
      if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = original;
      jest.resetModules();
    }
  });

  test('app manifest is consistent with the canonical Android production identity', () => {
    expect(appConfig.expo.name).toBe('Iron Fit');
    expect(appConfig.expo.version).toBe(pkg.version);
    expect(appConfig.expo.android.package).toBe('com.faabio3131.ironfit');
    expect(appConfig.expo.android.versionCode).toBe(1);
    expect(appConfig.expo.android.permissions).toEqual(['android.permission.CAMERA']);
    expect(appConfig.expo.android.blockedPermissions).toEqual(expect.arrayContaining([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
    ]));
    expect(appConfig.expo.displayName).toBeUndefined();
    expect(appConfig.expo.splash).toBeUndefined();
  });

  test('EAS profiles produce debug APK, preview APK and production AAB', () => {
    expect(easConfig.cli.appVersionSource).toBe('local');
    expect(easConfig.build.development.environment).toBe('development');
    expect(easConfig.build.development.android.gradleCommand).toBe(':app:assembleDebug');
    expect(easConfig.build.preview.environment).toBe('preview');
    expect(easConfig.build.preview.android.buildType).toBe('apk');
    expect(easConfig.build.production.environment).toBe('production');
    expect(easConfig.build.production.distribution).toBe('store');
    expect(easConfig.build.production.android.buildType).toBe('app-bundle');
  });

  test('release assets exist and are valid PNG files', () => {
    const splashPlugin = appConfig.expo.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    ) as [string, { image: string }] | undefined;

    expect(splashPlugin).toBeTruthy();
    expectPngAsset(appConfig.expo.icon);
    expectPngAsset(appConfig.expo.android.adaptiveIcon.foregroundImage);
    expectPngAsset(appConfig.expo.android.adaptiveIcon.monochromeImage);
    expectPngAsset(splashPlugin![1].image);
  });

  test('release check aggregates all mandatory quality gates and Expo Doctor', () => {
    const releaseCheck = pkg.scripts['release:check'];
    expect(releaseCheck).toContain('npm run typecheck');
    expect(releaseCheck).toContain('npm run lint');
    expect(releaseCheck).toContain('npm test');
    expect(releaseCheck).toContain('expo-doctor@1.20.4');
  });
});
