# Research: Login e Autenticação

**Feature**: 001-login-auth  
**Date**: 2026-03-31

## Decisão 1: Autenticação com username via better-auth

**Decision**: Usar better-auth com o plugin `username` para autenticação por username + senha.

**Rationale**: better-auth oferece nativamente o plugin `username` (`better-auth/plugins`) que estende o autenticador email/password para suportar login por username. O plugin é leve, bem documentado e se integra com o adapter Drizzle. A configuração é mínima:

```typescript
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

export const auth = betterAuth({
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })]
})
```

O cliente usa `authClient.signIn.username({ username, password })`.

**Alternatives considered**:
- NextAuth.js (next-auth): Mais popular, mas com API menos direta para username-based auth e migração recente para v5 com breaking changes.
- Lucia Auth: Descontinuado oficialmente em 2024, recomenda better-auth como alternativa.
- Auth.js: Focado em OAuth/social login, username/password é secundário.

## Decisão 2: Desabilitar sign-up na API

**Decision**: Configurar `emailAndPassword.disableSignUp: true` no better-auth para bloquear criação de contas via API.

**Rationale**: Mesmo sem página de cadastro no frontend, better-auth expõe rotas de API (como `/api/auth/sign-up/email`). Desabilitar no servidor garante que contas só podem ser criadas via banco de dados direto, conforme FR-002.

**Alternatives considered**:
- Apenas não ter página de cadastro: Insuficiente — a rota de API continuaria acessível.
- Middleware bloqueando rota de sign-up: Complexidade desnecessária quando a config nativa resolve.

## Decisão 3: Sessão de 7 dias com cookie persistente

**Decision**: Configurar `session.expiresIn: 604800` (7 dias em segundos) e `session.updateAge: 86400` (refresh diário). Cookies com `httpOnly: true`, `secure: true`, `sameSite: "lax"`.

**Rationale**: better-auth suporta `expiresIn` em segundos. O `updateAge` de 1 dia renova o token de sessão a cada 24h de atividade, mantendo o cookie válido por 7 dias desde o último uso. Cookies `httpOnly` + `secure` previnem XSS e MITM.

```typescript
session: {
    expiresIn: 604800,    // 7 dias
    updateAge: 86400,     // refresh a cada 24h
    cookieCache: { enabled: true, maxAge: 300 } // cache de 5min para reduzir queries
}
```

**Alternatives considered**:
- JWT stateless: Mais complexo para invalidação de sessão (logout). Session-based com DB é mais simples e seguro.
- Expiração fixa sem refresh: Forçaria re-login a cada 7 dias mesmo com uso diário.

## Decisão 4: Proteção de rotas via Next.js middleware

**Decision**: Usar Next.js middleware com `getSessionCookie` do better-auth para proteger rotas.

**Rationale**: better-auth fornece `getSessionCookie` de `better-auth/cookies` para verificar presença do cookie de sessão no middleware. É leve (não faz query ao DB), executa no edge, e cobre todas as rotas via matcher.

```typescript
import { getSessionCookie } from "better-auth/cookies"

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)
    if (!sessionCookie && !request.nextUrl.pathname.startsWith("/login")) {
        return NextResponse.redirect(new URL("/login", request.url))
    }
    if (sessionCookie && request.nextUrl.pathname === "/login") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
}
```

**Alternatives considered**:
- Server-side check em cada page: Duplicação de lógica, mais verboso.
- Layout-level auth check: Não cobre API routes e permite flash de conteúdo.

## Decisão 5: Rate limiting via better-auth built-in

**Decision**: Usar o sistema de rate limiting nativo do better-auth com configuração customizada: 3 requests/minuto nas rotas de sign-in, bloqueio de 5 minutos.

**Rationale**: better-auth suporta `rateLimit` como array de regras com `pathMatcher`, `limit` e `window`. Evita dependência externa para rate limiting.

```typescript
rateLimit: {
    window: 60,   // 1 minuto
    max: 3,       // 3 tentativas
}
```

**Alternatives considered**:
- Rate limiting no middleware Next.js: Mais complexo, requer storage externo (Redis).
- Cloudflare/Vercel rate limiting: Dependente de plataforma de deploy.

## Decisão 6: Drizzle ORM com adapter better-auth

**Decision**: Usar `drizzleAdapter` do better-auth com provider `pg` para conectar ao PostgreSQL via Drizzle.

**Rationale**: better-auth tem adapter nativo para Drizzle que gerencia as tabelas de auth (user, session, account, verification). O schema pode ser gerado via CLI do better-auth (`npx @better-auth/cli generate`) e customizado com campos adicionais.

```typescript
import { drizzleAdapter } from "better-auth/adapters/drizzle"
database: drizzleAdapter(db, { provider: "pg" })
```

**Alternatives considered**:
- Adapter genérico (Kysely): Menos type-safe, sem integração direta com o schema Drizzle.
- PostgreSQL pool direto: Perde tipagem e migrations do Drizzle.

## Decisão 7: Docker Compose para desenvolvimento

**Decision**: Docker Compose com 2 serviços: `db` (PostgreSQL 16) e `app` (Next.js com Bun). Volume persistente para dados do PostgreSQL.

**Rationale**: Docker Compose permite subir todo o ambiente com `docker compose up`. O PostgreSQL roda em container isolado, a aplicação Next.js com Bun como runtime. Migrations executadas automaticamente no startup.

**Alternatives considered**:
- Apenas PostgreSQL em Docker + app local: Funciona, mas não garante reprodutibilidade do ambiente completo.
- DevContainers: Mais pesado, overkill para este projeto.

## Decisão 8: Estrutura de projeto Next.js App Router

**Decision**: Usar Next.js App Router com a estrutura de camadas definida na constituição do projeto.

**Rationale**: A constituição exige camadas `app/api/`, `lib/services/`, `lib/repositories/`, `lib/domain/`. O App Router do Next.js se alinha naturalmente com `app/api/` para route handlers e `app/` para pages/layouts.

**Alternatives considered**:
- Pages Router: Legado, sem suporte a Server Components nativos.
- Estrutura flat: Viola a constituição (Princípio VI).

## Decisão 9: Seed de usuários para desenvolvimento

**Decision**: Criar um script de seed com Drizzle que insere um usuário de teste no banco. O script será executável via `bun run db:seed`.

**Rationale**: Como contas são criadas diretamente no banco (FR-002), um seed script é necessário para desenvolvimento e testes. O seed usa a mesma lógica de hashing do better-auth para garantir senhas válidas.

**Alternatives considered**:
- Migration com INSERT: Menos flexível, mistura schema com dados.
- Script SQL puro: Perde a integração com o hashing do better-auth.