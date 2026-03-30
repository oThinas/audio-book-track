<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0 (MINOR: new Engineering Standards section + Self-Review section added)

Modified principles:
  - Princípio V (TDD): title unchanged, content unchanged
  - Development Workflow: no changes
  - Governance: updated to reference Principles I–XII

Added sections:
  - VI. Arquitetura Limpa no Backend
  - VII. Frontend: Composição e Atomicidade
  - VIII. Performance em Primeiro Lugar
  - IX. Design Tokens para Tudo
  - X. Padrões de API REST
  - XI. PostgreSQL e Banco de Dados
  - XII. Anti-Padrões Proibidos
  - Self-Review Obrigatório (ao final)

Removed sections: N/A

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section generic; now includes
     reference to Principles I–XII; no structural change required
  ✅ .specify/templates/spec-template.md — compatible as-is; success criteria can now
     reference <1s load target
  ✅ .specify/templates/tasks-template.md — task categories compatible with new principles;
     design token and clean architecture tasks may now appear in Phase 2 (Foundational)
  ✅ .specify/templates/constitution-template.md — source template; no update needed

Follow-up TODOs:
  - None. All placeholders resolved.
-->

# AudioBook Track Constitution

## Core Principles

### I. Capítulo como Unidade de Trabalho

O capítulo é a unidade fundamental de produção e pagamento neste sistema.
Toda atribuição de responsabilidade, cálculo de ganho e rastreamento de status
DEVE ser feito no nível do capítulo.

- Cada capítulo DEVE ter exatamente um responsável pela gravação e um
  responsável pela edição em qualquer ponto do seu ciclo de vida.
- Horas editadas são registradas por capítulo — não por livro ou estúdio.
- Nenhum pagamento pode ser calculado sem um responsável definido.

**Rationale**: O fluxo de trabalho real divide-se em capítulos. Tratar o livro
como unidade de pagamento mascararia a contribuição individual de cada editor.

### II. Precisão Financeira (NÃO NEGOCIÁVEL)

Todo cálculo de ganho DEVE ser determinístico, rastreável e baseado em dados
persistidos — nunca derivado dinamicamente de valores que podem mudar.

- O preço/hora DEVE ser vinculado ao **livro**, não ao estúdio. Isso garante
  que alterações futuras no preço do estúdio não reescrevam o histórico.
- A fórmula de ganho é: `horas_editadas × preço_hora_do_livro`.
- Ganhos calculados DEVEM ser auditáveis: todas as entradas do cálculo
  (horas, preço, responsável, data) DEVEM estar disponíveis para consulta.
- Relatórios de ganho por período DEVEM ser filtráveis por capítulo, livro e
  estúdio sem perda de precisão.

**Rationale**: Erros financeiros afetam diretamente a renda dos editores.
Imutabilidade do preço histórico é obrigatória para confiabilidade do sistema.

### III. Integridade do Ciclo de Vida do Capítulo

Transições de status de capítulo DEVEM ser explícitas e validadas.
Não é permitido pular etapas do ciclo de vida.

- Estados válidos (em ordem): `não iniciado` → `em andamento` →
  `pagamento pendente` → `pago`.
- Toda transição DEVE registrar data e responsável no momento da mudança.
- Um capítulo NÃO PODE entrar em `em andamento` sem responsável de edição
  atribuído.
- Um capítulo NÃO PODE entrar em `pagamento pendente` sem horas editadas
  registradas.
- Um capítulo marcado como `pago` NÃO PODE ter seus dados financeiros
  alterados retroativamente.

**Rationale**: O status do capítulo é a fonte de verdade do progresso de
produção e do fluxo de pagamento. Transições inválidas corrompem relatórios
e cálculos de ganho.

### IV. Simplicidade Primeiro (YAGNI)

Implementar apenas o que é necessário para a funcionalidade atual. Abstrações
prematuras e generalizações hipotéticas são proibidas.

- Preferir a solução mais simples que satisfaça o requisito.
- Qualquer complexidade adicionada DEVE ser justificada por um requisito
  concreto existente.
- Não projetar para cenários hipotéticos futuros sem evidência de necessidade.

**Rationale**: Este é um sistema de uso pessoal/pequeno time. Complexidade
desnecessária aumenta custo de manutenção sem benefício real.

### V. Desenvolvimento Orientado a Testes

TDD é obrigatório para toda lógica de domínio, especialmente cálculos
financeiros. O ciclo Red → Green → Refactor DEVE ser seguido.

- Toda lógica de cálculo de ganho DEVE ter cobertura de testes unitários de
  100%.
