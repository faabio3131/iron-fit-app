# IRON — Bloco 6 — Cross-Surface Recertification

Status: CANDIDATE até branch CI, PR CI, merge e pós-merge verdes.

## Autoridade única

Web e mobile pertencem ao mesmo `iron-fit-app` Expo/React Native Web e usam o mesmo `src/services/api.ts`.

A identidade, sessão, tenant ativo, RBAC, dados de domínio e entitlements continuam sendo autoridades do backend. O frontend não envia headers de tenant como fonte de autoridade e não decide capabilities por nome comercial de plano.

## Web operacional

A Web consome os domínios canônicos de onboarding, equipe, alunos, catálogo/inventário, avaliações, treinos, agenda, acesso, financeiro e Product/Plan/Feature.

A recertificação B6 corrigiu duas divergências detectadas contra o CURRENT:
- criação de membro agora usa a mesma política forte de senha já usada por trial/reset/security;
- equipamentos deixam de usar o endpoint manual legado e passam por `/equipments/catalog/selection`, preservando EQ5.

## Mobile do aluno

O mobile lê o mesmo backend por rotas `/me/profile`, `/me/workouts`, `/me/assessments`, `/me/schedules` e `/me/charges`.

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
- build do container Web.

Esta certificação do app não substitui a homologação externa física do conjunto.
