# META-1 — Meta comercial V1

Status externo atual: **IMPLEMENTED / EXTERNAL BLOCKER**.

A Launch Matrix mantém `channel.meta = LAUNCH` e `integration.meta` como entitlement comercial. Isso não equivale a homologação física do provider.

## Função comercial V1 comprovada

A única capability Meta com consumidor comercial real no CURRENT é:

- `meta.whatsapp` → Communication Center → `CommunicationMessage` → dispatch boundary.

Facebook e Instagram continuam registrados no provider registry como capabilities técnicas, mas não possuem consumidor comercial V1 comprovado fora da infraestrutura OAuth. Por isso não são expostos como opções selecionáveis no Integration Center da V1.

## OAuth e least privilege

O Integration Center:

- usa provider `meta`;
- solicita apenas `meta.whatsapp` na superfície V1;
- não aceita scopes livres vindos do navegador;
- não envia `gymId`/`tenantId` livre;
- delega scopes ao OAuth Core/registry canônico;
- usa callback canônico;
- mantém access/refresh credentials no Vault.

## Comunicação

O Communication Center:

- cria templates WhatsApp;
- enfileira mensagens no domínio canônico;
- mostra status reais da fila;
- preserva consentimento do aluno;
- deixa preferência de WhatsApp e conexão Meta serem revalidadas pelo backend;
- não apresenta SMS, e-mail ou push como dispatch externo implementado;
- não converte falha de provider em sucesso.

## Limite externo

Não declarar Meta/WhatsApp `PRODUCTION HOMOLOGATED` ou `SANDBOX HOMOLOGATED` sem evidência reproduzível de:

- Meta App oficial/aprovado;
- credenciais reais no Vault;
- redirect/callback real;
- OAuth real no ambiente correspondente;
- scopes revisados;
- conexão tenant real;
- envio físico real;
- retry/provider outage;
- ausência de cross-tenant dispatch.

Até essas evidências existirem, a classificação operacional permanece **IMPLEMENTED / EXTERNAL BLOCKER**.