- Transições de ciclo de vida do capítulo DEVEM ter testes de integração.
- Cobertura mínima geral: 80%.
- Testes são escritos ANTES da implementação — sem exceções.

**Rationale**: A confiabilidade dos cálculos financeiros depende de testes
abrangentes. Defeitos em pagamentos impactam diretamente pessoas reais.

## Engineering Standards

### VI. Arquitetura Limpa no Backend

O backend DEVE seguir Clean Architecture com separação estrita de camadas.
Dependências apontam sempre de fora para dentro — nunca o contrário.

**Camadas obrigatórias** (de fora para dentro):

```
app/api/          → Controllers/Route Handlers (HTTP, entrada/saída)
lib/services/     → Use Cases / Application Services (orquestração)
lib/repositories/ → Repository interfaces + implementações (dados)
lib/domain/       → Entities, value objects, regras de negócio puras
```

- Controllers DEVEM ser finos: validam input, chamam um serviço, retornam
  resposta. Nenhuma lógica de negócio nos controllers.
- Services contêm toda a orquestração: não conhecem HTTP nem SQL diretamente.
- Repositories encapsulam todo acesso a dados; a interface DEVE ser definida
  no domínio e implementada fora dele.
- Entities do domínio são POJOs puros — sem imports de framework.
- Injeção de dependência via construtor; nunca instanciar dependências dentro
  de uma classe.

**Rationale**: Em um sistema financeiro, separar regras de negócio da
infraestrutura garante que os cálculos sejam testáveis sem banco de dados
e que mudanças de storage não afetem a lógica de domínio.

### VII. Frontend: Composição e Atomicidade

O frontend DEVE separar lógica de renderização e seguir composição sobre
herança. Componentes DEVEM ser atômicos e independentes.

**Estrutura de componentes:**

```
components/ui/        → Átomos: Button, Input, Badge, Card (sem lógica de negócio)
components/features/  → Moléculas: ChapterRow, PaymentSummary (lógica de domínio)
app/                  → Pages/Layouts (Next.js App Router, SSR por padrão)
hooks/                → Custom hooks isolam lógica de estado e side effects
```

- Componentes de UI (átomos) DEVEM ser puramente visuais — apenas props e
  renderização, sem useState ou fetch.
- Lógica de estado e data fetching DEVEM residir em custom hooks ou Server
  Components — nunca inline em JSX.
- Data fetching DEVE usar Server Components com `async/await` direto quando
  os dados são necessários no servidor. Usar `use client` apenas quando
  interatividade é obrigatória.
- `fetch` no servidor DEVE usar `cache: 'no-store'` para dados mutáveis e
  `next: { revalidate: N }` para dados semi-estáticos.
- Composição via `children` e slot props é preferida a boolean props que
  alteram renderização.

**Rationale**: Separar lógica de renderização permite testar cada parte
isoladamente e facilita SSR sem hidratação desnecessária no cliente.

### VIII. Performance em Primeiro Lugar

O tempo de carregamento inicial (LCP) DEVE ser inferior a 1 segundo.
Toda decisão técnica DEVE considerar impacto na performance.

- Server Components são o padrão; `use client` é exceção justificada.
- Imagens DEVEM usar `<Image>` do Next.js com `priority` nas above-the-fold.
- Fontes DEVEM usar `next/font` com `display: swap`.
- Listas longas (> 50 itens) DEVEM usar virtualização
  (`@tanstack/react-virtual`).
- Bundle size: nenhuma dependência de cliente pode ser adicionada sem
  justificativa de que não existe alternativa server-side.
- Lazy loading obrigatório para componentes pesados com `React.lazy` +
  `Suspense`.
- HTTP cache headers DEVEM ser configurados em todas as rotas de API:
  dados estáticos `Cache-Control: public, max-age=60`; dados dinâmicos
  `Cache-Control: no-store`.
- Turbopack DEVE ser usado no desenvolvimento (`next dev` sem flags extras).

**Rationale**: Este app é pequeno — 1s de LCP é alcançável e não negociável.
Performance não é otimização prematura aqui; é requisito de qualidade.

### IX. Design Tokens para Tudo

Valores visuais (cores, espaçamentos, tipografia, bordas, sombras) DEVEM
ser definidos como design tokens no Tailwind config ou CSS custom properties.
Nenhum valor hardcoded pode aparecer em componentes.

- Tokens DEVEM ser definidos em `tailwind.config.ts` sob `theme.extend`.
- Hierarquia de tokens:
  - **Primitivos**: `color.slate.900`, `spacing.4` (valores base)
  - **Semânticos**: `color.text.primary`, `color.surface.card` (intenção)
  - **Componente**: `button.padding`, `card.radius` (quando necessário)
