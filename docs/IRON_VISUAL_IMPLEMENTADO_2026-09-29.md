# IRON — aplicação da identidade aprovada — 29/09/2026

## Escopo e autoridade

Incremento sobre a aplicação real da PR #22, branch `visual/macro-o-premium`, partindo de `26ca26c70ade9b179cca74a4c9a9654c77068e29`.
O usuário aprovou a identidade azul apresentada e autorizou implantar. Essa aprovação não certifica superfícies O0–O22 ainda não verificadas.
Referência de origem: `docs/IRON_PADRAO_VISUAL_SITE_OFICIAL.md` e site oficial no commit `da9ab7c6755d76c7a1d842a2c1c279582d812243`.

## Implementação

- Ativo estático azul `assets/brand/iron-fit-core-blue.webp`, derivado com edição assistida por imagem do lockup do site, aprovado pelo usuário e otimizado em WebP. É uma adaptação aprovada, não um arquivo azul original recuperado do site. Sem hue-rotate no produto.
- Tokens navy/azul/ciano; aplicação da paleta nas superfícies Web e mobile existentes. Verde permanece exclusivamente em estados semânticos de sucesso.
- Login, trial, recuperação e seleção de academia compartilham composição responsiva, marca, foco visível e nomes acessíveis nos inputs. Mantidos handlers, política de senha, MFA, idempotência e seleção de tenant.
- Shell Web usa a marca aprovada, navegação com estado acessível, alvos de toque e correção da largura da navegação compacta.
- Cockpit apresenta KPIs, séries de receita/frequência, vencidos e aniversariantes das APIs existentes. Dados ausentes não viram zero. Drill-down respeita módulos visíveis.
- Listagens comuns deixam de serializar objetos de API e exibem campos explicitamente permitidos com rótulos. Propriedades desconhecidas e credenciais aninhadas não são renderizadas.
- Valores de Charge/FinancialTransaction no novo cockpit e nas listagens são formatados em BRL a partir de centavos: confirmado em `prisma/seed.ts` e transferência de `charge.amount` para transações no serviço financeiro.
- Textos técnicos de implementação substituídos por orientações de uso, preservando bloqueios e controles existentes.

## Validação local

- Typecheck: PASS.
- ESLint: PASS, sem warnings de lint.
- Jest: 70 PASS, 0 FAIL, 1 teste live ignorado por falta de configuração externa (não certificado por esta rodada).
- Expo export Web: PASS.
- Novas regressões: zero versus dado ausente, centavos, séries acessíveis e lista explícita de campos sem credenciais.
- Cinco verificações antigas de cópia/branding atualizadas para a identidade e os textos atuais; verificações de API, tenant, entitlement e bloqueio comercial preservadas.

## Limites e próximo gate

Este incremento não certifica todo o Macro O nem o GO comercial. Ainda exigem revisão específica as superfícies completas de domínio, tablet/Android/iOS em dispositivo e os fluxos dependentes de provedores/schema.
Mantidos os bloqueadores externos já registrados: 15 migrations pendentes exigindo evidência de backup/restore; integrações sem schema no banco e homologação/credenciais externas pendentes.
Próximo passo: CI do novo SHA → deploy do preview real → smoke visual de autenticação, cockpit e navegação → registrar evidências. PR permanece Draft enquanto não houver evidência suficiente para O23/O24 integral.

## CI e ajuste responsivo

- CI `36644675234` do commit `55b8a5319a81e33f8d880f7f1f13c916eee0ead7`: SUCCESS, incluindo auditoria high, testes, exports Android/iOS/Web e smoke HTTP do container.
- Ajuste posterior `bb5c40161ecb1f1d853b5dd0d90b5350d5163a29`: permitir redução de cards e detalhes em larguras estreitas. Typecheck/lint PASS; Jest 70 PASS, 0 FAIL, 1 live ignorado.
- A atualização de ref desse ajuste retornou erro transitório do conector após aplicar o ref; confirmação por API e git confirmou o SHA. A PR/CI ainda não refletiu o head na consulta seguinte. Este checkpoint mantém rastreabilidade; deploy só após confirmação do CI da árvore final.

## Preview e revisão publicada

- CI final da primeira publicação: `36645161558` SUCCESS, commit `7538ccaafe10bf0cdb77637b7a5ba59592487977`.
- Render: `dep-dau4jk6gekts73cuf8ig`, LIVE em 29/09/2026 23:30:19 UTC (20:30:19 BRT), preview `https://iron-macro-o-preview.onrender.com/`.
- Browser: login, trial, recuperação, sessão OWNER real e drill-down Alunos carregaram. Marca carregada; largura do documento 1363px = viewport, sem overflow horizontal desktop. Controle de senha do trial alternou estado com campo vazio. Nenhuma conta/cobrança criada nessa revisão.
- Backend readiness HTTP 200/Postgres up às 23:31:26 UTC; reidratação inicial da sessão demorou antes de concluir. Não houve certificação de performance nesta rodada.
- Revisão visual identificou rótulos de datas comprimidos no gráfico de receita. Corrigido com faixa de datas independente das colunas e mensagem explícita quando todos os valores são zero. Novo teste de série zero: 71 PASS, 0 FAIL, 1 live ignorado; typecheck/lint PASS.
- Capturas do login/trial publicadas acompanham este checkpoint. A captura final do cockpit deve ser feita após republicar a correção do gráfico.
