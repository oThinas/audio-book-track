# AudioBook Track — Instruções para Claude

> A constituição completa do projeto está em [.specify/memory/constitution.md](.specify/memory/constitution.md).
> Este arquivo contém as regras mais críticas inline para garantir adesão imediata.
> **Em caso de conflito, a constituição prevalece.**

---

## Regras Não-Negociáveis

### Domínio

- **Capítulo é a unidade central** — atribuição, cálculo de ganho e status operam sempre no nível do capítulo, nunca no livro ou estúdio.
- **Preço/hora é imutável após definido** — vinculado ao livro, nunca ao estúdio; não pode ser recalculado retroativamente.
- **Fórmula de ganho**: `horas_editadas × preço_hora_do_livro` — determinística, auditável, sem derivação dinâmica.
- **Ciclo de vida do capítulo**: `não iniciado` → `em andamento` → `pagamento pendente` → `pago`. Nenhuma etapa pode ser pulada.
  - `em andamento` exige responsável de edição atribuído.
  - `pagamento pendente` exige horas editadas registradas.
  - `pago` torna os dados financeiros imutáveis.
- **Capítulo marcado como `pago` não pode ter dados financeiros alterados.**

### Arquitetura

- **Camadas obrigatórias** (dependências de fora para dentro):
  ```
  app/api/          → Controllers (HTTP apenas, sem lógica de negócio)
  lib/services/     → Use Cases (orquestração, sem SQL/HTTP direto)
  lib/repositories/ → Acesso a dados (interface no domínio)
  lib/domain/       → Entidades e regras puras (sem imports de framework)
  ```
- **Injeção de dependência via construtor** — nunca instanciar dependências dentro de uma classe.
- **Componentes UI (`components/ui/`)** são puramente visuais: sem `useState` de negócio, sem `fetch`.
- **`use client` exige comentário justificando** o motivo; Server Components são o padrão.
- **Data fetching** usa Server Components com `async/await`; `useEffect` para fetch é proibido.

### Banco de dados

- **Valores financeiros**: `numeric(10,2)` — `float` e `double` são proibidos.
- **Todo foreign key deve ter índice** correspondente.
- **`SELECT *` é proibido** em código de produção.
- **Transações obrigatórias** para operações que afetam múltiplas tabelas.
- **Migrations devem ser reversíveis.**

### API REST

- URLs em plural, kebab-case: `/api/v1/books/:id/chapters`
- Status codes corretos: `201` para POST, `204` para DELETE, `422` para dados inválidos, `409` para conflito de estado.
- **Nunca retornar `200` com `{ success: false }`.**
- Input validado com **Zod** em todas as rotas.
- Stack traces e mensagens de SQL **nunca** aparecem em respostas de erro.

### Anti-padrões proibidos

- `any` em TypeScript sem comentário justificando.
- Segredos hardcoded — usar variáveis de ambiente.
- `console.log` em produção — usar structured logger.
- `useEffect` para derivar estado — usar `useMemo`.
- Valores visuais hardcoded (cores, espaçamentos) fora de design tokens.
- Lógica de negócio em controllers.
- SQL direto fora de repositories.
- Swallow silencioso de erros: `catch (e) {}`.
- Mutação de objetos recebidos como parâmetro — sempre retornar novo objeto.

---

## TDD (obrigatório)

1. Escreva o teste primeiro (RED).
2. Implemente o mínimo para passar (GREEN).
3. Refatore (IMPROVE).
4. Cobertura mínima: **80%** geral; **100%** para lógica de cálculo de ganho.

---

## Self-Review antes de qualquer entrega

```
- [ ] I.   Operações no nível do capítulo?
- [ ] II.  Cálculos financeiros determinísticos e auditáveis?
- [ ] III. Transições de status validadas, com data e responsável?
- [ ] IV.  Complexidade justificada por requisito concreto?
- [ ] V.   Testes escritos ANTES da implementação, cobertura ≥ 80%?
- [ ] VI.  Lógica de negócio no Service/Domain, não no Controller?
- [ ] VII. Componentes UI puramente visuais?
- [ ] VIII.Sem peso desnecessário no bundle do cliente?
- [ ] IX.  Valores visuais via design tokens (sem hardcode)?
- [ ] X.   Endpoints REST corretos (URL, método, status, envelope, Zod)?
- [ ] XI.  Sem SELECT *? Foreign keys com índice? Monetário em numeric?
- [ ] XII. Nenhum anti-padrão proibido presente?
```

---

## Modelo de domínio (resumo)

| Entidade   | Pertence a | Campo crítico                        |
|------------|------------|--------------------------------------|
| Estúdio    | —          | nome                                 |
| Livro      | Estúdio    | `preço_por_hora` (imutável)          |
| Capítulo   | Livro      | status, responsável_edição, horas_editadas |
| Editor     | —          | recebe pagamento por horas em capítulos atribuídos |

Sem entidades órfãs: capítulo sem livro ou livro sem estúdio são inválidos.

---

## Workflow de desenvolvimento

1. Feature começa com `spec.md` aprovada.
2. `plan.md` com decisões de arquitetura antes de codar.
3. TDD (ver acima).
4. Code review verificando conformidade com os Princípios I–XII.
5. Commits convencionais: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) requer **revisão dupla** antes do merge.
