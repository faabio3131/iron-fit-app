# Macro O — refinamento de densidade visual

Pedido: reduzir lacunas/cards e altura superior; ampliar ligeiramente a logo, conforme captura do usuário em 29/09/2026.

CURRENT de partida: iron-fit-app, visual/macro-o-premium, PR #22 Draft, HEAD 90b04150ca0795d59f5dcda2d0a0d221407ecc34. Incremento do cockpit/shell em Macro O; não encerra O23/O24.

Alterações exclusivamente de estilos:
- Logo compacta: 150 → 160 px, proporção original preservada, sem corte ou filtro.
- Cabeçalho: padding vertical 8 → 0 px, altura resultante esperada de aproximadamente 106 → 96 px em desktop, acomodando a marca maior.
- Navegação: largura 252 → 232 px; espaçamento vertical menor; alvos de toque continuam com pelo menos 44 px.
- Conteúdo: padding 26 → 18 px; distância do título 20 → 14 px.
- Indicadores: padding 22 → 16 px, espaços internos e entre cards reduzidos.
- Painéis: padding 24 → 18 px, estados vazios 28 → 12 px, gráficos 160 → 140 px.
- Seções comuns: padding 24 → 18 px; mantidos flex-wrap, redução de largura e rolagem existentes.

Validação local: typecheck, lint, suíte Jest, export Web e git diff --check concluídos com código de saída 0. Teste externo continua condicionado à configuração existente. Nenhuma alteração em handlers, sessão, tenant, RBAC, entitlements, APIs ou dados.

Publicação: CI do novo SHA e deploy manual do serviço iron-macro-o-preview pendentes no momento deste commit; resultado final deve constar do checkpoint da PR #22. Merge visual não realizado. Bloqueadores gerais de schema/integrações já documentados permanecem; este ajuste não certifica GO-LIVE.
