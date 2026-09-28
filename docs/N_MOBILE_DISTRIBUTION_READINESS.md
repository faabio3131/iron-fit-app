# IRON — Macro N — Mobile Distribution Readiness

Status: **CANDIDATE — internal Android/iOS packaging readiness implemented. Store accounts, signing credentials, listings, policy declarations and review remain BLOCKED_EXTERNAL.**

## Launch decision

The approved V1 Launch Matrix marks both Android and iOS as LAUNCH.

This package prepares both platforms without claiming store publication.

## N1 — Android

Internal evidence:

- Expo/React Native project has a stable Android application package identifier;
- production EAS profile builds an Android App Bundle;
- preview profile builds APK for controlled internal testing;
- CI exports and inspects the Android production bundle;
- high-severity dependency audit, typecheck, lint, tests, expo-doctor and runtime Web cross-surface checks remain mandatory;
- storage/media permissions remain explicitly blocked unless functionality requires them.

External evidence still required:

- Google Play Console account/application;
- signing/app integrity configuration;
- Data Safety declaration based on the final production data flow;
- store listing assets/text;
- privacy-policy URL approved under Macro L;
- internal/closed test track artifact;
- review/rollout evidence.

## N2 — iOS

Internal evidence:

- stable iOS bundle identifier exists;
- EAS preview explicitly targets simulator for credential-free engineering checks;
- EAS production explicitly targets a device/store build;
- CI exports and inspects the iOS production JavaScript bundle;
- explicit iOS production build and submit scripts exist;
- camera usage purpose string remains declared only for the QR/check-in capability.

External evidence still required:

- Apple Developer / App Store Connect access;
- distribution certificate/provisioning managed through EAS/Apple;
- final app record bound to the intended bundle identifier;
- App Privacy labels derived from the final production data flow;
- approved privacy-policy URL;
- screenshots/listing metadata;
- TestFlight build and test evidence;
- App Review/submission evidence.

## Privacy declarations

Store privacy declarations are not inferred from dependencies alone.

They must be reconciled with:

- actual runtime telemetry;
- authentication/session data;
- student/health-related fields;
- communication providers;
- payment/fiscal providers;
- crash/analytics tooling actually enabled in production;
- the approved Macro L retention/legal-basis/subprocessor register.

## Gate

Internal CI can certify packaging and export integrity only.

Macro N reaches DONE only when each LAUNCH platform has real signed build + official store/test-track evidence, or when an explicit approved Launch Matrix change moves that platform OUT.
