# IRON FIT — Evidências da retomada de 29/09/2026

Atualização da identidade: consultar [Padrão do site oficial](IRON_PADRAO_VISUAL_SITE_OFICIAL.md). O usuário confirmou a página FM como referência, e a cascata CSS demonstra o padrão azul. A análise anterior do WebP isolado não descrevia a aparência definida pela página. Preparar o ativo final sem filtro permanece pendência de implementação; a fonte visual está identificada.

Projeto: IRON FIT CORE. Macro O em execução; O23 não liberado. Este relatório complementa a reconciliação inicial e prevalece sobre seus estados temporários.

## Correções publicadas

| Item | CURRENT antes | Alteração | Evidência |
|---|---|---|---|
| Leitura de cobranças | SELECT implícito dependia de colunas gateway ausentes e expandia User | Projeção explícita, com escopo de tenant preservado | Backend PR #110, main edb13b7a93aa98b597186102537d18e41db23770 |
| Clientes de banco | PrismaService registrado em 25 módulos, pools independentes; consultas 500 e readiness 503 | PrismaModule compartilhado importado pelos consumidores | Backend PR #111, head 4a8c4968e817ece41ad6f7e742203ccaf56ce396; squash dbce92b8c96ff8c22c2f1ac54084a70784a2a85f |
| Senhas | Sem controle visível no preview antigo | Mostrar/ocultar no login e trial | App PR #22, código 1cebac79207c73198c51566f3eee418a8fb73b7f |
| Autoridade demonstrativa | CommercialWebApp possuía perfil, tenant, permissões e dados demo | Remoção do caminho demo; uso de AuthContext e APIs canônicas | Mesmo commit app |

