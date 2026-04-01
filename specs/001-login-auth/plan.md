# Implementation Plan: Login e Autenticação

**Branch**: `001-login-auth` | **Date**: 2026-03-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-login-auth/spec.md`

## Summary

Implementar autenticação por username e senha no AudioBook Track usando better-auth com plugin `username`, Drizzle ORM com PostgreSQL, e Next.js App Router. O sistema não permite cadastro via interface (contas criadas diretamente no banco). Sessões persistem por 7 dias com cookies seguros. Todas as rotas são protegidas via middleware, com sidebar global contendo link para Dashboard e logout. Ambiente de desenvolvimento containerizado com Docker Compose.

## Technical Context

**Language/Version**: TypeScript 5.x, Bun como runtime  
**Primary Dependencies**: Next.js (latest), better-auth, Drizzle ORM, shadcn/ui, Tailwind CSS, Lucide React, Zod, react-hook-form, @hookform/resolvers  
**Storage**: PostgreSQL 16 (Docker)  
**Testing**: Vitest (unitários), Supertest (e2e), Faker.js (dados de teste)  
**Linting**: Biome  
**Target Platform**: Web (desktop browser), Node.js/Bun server  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: LCP < 1s (constituição), login completo < 10s (SC-001)  
**Constraints**: Sessão 7 dias, rate limit 3 req/min em auth, sem cadastro via UI  
**Scale/Scope**: Uso pessoal/pequeno time, poucos usuários simultâneos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notas |
| --------- | ------ | ----- |
| I. Capítulo como Unidade | N/A | Esta feature não envolve capítulos |
| II. Precisão Financeira | N/A | Sem cálculos financeiros |
| III. Ciclo de Vida do Capítulo | N/A | Sem transições de status |
| IV. Simplicidade (YAGNI) | PASS | Apenas login, sidebar mínima, dashboard placeholder |
| V. TDD | PASS | Testes antes da implementação, cobertura >= 80% |
| VI. Arquitetura Limpa | PASS | Camadas: app/api → lib/services → lib/repositories → lib/domain |
| VII. Frontend Composição | PASS | shadcn/ui para primitivos, Server Components por padrão |
| VIII. Performance | PASS | Server Components, LCP < 1s target |
| IX. Design Tokens | PASS | Tailwind config, sem valores hardcoded |
| X. API REST | PASS | Rotas better-auth seguem padrão, validação com Zod |
| XI. PostgreSQL | PASS | Drizzle ORM, timestamptz, índices em FKs |
| XII. Anti-Padrões | PASS | Sem `any`, sem console.log, sem fetch em useEffect |
| XIII. KPIs | N/A | Dashboard com placeholders apenas |
| XIV. PDF Viewer | N/A | Sem PDF nesta feature |

**Gate Result**: PASS — Nenhuma violação identificada.

## Project Structure

### Documentation (this feature)

```text
specs/001-login-auth/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Decisões técnicas e alternativas
├── data-model.md        # Modelo de dados (User, Session, Account)
├── quickstart.md        # Guia de setup do ambiente
├── contracts/
│   └── auth-api.md      # Contratos das rotas de autenticação
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Tarefas (gerado via /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   └── login/
│       └── page.tsx              # Página de login (Server Component com form client)
├── (authenticated)/
│   ├── layout.tsx                # Layout autenticado com sidebar
│   └── dashboard/
│       └── page.tsx              # Dashboard com placeholders para KPIs/gráficos
├── api/
│   └── auth/
│       └── [...all]/
│           └── route.ts          # Catch-all better-auth route handler
└── layout.tsx                    # Root layout (fonts, providers)

middleware.ts                     # Proteção de rotas (getSessionCookie)

lib/
├── auth/
│   ├── server.ts                 # Config better-auth server (plugins, session, adapter)
│   └── client.ts                 # createAuthClient para browser
├── db/
│   ├── index.ts                  # Instância Drizzle (pg pool)
│   ├── schema.ts                 # Schema: user, session, account, verification
│   ├── migrate.ts                # Script de migration
│   └── seed.ts                   # Seed: usuário de teste
└── validations/
    └── auth.ts                   # Zod schemas (loginSchema)

components/
├── ui/                           # shadcn/ui (Button, Input, Card, Label, Toaster, Toast)
├── features/
│   └── auth/
│       └── login-form.tsx        # Formulário de login (use client, react-hook-form + zod resolver)
└── layout/
    └── sidebar.tsx               # Sidebar com nav + logout

docker-compose.yml                # PostgreSQL + App
Dockerfile                        # Multi-stage build com Bun
.env.example                      # Template de variáveis de ambiente
drizzle.config.ts                 # Config do Drizzle Kit

__tests__/
├── unit/
│   └── validations/
│       └── auth.test.ts          # Testes do schema Zod
├── integration/
│   └── auth/
│       └── auth.test.ts          # Testes de autenticação (better-auth)
└── e2e/
    └── auth/
        └── login.test.ts         # Testes e2e com Supertest
```

**Structure Decision**: Next.js App Router com route groups `(auth)` e `(authenticated)` para separar layouts público e autenticado. Camadas `lib/` seguem a constituição (Princípio VI). Componentes seguem a hierarquia definida no Princípio VII: `ui/` (shadcn), `features/` (composição), `layout/` (estruturais).

**Padrões de UX**:
- **Formulários**: react-hook-form com `@hookform/resolvers/zod` para validação client-side, conforme recomendado pelo shadcn/ui.
- **Erros do backend**: Exibidos como toasters (shadcn/ui Toast/Sonner) — notificações temporárias no canto da tela. Erros de validação inline são exibidos nos campos via react-hook-form.

## Complexity Tracking

### Exceções de constituição documentadas

| Princípio | Exceção | Justificativa |
| --------- | ------- | ------------- |
| VI. Arquitetura Limpa | Ausência de `lib/services/` e `lib/repositories/` para autenticação | better-auth encapsula internamente acesso a dados (repository) e orquestração (service). Criar wrappers seria abstração desnecessária — justificado pelo Princípio IV (YAGNI). As camadas service/repository serão criadas para o domínio do negócio (livros, capítulos, estúdios) em features futuras. |
| X. API REST envelope | Rotas `/api/auth/*` não seguem o envelope padrão `{ "data": {...} }` / `{ "error": {...} }` | Rotas de autenticação são gerenciadas pelo better-auth via catch-all handler, com formato de resposta próprio da biblioteca. Interceptar e reformatar todas as respostas adicionaria complexidade sem benefício. O envelope padrão da constituição será aplicado em todas as rotas de API do domínio (livros, capítulos, pagamentos). |