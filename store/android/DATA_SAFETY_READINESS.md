# Android — Data Safety Readiness

Status: **NOT SUBMITTED / EXTERNAL EVIDENCE REQUIRED**

This file is an engineering checklist, not a completed Google Play Data Safety declaration.

Before submission, reconcile the production app and backend against the approved Macro L register and record:

- data types actually collected or shared;
- purpose for each data type;
- whether data is optional or required;
- encryption in transit;
- account deletion/DSR path;
- retention/deletion behavior;
- third-party processors actually active;
- payment data boundary and confirmation that raw CVV/PAN is not handled by IRON where hosted/tokenized checkout is used;
- health/fitness/student information actually processed;
- analytics/crash tooling actually enabled.

Do not mark this checklist complete from source-code assumptions alone.