Arquivos backend: charge-read-model.ts, financial.service.ts, dashboard.service.ts e teste de leitura (#110); app.module.ts, 24 módulos de domínio, novo prisma.module.ts e teste de lifecycle (#111).
Arquivos app: LoginScreen.tsx, CommercialEntryScreen.tsx, CommercialWebApp.tsx e teste de autenticação já publicados.
Contratos: nenhum endpoint ou regra de negócio alterado. Migrations desta execução: nenhuma. Não foi alterada autoridade de autenticação, tenant, RBAC ou entitlement.

## Testes e CI

- PR #110: 606/606 testes locais; CI push 36637611819 e PR 36637641140 SUCCESS; pós-merge 36637955344 SUCCESS.
- PR #111: lint, typecheck e build PASS; 607/607 testes locais, zero skips. Novo teste com Nest ApplicationContext real comprova a mesma instância em Agenda/Acessos/Dashboard, uma conexão e um disconnect. CI push 36640718932 e PR 36640738561 SUCCESS.
- CI backend cobre auditoria de dependências, secret scan, migrations fresh-install, backup/restore em PostgreSQL CI, E2E integrado, contrato app/backend e container.
- App: 67 testes locais PASS e 1 teste live ignorado por exigir runtime; lint e typecheck PASS, zero warnings; export Web PASS. CI 36638062340 SUCCESS, incluindo exportações Android/iOS/Web, readiness e container/HTTP smoke.
- Verificação do preview publicado: login e trial alternam o campo entre password/text e o botão entre Mostrar/Ocultar senha. Campos vazios; nenhuma credencial lida ou exibida.

## Render confirmado

Workspace My Workspace autorizado pelo usuário. Backend gym-saas-backend; preview iron-macro-o-preview.

- Preview LIVE: deploy dep-dau3oflg1s2s73bb90kg, código 1cebac79207c73198c51566f3eee418a8fb73b7f.
- Backend #110 LIVE: dep-dau3eijrjlhs73cdv3p0, código edb13b7a93aa98b597186102537d18e41db23770.
- Backend #111: deploy automático dep-dau3suk9v7es73b6t030; resultado final registrado abaixo após verificação.
- A identificação IRON_BUILD_SHA configurada no runtime ainda informava 00a19f0; o commit implantado foi confirmado pela API do Render. Essa divergência de observabilidade não foi ocultada.

## Banco: preflight somente leitura

Projeto gym-saas, pfbwfjujiogfrakusobp.

FATO CONFIRMADO: 26 migrations Prisma concluídas, zero rollback; os 26 checksums coincidem com os arquivos do repositório. Há 15 migrations pendentes.
FATO CONFIRMADO: GatewayConnection tem zero registros e zero registros exigindo externalização de credencial para C11. Nenhum valor de segredo foi consultado.
PENDÊNCIA: backup/restore recente deste banco externo e execução governada via Prisma; o drill CI não equivale ao restore de HOMOLOG.
DECISÃO: não executar DDL sem a evidência exigida para a mudança de schema. Regra de parada: seção 22 do Prompt Mestre, ausência de evidência necessária para mudança de alto risco.

| Migration pendente, em ordem canônica | SHA-256 |
|---|---|
| 20260927140500_integration_secret_vault_c1_c3 | b3962f5fd8c34e58b3aa3564c671159d6f96f4d0cb05ec1051817aec3fd8ef9f |
| 20260927143000_integration_secret_lifecycle_controls | d5fbfe07b9b9c91f336b18e2bdc9659fa4a36f6634888d811248a6732803ad8e |
| 20260927190500_integration_secret_cleanup_queue | 1eb9bf4e1aec9c1d6d3ee083106881fc64c9e5dba775523d75d45bfd7eb2fa1c |
| 20260927201500_c11_secret_backup_dr_boundary | ce0db819daa07dae08fdd45850596b98f40cf77db2f8929a48b78ab206951f3c |
| 20260927203500_c14_governed_break_glass | d038f6d90f856903092d206b8ad02fc94323eed67e795a5d03dcdc9ae778806f |
| 20260928032000_oauth_authorization_attempt | 1c7c8d09d7c4dfc8e251a22bfb9a7e3cbc73e884e9f31b808380fd92a9083726 |
| 20260928100000_oauth_provider_binding | 5afd3e9e0c35191e514aa762e81f282b85ca39a41b61173c775a9deb669e9d6b |
| 20260928103500_oauth_refresh_coordination | 85651dab84a509638e1253111492a91993f9ae043c48ec519523f5945816d719 |
| 20260928111000_communication_dispatch_boundary | 16e628530f0b75a6ace513b554e104f659c7f6e25f03d79c6e8ac5aab0657648 |
| 20260928115000_auth_email_delivery_lifecycle | 33d167cd02c6de21474af15a46b6cec75b2de7bf7ae950f1aa7dbd25f683969e |
| 20260928123000_tenant_payment_checkout | fbff596321b1f60cb156b19f7858a64b95843d652b4e9ca33e624925d1b808f3 |
| 20260928130000_fiscal_handoff_state | c1914be7ea3f5401c1d88c6d840dbee701a3f444b4491abc32f1a1da998626b8 |
| 20260928134000_fiscal_bridge_binding | 18d5661ddd80a449b9079cbc968b7d2225ec2d2eaa7cce4682456c5a1544c2c7 |
| 20260928141000_fiscal_reconcile_cancel | 0456f0a67fc577932a418625aedfd91da14ccc564f2dfa91d2498af5dbd50fe4 |
| 20260928143000_lgpd_operational_core | 6a9bdd0ed8962d7a3b37a96483f49d8a1d9fc9a2c84297e5e50f2c447ddc85d1 |

Procedimento preparado: confirmar backup restaurável e conexão administrativa do ambiente; ensaiar as migrations CURRENT sobre restore isolado; repetir preflight de checksums/C11; executar prisma migrate deploy pelo fluxo autorizado; conferir 41 migrations concluídas, schema, readiness, isolamento e smoke. Preservar rollback por restore e não editar a história Prisma para fingir aplicação.

## Bloqueios do gate O0 e da V1

- O ativo encontrado no repositório oficial do site é verde/lime (iron-fit-core-official-lockup.webp, blob 1c27e900dc09b40972b950a24789df27e8721eab). Conflita com a marca azul exigida pelo Prompt Mestre O–T, seção de identidade/O0. O ativo azul aprovado ainda precisa ser fornecido/localizado. Não foi usado hue-rotate nem criada marca substituta.
- A interface real ainda tem JSON bruto, textos técnicos e composição provisória. O0–O22 não estão certificados; PR #22 permanece Draft. O merge visual só pode ocorrer após O23 e aprovação visual explícita.
- Integrações/Vault físicos, schema completo, homologações externas das capacidades LAUNCH, segregação dos ambientes e DR externo continuam pendentes. Nenhuma capability foi promovida ou desligada silenciosamente.
- P/Q/R/S/T não foram aprovados; nenhuma release V1.0.0 ou GO comercial foi declarado.

## Resultado do gate

Correções técnicas #110/#111: CI aprovado e merge realizado; verificação externa #111 abaixo.
Macro O: REPROVADO / CORRIGIR, com bloqueio externo da identidade oficial.
V1: NO-GO; é necessária conclusão dos gates e homologações, conforme o Prompt Mestre.

## Verificação pós-merge #111 — 22:43 UTC

- Deploy dep-dau3suk9v7es73b6t030 confirmado LIVE, commit dbce92b8c96ff8c22c2f1ac54084a70784a2a85f.
- CI main 36640999412: SUCCESS.
- GET /api/v1/health/ready: HTTP 200, status ok, postgres up às 22:43:25 UTC; antes da correção retornava 503.
- Sessão real QA OWNER: Agenda, Acessos, Financeiro, Visão geral e Plano e configurações concluíram suas consultas sem erro interno após o deploy. Agenda/Acessos/Financeiro falhavam no mesmo teste antes do deploy.
- Integrações permanece com erro interno; IntegrationConnection não existe no schema físico. Leitura recuperada dos demais módulos não certifica mutações nem homologação comercial E2E.
- Log do novo processo registra PrismaModule uma vez. Houve uma falha de conexão no boot; a reconexão das consultas/readiness funcionou. Não foi declarado boot infalível.
- Gate das correções #110/#111: APROVADO, limitado aos deltas testados e às leituras verificadas. Macro O e V1 mantêm as classificações acima.
- Captura do formulário trial publicado: iron-trial-preview-2026-09-29.jpg. Evidência do controle de senha e do estado ainda provisório do visual, não aprovação visual.
