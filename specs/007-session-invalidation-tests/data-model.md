# Data Model: Testes de Invalidacao de Sessao

**Date**: 2026-04-09  
**Branch**: `007-session-invalidation-tests`

## Nota

Esta feature e exclusivamente de testes — nao ha alteracoes no modelo de dados.

## Entidades existentes relevantes

### Session (existente, sem alteracoes)

| Campo | Tipo | Descricao |
|---|---|---|
| id | text (PK) | Identificador unico da sessao |
| token | text (unique) | Token da sessao armazenado no cookie |
| expiresAt | timestamp (tz) | Data de expiracao |
| userId | text (FK → user) | Usuario dono da sessao |
| createdAt | timestamp (tz) | Data de criacao |
| updatedAt | timestamp (tz) | Ultima atualizacao |
| ipAddress | text (nullable) | IP do cliente |
| userAgent | text (nullable) | User agent do cliente |

**Cookie relevante**: `better-auth.session_token` — armazena o token da sessao no browser.

**Ciclo de invalidacao**:
1. Cliente chama `authClient.signOut()` → better-auth deleta sessao do DB e limpa cookie
2. OU: Server detecta sessao invalida → redireciona para `/api/auth/clear-session` → deleta cookie → redirect `/login`