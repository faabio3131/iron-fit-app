# AGENTES.md — IRON FIT CORE Web/Mobile | Fechamento comercial V1.0.0
**Checkpoint 18/11/2026 — CURRENT, DELTA ONLY.** Este arquivo integra o cronograma canônico completo no backend: https://github.com/faabio3131/iron-fit-backend/blob/main/AGENTES.md . Leia também o AGENTS.md local e os Prompts Mestres O→T. CURRENT reproduzível prevalece sobre notas históricas.

## Missão
Finalizar **o app existente**, não demo ou visualização paralela. Todas as telas devem conversar com API real, sessão real, RBAC + permission + tenant + entitlement + step-up, e proteger o fluxo acadêmico. Mudar domínio/estado no backend; nunca inventar autoridade na Web. Mobile é o mesmo produto, com experiência profissional completa.

## Prioridades e dependências técnicas
| WP | Frente do aplicativo real | Critério de aceite |
|---|---|---|
| IF-P0-05 | Trial público, login, onboarding, OWNER, escolha do plano, checkout dinâmico e retorno de pagamento conforme FM Command/Cakto | Nunca iniciar compra sem vínculo tenant/invoice. Nunca marcar pago por redirect; só exibir estado canônico após S2S do backend. URL de Cakto validada e gerada após autenticação. |
| IF-P1-01 | Alunos, recepção/matrícula, equipe, treinos (DRAFT→revisão PROFISSIONAL→ativo), equipamentos, agenda/check-in, QR e financeiro academia→aluno | Testar UX role a role, botões, rotas, filtros, validações, idempotência, RBAC e tenant isolation com backend real. |
| IF-P1-03 | Premium Web/mobile já existentes: Cockpit, Alunos 360, Equipment Intelligence, Workout Studio, Agenda, Access Center, Integration Center, Security Center, Privacy Center, Creator, Aggregator, comunicação | Sem raw JSON ou dados fictícios. Preservar identidade oficial verde neon sobre preto, conforme AGENTS.md local e PR #108/#109; não reabrir visual aprovado. Testar 320/768/1024/desktop, Android/iOS conforme capacidade real. |
| IF-Q-01 | Segurança frontend, storage/sessões, tratamento HTTP 401/403, step-up, dados sensíveis, links e parâmetros/retornos | Testes adversariais e E2E; frontend não amplia permissões do backend. |
| IF-R/S/T | Readiness, build/release/smoke de Web e mobile, conferência pós-deploy | Evidência e CI para SHAs reais; nenhuma funcionalidade da Cakto é considerada live sem webhook e licença end-to-end. |

## Gates
- Macro O: O22 preview no produto real → O23 **aprovação visual explícita do usuário** → O24 merge final. Não presumir que aprovação anterior se estende a diff visual novo.
- P/Q/R/S/T seguem com CI, testes de navegador, mobile, segurança e release. Garante **zero** STOP-SHIP para GO.
- Checkout Cakto pertence ao FM Command; não criar billing paralelo no app ou usar link público compartilhado sem referência canônica da compra.
- Provedores de hardware/emails/IA/fiscal dependentes de configurações externas devem ser classificados IMPLEMENTED/EXTERNAL BLOCKER, nunca como homologados sem evidência.