- Componentes DEVEM referenciar tokens semânticos, não primitivos.
- Dark mode DEVEM ser implementado via tokens CSS (`--color-text-primary`)
  mapeados no `:root` e `[data-theme="dark"]`.
- Nenhum `style={{ color: '#xxx' }}` inline é permitido.

**Rationale**: Design tokens garantem consistência visual e facilitam
mudanças de tema sem varrer todos os componentes.

### X. Padrões de API REST

Todas as rotas de API DEVEM seguir os padrões REST definidos nesta seção.

**URLs:**

- Recursos em plural, kebab-case: `/api/v1/chapter-payments`
- Sub-recursos para relacionamentos: `/api/v1/books/:id/chapters`
- Sem verbos na URL; ações excepcionais: `/api/v1/chapters/:id/mark-paid`

**HTTP e Status Codes:**

- `200` para GET/PATCH com body; `201` para POST (+ `Location` header);
  `204` para DELETE.
- `400` para JSON malformado; `422` para dados semanticamente inválidos;
  `404` para recurso inexistente; `409` para conflito de estado.
- NUNCA retornar `200` com `{ success: false }` no body.

**Response envelope:**

```typescript
// Sucesso (single)
{ "data": { ...resource } }

// Sucesso (lista)
{ "data": [...], "meta": { total, page, per_page } }

// Erro
{ "error": { "code": "string", "message": "string", "details"?: [...] } }
```

- Input DEVE ser validado com Zod em todas as rotas.
- Erros de validação DEVEM incluir `details` com campo + mensagem.
- Stack traces e mensagens de SQL NUNCA devem aparecer em respostas de erro.
- Paginação: cursor-based para listas grandes; offset para admin/pequenas.

**Rationale**: Contratos de API consistentes reduzem bugs de integração e
facilitam debugging quando algo falha em produção.

### XI. PostgreSQL e Banco de Dados

O banco de dados DEVE ser PostgreSQL. Todas as interações DEVEM passar
pelo Repository Pattern definido no Princípio VI.

- Tipos corretos: `bigint` para IDs, `text` para strings, `timestamptz`
  para datas, `numeric(10,2)` para valores financeiros (NUNCA `float`).
- Todo foreign key DEVE ter índice correspondente.
- Índices compostos: colunas de igualdade primeiro, range depois.
- Índice parcial para registros ativos:
  `CREATE INDEX idx ON t (col) WHERE deleted_at IS NULL`.
- Transações DEVEM ser usadas para operações que afetam múltiplas tabelas.
- Queries DEVEM selecionar apenas colunas necessárias — proibido `SELECT *`
  em código de produção.
- N+1 queries são proibidas: usar batch fetch ou JOINs.
- Paginação por cursor preferida a OFFSET para listas grandes.
- Migrations DEVEM ser reversíveis e aplicadas via ferramenta de migração
  (ex: Drizzle, Prisma Migrate).

**Rationale**: Valores financeiros em `float` introduzem erros de ponto
flutuante. Índices inadequados causam degradação sob volume real de dados.

### XII. Anti-Padrões Proibidos

Os seguintes padrões são **explicitamente proibidos** neste projeto:

**Backend:**
- Lógica de negócio em controllers/route handlers.
- SQL direto fora de repositories.
- `any` em TypeScript sem comentário justificando.
- Segredos hardcoded — usar variáveis de ambiente validadas no startup.
- `console.log` em produção — usar structured logger.
- Mutations de objetos recebidos como parâmetros — sempre retornar novo objeto.

**Frontend:**
- `fetch` em `useEffect` para dados que podem ser buscados no servidor.
- `useEffect` para derivar estado — usar `useMemo`.
- Props booleanas que alteram estrutura de renderização
  (`isLarge`, `showHeader`) — usar composição.
- Valores visuais hardcoded (cores, espaçamentos) fora de design tokens.
- `use client` sem justificativa explícita em comentário.
- Componentes com mais de 200 linhas — extrair lógica em hooks ou
  sub-componentes.

**Banco de dados:**
- `float` ou `double` para valores financeiros.
- `SELECT *` em queries de produção.
- Foreign keys sem índice.
- Migrations irreversíveis sem aprovação explícita.

**Geral:**
- Swallow silencioso de erros (`catch (e) {}`).
- Abstrações para uso único (DRY ≠ criar utility para uma linha usada 1x).
- Feature flags ou shims de compatibilidade sem requisito concreto.

**Rationale**: Anti-padrões documentados explicitamente são mais fáceis de
detectar em code review do que princípios positivos vagos.

## Domain Model Constraints

Restrições que se aplicam ao modelo de dados e às entidades do sistema:

