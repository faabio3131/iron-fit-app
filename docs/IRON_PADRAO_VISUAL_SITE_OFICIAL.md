# IRON FIT CORE — padrão extraído do site oficial

Referência indicada pelo usuário em 29/09/2026: página IRON FIT dentro do site FM Tecnologia. Destino de aplicação: SaaS IRON existente, PR #22, sem alterar contratos ou criar produto paralelo.

## Proveniência e limite da inspeção

- Repositório oficial: faabio3131/fm-tecnologia-web-platform.
- main consultada: da9ab7c6755d76c7a1d842a2c1c279582d812243.
- Rota confirmada no código: https://fmtecnologiaia.com.br/produtos/iron-fit.
- Fonte da página: src/components/marketing/iron-fit-core-landing.tsx; product-page.tsx seleciona IronFitCoreLanding para o slug iron-fit.
- app/layout.tsx carrega ironfit-core.css, ironfit-core-expanded.css, ironfit-hero-identity-fix.css e outros estilos, terminando em fm-public-site-premium.css. A extração considera essa cascata, não somente o CSS inicial ou o arquivo de imagem isolado.
- Home e rota IRON retornaram 502/Connection refused neste navegador. Os padrões abaixo são confirmados no código oficial; não constituem comprovação visual do deploy público neste instante.

## Identidade

- Nome: IRON FIT CORE.
- Slogan: Inteligência no centro. Evolução em movimento.
- Assinatura: by FM Tecnologia.
- Linguagem: português; operação de academia, treino, aluno e evolução. Preservar a identidade própria do IRON dentro da família FM.

## Paleta confirmada

| Uso | Valor do site |
|---|---|
| Azul primário IRON | #2f91ff |
| Ciano de apoio | #67d6ff |
| Foco/interação | #58baff |
| Fundo da página IRON | #030811 |
| Base compartilhada FM | #050b14 |
| Fundo elevado | #071629 |
| Superfície IRON | #071528 |
| Superfície elevada IRON | #0a1b31 |
| Painel de destaque | #08182d |
| Texto principal IRON | #eef7ff |
| Texto principal global | #f7fbff |
| Texto de apoio | #91a5bb |
| Texto secundário global | #9fb0c5 |
| Borda de cards | rgba(103,214,255,.15) |
| Borda de painéis | rgba(103,214,255,.16) |

Hero: gradiente 135deg de #030811 para #071629 e #050b14, com iluminação radial azul discreta. Cards: gradiente 145deg de #0a1b31 para #071528. Painéis maiores: gradiente 145deg de #08182d para #050b14. O azul/ciano é destaque; fundos permanecem escuros.

## Tipografia, componentes e composição

- Fonte do código atual: Arial, sans-serif, tanto corpo quanto display. Não foi encontrada fonte premium externa que justifique afirmar uso de Inter ou outra família.
- Corpo: line-height global 1.55; lead IRON 1.58, cerca de 1rem–1.15rem.
- Título principal desktop: clamp(3rem,5.3vw,5rem), line-height .91, letter-spacing -.055em. No mobile: clamp(2.65rem,12vw,3.35rem). Esses tamanhos são do marketing e devem ser adaptados à densidade operacional do SaaS.
- Slogan: clamp(1.15rem,1.8vw,1.55rem). Eyebrows pequenos, peso forte, caixa alta e espaçamento entre letras.
- Botão primário específico do IRON: fundo #2f91ff, texto branco e borda azul; prevalece sobre o gradiente global por seletor específico com !important. Altura mínima global 44px, peso 700, forma arredondada.
- Botão secundário: fundo escuro translúcido, borda azul/ciano sutil e texto claro. Foco visível: contorno 3px #58baff, offset 4px.
- Cards operacionais de marketing: raio 20px, padding 24px, gap 14px; financeiro usa raio 18px. Painel Core: raio 24px. Aplicação no SaaS deve preservar contraste, foco e leitura, sem copiar a composição de uma landing page para todas as telas.
- Logo: centralizada no próprio quadro, proporção preservada, sem recorte. Quadro desktop com raio 24px e imagem interna com raio 18px; largura máxima do lockup 520px no hero. Em mobile, máximo 390px e dimensões responsivas.
- Hero em duas colunas no desktop, uma coluna abaixo de 900px; ajustes adicionais em 1100px, 760px e 460px. Navegação local com rolagem horizontal quando necessário.
- Linguagem visual: azul-marinho profundo, bordas finas, brilho azul controlado, halos/orbitas decorativos, cards organizados e hierarquia clara. Não transformar cada tela operacional em um hero comercial.

## Correção da análise anterior da logo

O arquivo public/iron-fit-core-official-lockup.webp mantém pixels verdes/lime (blob 1c27e900dc09b40972b950a24789df27e8721eab). Porém, a página aplica às imagens do IRON:

```css
filter: hue-rotate(108deg) saturate(1.10) brightness(1.04)
  drop-shadow(0 16px 28px rgba(0,7,25,.25)) !important;
```

Portanto, era incompleto concluir que faltava toda a referência azul olhando somente o WebP. A referência de aparência azul está definida no código oficial indicado pelo usuário. A geometria, nome e slogan da logo também estão localizados.

A existência de um arquivo azul nativo separado não foi comprovada. O Prompt Mestre do IRON proíbe hue-rotate como solução final do SaaS: a preparação de um ativo azul adequado, com a mesma geometria e identidade, permanece trabalho de implementação e validação. Não copiar o filtro para mascarar esse requisito nem inventar nova marca. A referência visual do site já pode orientar paleta, componentes e composição; não é necessário pedir novamente ao usuário qual identidade seguir.

## Estado

Padrões e fonte visual: EXTRAÍDOS DO CÓDIGO OFICIAL. Aplicação completa no SaaS: PENDENTE. O0/O23 não certificados por este documento. Nenhuma mudança no site FM, backend, banco ou funcionalidade foi feita nesta extração.