## CURRENT verificado 18/11/2026
- App main `0edd596026695d1d65588dbcb0d0e4b451f6eac0`, production `1c7df687b771f1f1ba6e567350bb9010a014becb`; única diferença entre árvores: workflow específico de production. PRs #125–#131 integradas, exceto #128 substituída pela #129. Histórico de treinos e Alunos 360°, A1 delegado, checkout e leitura canônica já implementados. Não reconstruir.
- Backend production `15bbd2ee45949d8ed6cef389927b4eeca6fec19e`; CI pós-merge #44430334749 SUCCESS (63 etapas). Command autoridade V1 `faabio3131/FM-CONTROL-CENTER`, não V2. Deploy físico do último SHA ainda UNCERTIFIED nesta execução.
- IF-P0-05 / P3: corrigir exclusivamente falhas reproduzíveis do painel de assinatura e completar os contratos de autosserviço autorizados (O12), sem criar mutação local. Candidata #132 acumulativa: fallback legado aprovado na CI #44439235505 do HEAD anterior; agora inclui histórico oficial de faturas/pagamentos, indicação de truncamento, linguagem comercial e bloqueio de contratação duplicada para contrato atual. Command #218 recupera a fatura pendente após reload. Próxima cobrança verificada via contrato oficial Cakto e vínculo de pedido/fatura no Command #218; não estima se indisponível. Gestão/cancelamento por portal oficial independente somente para contrato Cakto comprovado (sem mutação local). Recibo e migração direta de oferta continuam abertos. Novo HEAD ainda UNCERTIFIED.
- IF-P1-02: usar contrato real NFCore #542 para A1; validade de readback apresentada/limpa em erro, substituição usa a mesma delegação e provisionamento atômico do Vault. Sem inventar revogação ou fingerprint: NFCore ainda não fornece contrato S2S dessas operações; coordenação na issue #524. Nenhum PFX/senha cruza IRON.
- IF-P1-01: preservar academia/treino/financeiro/alertas já construídos; certificar apenas composição final e corrigir falhas concretas.
- IF-P1-03: #110 somente refinamentos remanescentes; remoção UUID #126 e histórico #127/#130 concluídos no código. O23 para mudanças visuais conforme governança; curadoria profissional externa.
- IF-Q/R/S/T: evidências prévias são reaproveitáveis por SHA; executar gates obrigatórios na candidata final. Não repetir CI verde sem alteração relevante. Testes físicos/provider ficam segregados.
- Checkpoint canônico e ordem permanente: AGENTES.md backend e issue #243. Sem cronograma paralelo.

## Procedimento
AUDITAR → IMPLEMENTAR DELTAS ACUMULADOS → TESTAR alterações → DIFF → CI FINAL → MERGE SE GATE VERDE → PÓS-MERGE. Não abrir PR por correção pequena; preservar gates automáticos. Sempre registrar repos, branch, SHA, PR, CI, ambiente, bloqueador e próxima ação. Não inventar PASS.

### CURRENT — recibos, legibilidade e fechamento residual
#132 amplia área comercial com reenvio de comprovante Cakto apenas para fatura paga e referência autorizada, sem enviar e-mail arbitrário, sem comprovar entrega. Backend #277/Command #218 governam segurança e rate limit. Refinamento O23 preserva asset/verde oficial, melhora contraste, legendas, hierarquia Cockpit e tamanho de alvos interativos; revisão visual real ainda necessária. CI da revisão anterior #44443766278 SUCCESS; novo HEAD necessita gate. Sem merge, deploy ou homologação.

### CURRENT — P6 retirada local A1
NFCore #562 + backend #277: UI de proprietário com confirmação explícita de retirada no cofre, somente HOMOLOG e vínculo ativo; status ABSENT apenas com readback NFCore. Sem efeito sobre revogação ICP-Brasil, sem certificado real, sem alteração fiscal oficial. Teste focado adicionado; CI da nova HEAD necessária.


### CURRENT 19/11/2026 — P3 integrado, saldo P6/O23
- PR #133 funcional, sem refinamento de estilos, MERGED na main `73c1a263632135fd4a41a924001e011931e67023`; CI pré-merge #44614672989 SUCCESS. CI pós-merge #44625645098 em execução no checkpoint. #132 reconciliada com main; permanece somente saldo P6/A1 e refinamentos #110/estilos. Preservar todos os componentes e testes do HEAD anterior. Revisão independente fiscal e aceite visual específico ainda exigidos; sem produção ou deploy neste checkpoint.
