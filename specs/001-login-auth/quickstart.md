# Quickstart: Login e Autenticação

**Feature**: 001-login-auth  
**Date**: 2026-03-31

## Pré-requisitos

- Docker e Docker Compose instalados
- Bun instalado (runtime)
- Git

## Setup do ambiente

```bash
# 1. Clone o repositório
git clone <repo-url>
cd audio-book-track

# 2. Copie as variáveis de ambiente
cp .env.example .env

# 3. Suba o ambiente (PostgreSQL + App)
docker compose up -d

# 4. Execute as migrations
bun run db:migrate

# 5. Execute o seed (cria usuário de teste)
bun run db:seed
```

## Credenciais de teste

| Username   | Senha      | Nome          |
| ---------- | ---------- | ------------- |
| admin      | admin123   | Administrador |

## Acessando a aplicação

1. Abra `http://localhost:3000` no navegador
2. Você será redirecionado para `/login`
3. Informe as credenciais de teste
4. Após login, será redirecionado ao `/dashboard`

## Scripts disponíveis

| Comando               | Descrição                                    |
| --------------------- | -------------------------------------------- |
| `bun run dev`         | Inicia o servidor de desenvolvimento         |
| `bun run build`       | Build de produção                            |
| `bun run db:migrate`  | Executa migrations pendentes                 |
| `bun run db:seed`     | Insere dados de teste no banco               |
| `bun run db:studio`   | Abre o Drizzle Studio (visualizador do DB)   |
| `bun run test`        | Executa testes unitários (Vitest)            |
| `bun run test:e2e`    | Executa testes e2e (Supertest)               |
| `bun run lint`        | Executa lint (Biome)                         |
| `bun run lint:fix`    | Corrige problemas de lint automaticamente    |

## Variáveis de ambiente

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audiobook_track

# Better Auth
BETTER_AUTH_SECRET=<random-secret-string>
BETTER_AUTH_URL=http://localhost:3000

# App
NODE_ENV=development
```

## Estrutura de diretórios (auth)

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx          # Página de login
├── (authenticated)/
│   ├── layout.tsx            # Layout com sidebar
│   └── dashboard/
│       └── page.tsx          # Dashboard com placeholders
├── api/
│   └── auth/
│       └── [...all]/
│           └── route.ts      # Catch-all route handler do better-auth
└── layout.tsx                # Root layout
middleware.ts                 # Proteção de rotas

lib/
├── auth/
│   ├── server.ts             # Configuração better-auth (servidor)
│   └── client.ts             # Cliente better-auth (browser)
├── db/
│   ├── index.ts              # Instância Drizzle
│   ├── schema.ts             # Schema (tabelas auth)
│   ├── migrate.ts            # Script de migration
│   └── seed.ts               # Script de seed
└── validations/
    └── auth.ts               # Schemas Zod para login

components/
├── ui/                       # shadcn/ui primitivos (Button, Input, Card, Label, Toaster)
├── features/
│   └── auth/
│       └── login-form.tsx    # Formulário de login (react-hook-form + zod)
└── layout/
    └── sidebar.tsx           # Sidebar de navegação
```