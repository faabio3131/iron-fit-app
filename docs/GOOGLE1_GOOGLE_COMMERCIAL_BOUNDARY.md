# GOOGLE-1 — Google commercial boundary

Status: **GOVERNANCE CONFLICT — fail-closed in tenant UI**.

## CURRENT comprovado

O backend registra o provider `google` com:

- capability técnica `google.oauth`;
- autenticação `OAUTH2`;
- refresh governado;
- revoke governado;
- binding tenant por `IntegrationConnection + Vault`.

A Launch Matrix vigente contém `channel.google = LAUNCH` e os planos V1 concedem `integration.google`.

Porém, a auditoria do CURRENT não identificou um consumidor comercial que transforme `google.oauth` em uma função de negócio do IRON V1. Não existe evidência nesta entrega de Google Calendar, Gmail, Drive ou qualquer outra função Google ligada ao produto.

## Tratamento seguro aplicado

O Integration Center não oferece nova conexão Google enquanto a finalidade comercial não estiver definida e implementada.

A infraestrutura OAuth existente não é apagada, pois continua sendo uma fundação técnica reutilizável. Conexões históricas, se existirem, permanecem sob a autoridade do backend e podem ser revogadas conforme o lifecycle já implementado.

## Governança

A própria autoridade da Launch Matrix define Google como decisão humana opcional. Portanto esta entrega **não altera silenciosamente** `channel.google` de LAUNCH para OUT.

Para fechar GOOGLE-1 é necessário um dos dois caminhos governados:

1. definir e implementar a finalidade comercial Google V1, com capability específica e consumidor real; ou
2. aprovar formalmente a retirada de Google do launch e materializar nova decisão de Launch Matrix/entitlements.

Até essa decisão, a superfície tenant permanece fail-closed e não promete Google como funcionalidade comercial.
