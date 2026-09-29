# IRON FIT — Reconciliação inicial de CURRENT

Data: 29/09/2026. Macro atual: O; WP inicial: O0. Não é certificação de produção.

Atualização vigente: [Evidências da retomada](IRON_EVIDENCIAS_RETOMADA_2026-09-29.md). As tabelas abaixo preservam a reconciliação inicial; o workspace Render já foi autorizado, o preview foi atualizado, as PRs backend #110/#111 foram mergeadas com CI verde e o readiness foi recuperado. Os estados temporários abaixo não devem ser usados como situação final.

## Autoridade e fontes

Auditoria de 29/09 lida antes do prompt anexado. Aplicados o Prompt Mestre O–T pós-auditoria, o Cronograma Mestre, as instruções permanentes e a norma de Arquitetura Única Evolutiva. O System Design GERENTE AI é referência institucional de outro produto, não substitui contratos IRON. CURRENT reproduzível prevalece sobre documentos históricos.

## Fatos confirmados nesta execução

| Item | Evidência / estado |
|---|---|
| Backend | `faabio3131/iron-fit-backend`, público, branch padrão `main`, SHA `00a19f0d66e08b1ec52947af9048d9ab09175c75`; GitHub consultado |
| CI backend main | run `36598807715`, SUCCESS |
| App | `faabio3131/iron-fit-app`, público, branch padrão `main`, SHA `7c6290eb888521f60e04e050f7b0e579c6f41029` |
| Visual | PR #22 OPEN/DRAFT, branch `visual/macro-o-premium`, remoto inicial `4b78ec9add83309656a9413d1594eac31087b4cd`, mergeable/clean na consulta |
| CI visual inicial | run `36623725708`, SUCCESS no SHA remoto inicial |
| Correção de senha | local `0c504a5e2f0f6565b25c43efe187aa2c2b9ba3c9`; mostrar/ocultar no login e trial, ainda não no remoto na reconciliação inicial |
| Correção dashboard | local `991c8dd9b81e1f2ec72259af347f82739ea86564`; publicada como `eae9605cdf1d4cf225adc0b02c00de18049dca7f`, PR backend #110; árvores idênticas `bff93d52ae3dff128b6877191b05ca9a026aa2f0` |
| Testes locais | Backend lint/typecheck/build e 606/606 PASS; app typecheck/lint sem erros e 67 PASS, 1 teste live ignorado por exigir runtime; 2 warnings de hooks ligados ao caminho demo |
| PRs backend anteriores | #81 runtime e #64 Vault continuam abertas; não são autorização para merge automático de escopo histórico |
| Preview | `https://iron-macro-o-preview.onrender.com/`, sessão QA OWNER observada, dashboard ainda mostra erro interno |
| Supabase | `gym-saas`, ref `pfbwfjujiogfrakusobp`, ACTIVE_HEALTHY; somente consultas de metadata executadas |
| Migrations físicas | 26 entradas Prisma concluídas, nenhuma dessas rolled back; não equivalem a todas as migrations CURRENT |
| Charge | Não contém `gatewayProviderCode`, `gatewayConnectionId`, `gatewayRequestId`, `gatewayCheckoutExpiresAt` |
| Vault físico | Nenhuma tabela cujo nome contenha Integration/Vault encontrada em public; domínio existe no código, operacionalidade física não certificada |
| Launch Matrix | APPROVED no banco; Core/Web/email/billing/Android/iOS/AI/Meta/Google/YouTube em LAUNCH; Creator managed/private OUT; Wellhub/TotalPass EXTERNAL_BLOCKER |
| Render | Reconsulta de serviços bloqueada: conector exige seleção confirmada do workspace. Inventário retornou `My Workspace` (`tea-dabhel5cqm1c73dkkn90`); não foi selecionado autonomamente |

## Divergências reconciliadas

- Cronograma histórico dizia uma única migration. Consulta atual mostra 26; classificação correta: schema parcialmente atualizado, ainda com drift comprovado.
- Auditoria descreve migrations materializadas, mas isso não comprova schema completo nem Vault físico. Não promover E, H ou P com essa evidência parcial.
- `LIVE` no histórico Render não foi reafirmado como estado atual do deploy sem consulta ao provedor.
- Checkpoint visual anterior dizia O23. Isso é apenas revisão de uma tela: há O0 e demais WPs incompletos. Macro O permanece em execução, não pronto para aprovação final.
- `PremiumDemoApp` e `hue-rotate` não foram encontrados no checkout atual; porém `CommercialWebApp` contém o parâmetro `demoPreview`, perfil/tenant/permissões e dados fabricados. Remover esse caminho é trabalho O0 necessário.

