@AGENTS.md

# Iron Fit Mobile — Arquitetura Modular Canônica

A partir da FASE 4 CORE-MOBILE, `App.tsx` é um bootstrap estrito: contém somente `SafeAreaProvider`, `AuthProvider` e `RootNavigator`. Chamadas de rede, sessão, seleção de tenant, telas e regras de fluxo pertencem a `src/`.

```text
src/
├── config/
│   └── env.ts
├── storage/
│   └── token-storage.ts
├── services/
│   ├── api.ts
│   └── ai.ts
├── context/
│   └── AuthContext.tsx
├── components/
│   ├── AIInsightCard.tsx
│   ├── AIProjectionCard.tsx
│   ├── AIWorkoutAssistant.tsx
│   ├── TabItem.tsx
│   ├── StatCard.tsx
│   ├── Metric.tsx
│   ├── EmptyState.tsx
│   └── InfoRow.tsx
├── screens/
│   ├── LoginScreen.tsx
│   ├── TenantSelectionScreen.tsx
│   ├── WorkoutsScreen.tsx
│   ├── SchedulesScreen.tsx
│   ├── CheckInScreen.tsx
│   ├── EvolutionScreen.tsx
│   ├── FinancialScreen.tsx
│   └── ProfileScreen.tsx
└── navigation/
    └── RootNavigator.tsx
```

## Responsabilidades

- `config/env.ts`: resolução fail-fast de `EXPO_PUBLIC_API_URL`.
- `storage/token-storage.ts`: persistência segura de `access_token` e `refresh_token` com SecureStore e migração do storage legado.
- `services/api.ts`: cliente HTTP central, Bearer token, refresh single-flight em 401, retry único e revogação de sessão no logout.
- `services/ai.ts`: contrato governado de Iron Intelligence, sanitização de payload, timeout e fallback fail-open.
- `context/AuthContext.tsx`: estado autenticado, restauração de sessão, perfil, tenant ativo, login multi-gym, seleção de tenant e logout.
- `navigation/RootNavigator.tsx`: navegação condicional entre boot, login, seleção de unidade e abas autenticadas.
- `screens/*`: cada domínio visual consome exclusivamente os serviços/contextos canônicos.
- `components/AI*`: feedback inteligente, projeção e assistente, sempre desacoplados dos fluxos obrigatórios.
- `components/*`: componentes visuais reutilizáveis sem regra de negócio de API.

## Contratos de API preservados

A modularização e a camada de IA não alteram os endpoints homologados:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me/profile`
- `GET /me/workouts`
- `GET /me/schedules`
- `POST /me/check-in`
- `GET /me/assessments`
- `GET /me/charges`

Os wrappers `src/api.ts`, `src/auth-session.ts` e `src/config.ts` permanecem como reexports de compatibilidade para evitar quebra de consumidores existentes.

## Contratos opcionais de Iron Intelligence

- `POST /me/ai/workout-insights`
- `POST /me/ai/chat`

Esses endpoints são opcionais para a experiência mobile. Enquanto o backend não os publicar, ou em qualquer 404/5xx/timeout/offline, o aplicativo deve permanecer integralmente operacional e renderizar conteúdo local seguro. O mobile envia apenas agregados mínimos de treino/evolução; não envia objetos completos de perfil, credenciais ou dados financeiros para a IA.

## Governança IRON Intelligence

**Status: IRON INTELLIGENCE: ATIVO / EM FASE 5.**

A camada de inteligência é complementar e nunca pode se tornar dependência obrigatória dos fluxos homologados. Falha, timeout, indisponibilidade de rede ou ausência dos endpoints de IA deve degradar para conteúdo local seguro sem bloquear `/me/workouts`, `/me/assessments`, autenticação, navegação ou demais funções do aluno. Credenciais, tokens, senhas e dados financeiros sensíveis são proibidos nos payloads enviados à camada de IA.

## Quality Gate

Toda alteração mobile deve preservar `npm run typecheck`, `npm run lint` e `npm test` verdes no workflow permanente `Mobile CI` antes e depois da promoção para `main`.
