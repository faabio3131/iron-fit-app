# Macro O — CURRENT reconciliado — 2026-10-15

## Evidências atuais verificadas
- Repositório: `faabio3131/iron-fit-app`.
- PR #22: `visual/macro-o-premium` → `main`, **aberta e Draft**, sem aprovação visual explícita e **sem merge**.
- HEAD PR/deploy: `11f3b058957fa83668b7550c4a7e63f4307540a3`.
- GitHub Actions `Mobile + Web CI` run **38256365782**, conclusão **success**, vinculada ao HEAD informado (12/10/2026). Este resultado não substitui E2E financeiro real nem aprovação visual.
- Render `iron-macro-o-preview` (service `srv-dat8lgl9fdbs7384u580`): deploy `dep-db6l62rrjlhs73f9oj30` **live**, commit `11f3b058957fa83668b7550c4a7e63f4307540a3`; URL `https://iron-macro-o-preview.onrender.com`.
- A documentação histórica `docs/O_MACRO_VISUAL_REVIEW_CHECKPOINT.md` relatava deploy de setembro; **não confundir esse checkpoint com CURRENT**.
- FM Command ↔ IRON: saúde/sync de fonte comercial já demonstrada externamente, com **5 fatos IRON** e fonte distinta do Kordena (2 fatos). Isso não é homologação de cobrança/entitlement ponta a ponta.

## Decisão expressa do proprietário
Prosseguir com **100% da implementação interna do IRON**, incluindo Visual Premium, RBAC, clique/ações, acessibilidade, QA, build, testes e correções. Reservar **para a homologação interna final após visual concluído**:
1. rota de recebimento do IRON para a conta Asaas FM Tecnologia;
2. plano comercial precificado no FM Command;
3. cadastro/vínculo de academias pagadoras reais;
4. conexões reais, Pix real e homologação de cobrança/webhook/entitlement.

Este adiamento **não libera GO-LIVE sem provas reais** e não autoriza POST financeiro/ativação de webhooks, workers ou migrações. Os trabalhos internos continuam, preservando gateway corporativo e operação Kordena. Não copiar registros de Kordena para IRON.

## Gate e próximos passos
- **Macro O ainda EM EXECUÇÃO**; CI e deploy verdes do HEAD não implicam fechamento O22/O23/O24.
- Inspecionar superfícies reais quanto a ações inoperantes, português integral, densidade visual, segregação OWNER/MANAGER/RECEPTION/TRAINER/STUDENT e domínio financeira academia vs FM billing.
- Reproduzir e corrigir falhas comprovadas com testes regressivos; executar novamente lint/typecheck/build/CI e redeploy real em HEAD exato.
- **O23:** solicitar revisão visual do usuário **somente quando** auditoria O22/preview real e gates aplicáveis passarem.
- **O24/merge:** exclusivamente após aprovação visual explícita; pós-merge e avanço P→Q→R→S→T com gates adequados.
- Registrar a cada WP: branch/HEAD/PR/CI/testes/deploy/ambiente/bloqueios; nunca substituir evidência pela documentação histórica.

Estado final deste checkpoint: **CURRENT técnico reconciliado; não é certificação final de Macro O nem homologação financeira.**