- **Estúdio**: entidade mestre com nome e lista de livros. Estúdios não são
  frequentemente criados — o foco do sistema não é gestão de estúdios.
- **Livro**: pertence a um estúdio; carrega o `preço_por_hora` vigente no
  momento da criação (imutável após definição para preservar histórico).
  O número de capítulos é definido na criação do livro.
- **Capítulo**: pertence a um livro; tem `status`, `responsável_gravação`,
  `responsável_edição` e `horas_editadas`. É a entidade central do sistema.
  Status possíveis: `não iniciado`, `em andamento`, `pagamento pendente`, `pago`.
- **Responsável/Editor**: identificado pelo nome; recebe pagamentos baseados
  em horas editadas em capítulos atribuídos a ele.
- Relacionamentos: Estúdio 1→N Livros; Livro 1→N Capítulos.
- Nenhuma entidade órfã é permitida (capítulo sem livro, livro sem estúdio).

## Development Workflow

Processo de desenvolvimento que DEVE ser seguido em todas as features:

1. **Especificação primeiro**: Toda feature começa com `spec.md` aprovada.
2. **Plano técnico**: `plan.md` com decisões de arquitetura antes de codar.
3. **TDD**: Testes escritos e falhando antes da implementação (ver Princípio V).
4. **Code Review**: Revisão obrigatória antes de merge. Verificar
   conformidade com os Princípios I–XII.
5. **Commits convencionais**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) DEVE
passar por revisão dupla antes de ser mesclada.

## Governance

Esta constituição **substitui** todas as outras práticas de desenvolvimento
em caso de conflito.

- Emendas requerem: documentação da motivação, análise de impacto nas
  entidades financeiras, e atualização da versão seguindo semver:
  - MAJOR: remoção ou redefinição incompatível de princípio existente.
  - MINOR: novo princípio ou seção adicionada.
  - PATCH: esclarecimentos, correções de redação, refinamentos não semânticos.
- Todo PR DEVE verificar conformidade com os Princípios I–XII antes do merge.
- Complexidade adicionada DEVE ser justificada explicitamente no PR.
- A Seção de Constraints de Domínio é atualizada sempre que novas entidades
  forem introduzidas.
- Anti-padrões detectados em review DEVEM ser corrigidos antes do merge —
  não podem ser adiados como "débito técnico".

## Self-Review Obrigatório

**Antes de finalizar qualquer código, liste explicitamente como ele cumpre
os itens desta constituição.**

Use o checklist abaixo como resposta ao seu próprio código antes de
submeter para review ou merge:

```markdown
## Self-Review Checklist

### Domínio e Negócio
- [ ] I. Operações ocorrem no nível do capítulo (não livro/estúdio)?
- [ ] II. Cálculos financeiros são determinísticos e auditáveis?
- [ ] III. Transições de status são validadas e registram data/responsável?
- [ ] IV. Existe complexidade que não é exigida pelo requisito atual?
- [ ] V. Testes foram escritos ANTES da implementação e a cobertura é ≥ 80%?

### Arquitetura e Código
- [ ] VI. Lógica de negócio está no Service/Domain, não no Controller?
- [ ] VI. Dependências apontam de fora para dentro (Controller→Service→Repo→Domain)?
- [ ] VII. Componentes UI são puramente visuais (sem fetch/useState de negócio)?
- [ ] VII. Data fetching usa Server Components quando possível?
- [ ] VIII. A mudança não adiciona peso desnecessário ao bundle do cliente?
- [ ] VIII. Listas longas usam virtualização?
- [ ] IX. Todos os valores visuais usam design tokens (sem hardcode)?
- [ ] X. Endpoints seguem convenção REST (URL, método, status code, envelope)?
- [ ] X. Input validado com Zod? Erros não expõem detalhes internos?
- [ ] XI. Queries selecionam apenas colunas necessárias (sem SELECT *)?
- [ ] XI. Novos foreign keys têm índice?
- [ ] XI. Valores monetários usam `numeric`, não `float`?

### Anti-Padrões
- [ ] Nenhum `any` sem justificativa?
- [ ] Nenhum segredo hardcoded?
- [ ] Nenhum `useEffect` para derivar estado (usar `useMemo`)?
- [ ] Nenhum valor visual hardcoded fora de design tokens?
- [ ] Nenhum `use client` sem comentário justificando?
- [ ] Erros são tratados explicitamente (sem `catch (e) {}`)?
```

**Rationale**: A auto-revisão explícita torna o código mais fácil de
revisar por outros e cria responsabilidade pessoal com os padrões
definidos nesta constituição.

**Version**: 1.1.0 | **Ratified**: 2026-03-29 | **Last Amended**: 2026-03-30