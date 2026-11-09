# AGENTES.md — IRON FIT CORE Web/Mobile | Fechamento comercial V1.0.0
**Checkpoint 09/11/2026.** Este arquivo integra o cronograma canônico completo no backend: https://github.com/faabio3131/iron-fit-backend/blob/main/AGENTES.md . Leia também o AGENTS.md local e os Prompts Mestres O→T. CURRENT reproduzível prevalece sobre notas históricas.

## Missão
Finalizar **o app existente**, não demo ou visualização paralela. Todas as telas devem conversar com API real, sessão real, RBAC + permission + tenant + entitlement + step-up, e proteger o fluxo acadêmico. Mudar domínio/estado no backend; nunca inventar autoridade na Web. Mobile é o mesmo produto, com experiência profissional completa.

## Prioridades e dependências técnicas
| WP | Frente do aplicativo real | Critério de aceite |
|---|---|---|
| IF-P0-05 | Trial público, login, onboarding, OWNER, escolha do plano, checkout dinâmico e retorno de pagamento conforme FM Command/Cakto | Nunca iniciar compra sem vínculo tenant/invoice. Nunca marcar pago por redirect; só exibir estado canônico após S2S do backend. URL de Cakto validada e gerada após autenticação. |
| IF-P1-01 | Alunos, recepção/matrícula, equipe, treinos (DRAFT→revisão PROFISSIONAL→ativo), equipamentos, agenda/check-in, QR e financeiro academia→aluno | Testar UX role a role, botões, rotas, filtros, validações, idempotência, RBAC e tenant isolation com backend real. |
| IF-P1-03 | Premium Web/mobile já existentes: Cockpit, Alunos 360, Equipment Intelligence, Workout Studio, Agenda, Access Center, Integration Center, Security Center, Privacy Center, Creator, Aggregator, comunicação | Sem raw JSON, dados fictícios, verde/lime ou roxo históricos. Preservar identidade IRON azul e funcionalidades. Testar 320/768/1024/desktop, Android/iOS conforme capacidade real. |
| IF-Q-01 | Segurança frontend, storage/sessões, tratamento HTTP 401/403, step-up, dados sensíveis, links e parâmetros/retornos | Testes adversariais e E2E; frontend não amplia permissões do backend. |
| IF-R/S/T | Readiness, build/release/smoke de Web e mobile, conferência pós-deploy | Evidência e CI para SHAs reais; nenhuma funcionalidade da Cakto é considerada live sem webhook e licença end-to-end. |

## Gates
- Macro O: O22 preview no produto real → O23 **aprovação visual explícita do usuário** → O24 merge final. Não presumir que aprovação anterior se estende a diff visual novo.
- P/Q/R/S/T seguem com CI, testes de navegador, mobile, segurança e release. Garante **zero** STOP-SHIP para GO.
- Checkout Cakto pertence ao FM Command; não criar billing paralelo no app ou usar link público compartilhado sem referência canônica da compra.
- Provedores de hardware/emails/IA/fiscal dependentes de configurações externas devem ser classificados IMPLEMENTED/EXTERNAL BLOCKER, nunca como homologados sem evidência.

## CURRENT verificado 09/11/2026
- App main `8204c7a1097625f9adb303b2b1c1c6f31f2f248a`; CI #42267643474 SUCCESS, sem PR aberta nessa consulta.
- Backend main `c0bbcd4e` na linha de base, depois PR #227 do AGENTES e #228 de vigência paga integradas (consultar nova main no GitHub antes de implementar).
- Contabo: app servido e API saudável na última medição; runtime `HOMOLOG`, billing sandbox e email externo desabilitado; não é GO.
- Command PR #56 Draft, site FM PR #19 Draft. Nenhum checkout Cakto verificado no app real.
- **Próximo passo:** verificar as rotas atuais do cadastro do trial e da assinatura read-only; propor somente diff de UI que consome checkout invoice-bound do FM Command via endpoint/backend oficial; criar regressão browser e certificar CI, sem simular pagamento.

## Procedimento
AUDITAR → IMPLEMENTAR → TESTAR → CORRIGIR → RETESTAR → DIFF → PR → CI → MERGE SE GATE VERDE → PÓS-MERGE → próximo WP. Sempre registrar repos, branch, SHA, PR, CI, ambiente, bloqueador e próxima ação. Não inventar PASS.
