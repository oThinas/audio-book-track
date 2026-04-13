# Research: Verificacao de Acessibilidade nos Testes E2E

## R1. Biblioteca de acessibilidade para Playwright

**Decision**: `@axe-core/playwright`

**Rationale**: Biblioteca oficial da Deque Systems para integracao do axe-core com Playwright. Roda no browser via injecao de script, sem dependencias externas. Mais rapido e estavel que Lighthouse no CI porque nao precisa de Chrome DevTools Protocol e nao faz auditorias de performance/SEO desnecessarias.

**Alternatives considered**:
- **Lighthouse CI**: Mais pesado, inclui auditorias de performance/SEO que nao sao relevantes. Instavel no CI por depender de DevTools Protocol. Descartado por ser overkill e instavel.
- **pa11y**: Boa alternativa, mas usa axe-core internamente e adiciona camada de abstracao desnecessaria. Descartado por indirection.
- **playwright-axe (community)**: Fork nao oficial com menos manutencao. Descartado por falta de suporte oficial.

## R2. API do @axe-core/playwright

**Decision**: Usar `AxeBuilder` com `.withTags()` para WCAG 2.1 AA e `.disableRules()` para excecoes.

**Rationale**: A API e simples e direta:
- `new AxeBuilder({ page })` — construtor recebe o objeto page do Playwright
- `.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])` — filtra regras para WCAG 2.1 AA
- `.disableRules(['rule-id'])` — desabilita regras especificas
- `.analyze()` — retorna `{ violations, passes, incomplete, inapplicable }`
- Cada violation tem: `id`, `impact`, `description`, `helpUrl`, `nodes[]` com `target`, `html`, `failureSummary`

**Alternatives considered**: Nenhuma — esta e a API oficial.

## R3. Mecanismo de troca de tema/cor no codebase

**Decision**: Troca programatica via `page.evaluate()` manipulando DOM e localStorage diretamente.

**Rationale**: A aplicacao usa:
- **Tema**: classe `dark` no `<html>` (via next-themes com `attribute="class"`). localStorage key: `"theme"`.
- **Cor primaria**: atributo `data-primary-color` no `<html>`. localStorage key: `"primary-color"`. CSS custom properties definidas em `globals.css` com seletores `html[data-primary-color="<cor>"]` e `html[data-primary-color="<cor>"].dark`.

Manipular DOM diretamente e mais rapido que navegar pela UI de settings, e o CSS responde imediatamente a mudancas nos atributos/classes.

**Alternatives considered**:
- **Navegar pela UI de settings para cada combinacao**: Mais fiel ao fluxo do usuario, mas ~10x mais lento (precisa clicar em cada swatch/tema). Descartado por impacto no tempo de CI.
- **Injetar CSS diretamente**: Nao garante que os seletores corretos estao ativos. Descartado por fragilidade.

## R4. Paginas a verificar

**Decision**: Todas as paginas com route handler em `src/app/`:

| Pagina | Rota | Tipo | Combinacoes |
|--------|------|------|-------------|
| Login | `/login` | Publica | 2 (light/dark) |
| Root redirect | `/` | Publica | N/A (redirect, sem conteudo) |
| Dashboard | `/dashboard` | Autenticada | 10 (2 temas × 5 cores) |
| Settings | `/settings` | Autenticada | 10 (2 temas × 5 cores) |

**Rationale**: Root redirect (`/`) nao renderiza conteudo proprio — redireciona para login ou pagina favorita. Nao precisa de verificacao de acessibilidade.

**Total de checks**: 2 (login) + 10 (dashboard) + 10 (settings) = **22 checks por execucao**.

## R5. Impacto no tempo de CI

**Decision**: Aceitavel — estimativa de ~44 segundos adicionais.

**Rationale**: 22 checks × ~2 segundos por check = ~44 segundos. O CI atual ja roda testes E2E em serie (1 worker). Este acrescimo e aceitavel comparado ao valor de deteccao de violacoes.

**Alternatives considered**: Rodar combinacoes em paralelo (multiple workers). Descartado por enquanto — o Playwright esta configurado para 1 worker no CI. Pode ser revisitado se o tempo crescer.

## R6. Formato de report de violacoes

**Decision**: Console output formatado + screenshot em caso de violacao.

**Rationale**: Console output usa `console.table()` para listar violacoes com id, impacto, descricao, URL de ajuda e elementos afetados. Screenshot capturado via `page.screenshot()` com nome descritivo incluindo pagina, tema e cor. Artefatos visiveis no Playwright HTML reporter.

**Alternatives considered**:
- **HTML report do axe-core**: Requer dependencia adicional (`axe-html-reporter`). Descartado por YAGNI — console + screenshot sao suficientes.
- **JSON export**: Util para processamento automatizado, mas nao temos pipeline que consuma. Descartado por YAGNI.