## Estado A–T

| Macro | Classificação nesta reconciliação |
|---|---|
| A | Base integrada; saneamento histórico documentado; não recomeçar |
| B | Autoridade e matriz APPROVED físicas; homologação dos providers não decorre da aprovação |
| C | Implementação existente; infraestrutura física de Vault pendente |
| D | Runtime existente; segregação física DEV/HOMOLOG/PROD não recertificada |
| E | BLOCKER de drift físico; DR externo recente pendente |
| F | Preview acessível; DNS/TLS/produção final pendentes |
| G/H/I/J | Implementação interna existente; homologação externa exigida para capacidades LAUNCH |
| K | Creator OUT; Wellhub/TotalPass EXTERNAL_BLOCKER; AI LAUNCH sem homologação externa certificada nesta execução |
| L/M | Core/documentação existentes; gates finais legal/operação pendentes |
| N | Android/iOS LAUNCH; publicação em stores não comprovada |
| O | IN_PROGRESS — O0 e superfícies reais incompletas |
| P/Q/R/S/T | PENDENTES; nenhuma promoção de GO ou release |

## Decisões e próximos passos

1. Publicar e certificar a correção mínima do dashboard na PR #110. Merge autorizado somente após CI verde e mergeability atual.
2. Preservar a correção de senha; eliminar o ramo demonstrativo do componente real e seus warnings. Manter auth, tenant, RBAC, entitlements e APIs canônicos.
3. O0 KEEP: bootstrap real, APIs, correções de senha, Expo/lockfile e melhorias úteis. DROP: ramo demo. REWORK: branding provisório, JSON bruto, tokens/estados e composição das superfícies. REVERT: nenhum revert global autorizado/necessário.
4. Logo azul oficial ainda não localizada no checkout; não substituir por hue-rotate ou logo inventada.
5. Testar cada incremento e registrar SHA/PR/CI/deploy. Preview exige confirmar workspace Render antes da operação pelo conector.
6. O23 somente após O0–O22 completos; merge visual exige aprovação visual explícita. A autorização de merge técnico não transforma preview incompleto em gate visual aprovado.

## Limites e STOP-SHIP

Sem escrita no banco, migration, alteração de segredo, promoção de provider ou produção. Drift físico e fluxo operacional incompleto impedem GO. A correção de leitura não é homologação do banco. Nenhum incidente de vazamento foi comprovado nesta execução; o select amplo de usuário foi identificado no código e removido da leitura de cobranças pela correção candidata.

## Atualização — correções e conflito de identidade

- PR backend #110 mergeada por squash: `edb13b7a93aa98b597186102537d18e41db23770`.
- CI branch `36637611819` e PR `36637641140`: SUCCESS. Todos os passos concluídos, incluindo secret scan, dependency audit, migrations fresh-install, DR em PostgreSQL CI, E2E integrado, contrato app/backend e build container. Pós-merge e deploy ainda aguardam verificação.
- Ramo demo removido do CommercialWebApp. Perfil/tenant vêm exclusivamente de useAuth; carregamento/ações usam as APIs existentes. App: 67 PASS + 1 live ignorado; lint sem erros ou warnings; typecheck PASS; export Web PASS.
- Marca localizada em `faabio3131/fm-tecnologia-web-platform`, `public/iron-fit-core-official-lockup.webp`, blob `1c27e900dc09b40972b950a24789df27e8721eab`. Uso confirmado em `src/components/marketing/iron-fit-core-landing.tsx`.
- Inspeção visual do arquivo confirma verde/lime. O ativo azul canônico exigido pelo Prompt Mestre não foi encontrado. Não foi copiado ao app nem transformado com filtro. Conflito de fonte visual precisa ser resolvido antes da certificação O0/O1 e finalização do branding.
- O saneamento demonstrativo está implementado; O0 completo ainda não certificado. Macro O não avançou ficticiamente a O23.
