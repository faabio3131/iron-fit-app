# IRON Web — C6 Integration Settings Functional Surface

Status: CANDIDATE.

A Web comercial recebe uma superfície funcional de Integrações para OWNER/MANAGER.

- leitura mostra somente metadata e estado;
- segredo é write-only;
- campo de credencial usa entrada mascarada;
- credencial e step-up drafts são limpos após operação;
- nenhum segredo é persistido em storage local;
- tenant não é enviado pelo cliente; backend deriva da sessão;
- OWNER cria/configura/rotaciona/verifica/revoga;
- MANAGER possui consulta, mas mutações permanecem OWNER-only no backend;
- providers só aparecem quando adapters forem registrados/homologados.

Este é acabamento funcional de C6. O Visual Premium definitivo permanece no Macrobloco O.
