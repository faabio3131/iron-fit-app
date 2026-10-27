# O17 — Aggregator Hub Boundary

Status: **CANDIDATE — FAIL-CLOSED**

## CURRENT reconciliado

O domínio canônico Aggregator Hub existe no backend e inclui elegibilidade, autorização de visita, acesso provisório, operações, reconciliação, settlement e analytics.

A Launch Matrix comercial V1 classifica:

- Wellhub: `EXTERNAL_BLOCKER`;
- TotalPass: `EXTERNAL_BLOCKER`.

Os planos `IRON_V1` e `IRON_V1_TRIAL` não concedem `aggregator.wellhub` nem `aggregator.totalpass`.

## Decisão de superfície V1

Enquanto a Launch Matrix permanecer nesse estado:

- não criar menu comercial Aggregator Hub no tenant;
- não apresentar Wellhub ou TotalPass como disponíveis/live;
- não expor adapters internos como integração homologada;
- manter o backend provider-neutral existente;
- manter autorização física fail-closed;
- habilitação futura exige mudança governada da Launch Matrix, entitlement aplicável e evidência de homologação externa real.

Este boundary evita transformar código/adapters existentes em promessa comercial.
