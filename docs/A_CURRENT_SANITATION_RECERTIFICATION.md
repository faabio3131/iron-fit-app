# IRON — Macrobloco A — Recertificação Cross-Surface

Status: CANDIDATE até branch CI, PR CI, merge e pós-merge verdes.

## Autoridade única

Web e mobile pertencem ao mesmo `iron-fit-app` Expo/React Native Web e usam o mesmo `src/services/api.ts`.

Identidade, sessão, tenant ativo, RBAC, dados de domínio, billing e entitlements continuam sendo autoridades do backend. O frontend não envia headers de tenant como fonte de autoridade e não decide capabilities por nome comercial de plano.

## Correções portadas sobre o CURRENT

O Macrobloco A reincorpora de forma controlada os deltas úteis que ficaram nas PRs históricas #12 e #13:

- criação de membro Web usa a política canônica `strongPassword`;
- inventário de equipamentos usa `/equipments/catalog/selection`, preservando EQ5;
- o CI sobe o container Web de produção e verifica `/health` + entrega real do `index.html`;
- testes permanentes bloqueiam regressão para senha fraca, criação manual legada e ausência do smoke físico do runtime.

As correções foram aplicadas sobre o CURRENT posterior aos PRs #14, #15 e #16, preservando billing/recovery, transporte HTTP real e mocks assíncronos do SecureStore.

## Gate

O pipeline do repositório deve manter:

- dependency audit;
- typecheck;
- lint;
- Jest completo;
- release readiness;
- build check;
- export Android;
- integridade Android;
- export Web;
- integridade Web;
- build do container Web;
- start do container Web;
- `/health` real;
- entrega real do `index.html`.

Depois do merge do app, o backend B6 deve ser repinado para o novo SHA do app e executar novamente o Integrated Live E2E + cross-surface HTTP real.

Esta certificação não representa produção externa nem homologação de providers.
