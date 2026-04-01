# Data Model: Login e Autenticação

**Feature**: 001-login-auth  
**Date**: 2026-03-31

## Entidades

### User

Gerenciada pelo better-auth com campos adicionais via plugin `username`.

| Campo       | Tipo                   | Restrições                                              |
| ----------- | ---------------------- | ------------------------------------------------------- |
| id          | text (cuid/uuid)       | PK, gerado automaticamente pelo better-auth             |
| name        | text                   | NOT NULL                                                |
| username    | varchar(30)            | UNIQUE, NOT NULL, alfanumérico + underscore, 3-30 chars |
| email       | text                   | UNIQUE, NOT NULL (exigido pelo better-auth)             |
| image       | text                   | NULL (campo padrão do better-auth, não usado)           |
| createdAt   | timestamptz            | NOT NULL, DEFAULT NOW()                                 |
| updatedAt   | timestamptz            | NOT NULL, DEFAULT NOW()                                 |

**Notas**:
- O campo `email` é exigido pelo schema base do better-auth. Como o login é por username, o email serve apenas como dado de contato.
- O campo `image` vem do schema padrão do better-auth. Pode ser ignorado (nullable).
- Contas são criadas diretamente no banco de dados via seed/script (FR-002).
- O campo `username` é adicionado pelo plugin `username` do better-auth.

### Session

Gerenciada automaticamente pelo better-auth.

| Campo       | Tipo            | Restrições                                          |
| ----------- | --------------- | --------------------------------------------------- |
| id          | text            | PK, gerado automaticamente                         |
| userId      | text            | FK → User.id, NOT NULL, INDEX                       |
| token       | text            | UNIQUE, NOT NULL (token da sessão)                  |
| expiresAt   | timestamptz     | NOT NULL (createdAt + 7 dias)                       |
| ipAddress   | text            | NULL (IP do cliente, para rate limiting)             |
| userAgent   | text            | NULL (User-Agent do navegador)                      |
| createdAt   | timestamptz     | NOT NULL, DEFAULT NOW()                             |
| updatedAt   | timestamptz     | NOT NULL, DEFAULT NOW()                             |

**Notas**:
- Sessões expiram automaticamente após 7 dias (`expiresIn: 604800`).
- Múltiplas sessões simultâneas são permitidas (mesmo userId pode ter N sessões ativas).
- O `token` é armazenado em cookie httpOnly no navegador.
- `ipAddress` é rastreado para rate limiting.

### Account

Gerenciada automaticamente pelo better-auth (tabela de vinculação auth provider).

| Campo             | Tipo        | Restrições                            |
| ----------------- | ----------- | ------------------------------------- |
| id                | text        | PK                                    |
| userId            | text        | FK → User.id, NOT NULL, INDEX         |
| accountId         | text        | NOT NULL                              |
| providerId        | text        | NOT NULL (valor: "credential")        |
| password          | text        | NULL (hash da senha)                  |
| createdAt         | timestamptz | NOT NULL                              |
| updatedAt         | timestamptz | NOT NULL                              |

**Notas**:
- Para autenticação email/password, `providerId = "credential"` e `password` contém o hash.
- O better-auth separa credenciais da tabela user por design (suporta múltiplos providers por usuário).

### Verification (opcional)

Gerenciada automaticamente pelo better-auth. Não será utilizada nesta feature (sem verificação de email nem reset de senha), mas a tabela é criada pelo schema padrão.

| Campo       | Tipo        | Restrições       |
| ----------- | ----------- | ---------------- |
| id          | text        | PK               |
| identifier  | text        | NOT NULL         |
| value       | text        | NOT NULL         |
| expiresAt   | timestamptz | NOT NULL         |
| createdAt   | timestamptz | NOT NULL         |
| updatedAt   | timestamptz | NOT NULL         |

## Relacionamentos

```
User 1 ←→ N Session     (um usuário pode ter múltiplas sessões ativas)
User 1 ←→ N Account     (um usuário tem pelo menos 1 account do tipo "credential")
```

## Índices

| Tabela   | Colunas         | Tipo   | Justificativa                             |
| -------- | --------------- | ------ | ----------------------------------------- |
| user     | username        | UNIQUE | Login por username (busca frequente)       |
| user     | email           | UNIQUE | Restrição do better-auth                  |
| session  | userId          | INDEX  | FK — busca de sessões por usuário          |
| session  | token           | UNIQUE | Lookup de sessão por token (cada request)  |
| account  | userId          | INDEX  | FK — busca de account por usuário          |

## Validações (Domain Layer)

| Campo           | Regra                                    | Onde aplicar          |
| --------------- | ---------------------------------------- | --------------------- |
| username        | `/^[a-zA-Z0-9_]{3,30}$/`                | Zod schema + DB check |
| password (input)| Mínimo 6 caracteres, não vazio           | Zod schema            |
| password (store)| Hash via better-auth (bcrypt/argon2)     | better-auth internal  |
| email           | Formato válido de email                  | Zod schema            |