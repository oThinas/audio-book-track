# Feature Specification: Skeletons de Carregamento nas Rotas Autenticadas

**Feature Branch**: `031-route-loading-skeletons`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Adicionar skeletons de carregamento (loading states) às rotas autenticadas que hoje exibem página em branco durante o fetch server-side. Contexto: o dashboard já tem streaming com Suspense + SectionSkeleton, mas as rotas /books, /books/[id], /narrators, /editors, /studios e /settings fazem fetch server-side com force-dynamic e não possuem loading.tsx — o usuário vê tela em branco ao navegar. Solução: criar um componente de skeleton de página compartilhado (compondo PageContainer + skeleton de título + skeleton de tabela, no padrão do SectionSkeleton existente e usando o primitivo shadcn Skeleton já instalado em components/ui/skeleton.tsx) e adicionar loading.tsx em cada uma das 6 rotas autenticadas. Sem bibliotecas novas — usar apenas o primitivo shadcn Skeleton existente. O skeleton deve respeitar dark mode (tokens semânticos) e refletir a estrutura real de cada página (header + tabela nas listagens; header + seções no detalhe do livro e settings)."

## Clarifications

### Session 2026-06-04

- Q: O estado de carregamento usa barras cinzas para tudo ou renderiza o conteúdo já conhecido? → A: **Híbrido** — todo conteúdo conhecido estaticamente (título, descrição, botão de ação desabilitado) é renderizado real; skeleton apenas no conteúdo que depende de dados. No detalhe do livro, o título é dinâmico (nome do livro) e vira barra.
- Q: Campo de busca e colunas da tabela nas listagens? → A: Busca real **desabilitada**; a região da tabela é **um único bloco grande** de skeleton — sem cabeçalho de colunas nem linhas individuais (evita duplicação de rótulos e drift).
- Q: Fidelidade no detalhe do livro? → A: Cabeçalho em **barras estruturadas** (título, linha de meta, linha de estatísticas) + um bloco único cobrindo toolbar + tabela de capítulos.
- Q: Configurações? → A: Título real "Configurações" + **dois blocos** de skeleton (região do card de aparência e região dos widgets).
- Q: Animação com preferência de movimento reduzido? → A: Placeholders **não animam** quando o usuário prefere movimento reduzido — ajuste no primitivo compartilhado, beneficiando também o dashboard existente.
- Q: Comunicação para tecnologia assistiva? → A: Região de **status acessível** anunciando "Carregando…" uma única vez; blocos decorativos ocultos da árvore de acessibilidade.
- Q: Estratégia de verificação? → A: Testes unitários de renderização para o componente compartilhado e cada estado de carregamento + **um** teste E2E determinístico em `/books` (atraso de rede controlado). Ausência de salto de layout verificada por inspeção manual no PR.
- Q: Verificação de temas claro/escuro? → A: **Por construção** — placeholders usam apenas cores semânticas do sistema de design; sem verificação dedicada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Feedback imediato ao navegar para listagens (Priority: P1)

Como operador do sistema, ao navegar para qualquer página de listagem (Livros, Narradores, Editores, Estúdios), quero ver imediatamente a moldura real da página (título, descrição, botão de ação e busca, estes desabilitados) com um placeholder pulsante na região da tabela, em vez de uma tela em branco, para perceber que o sistema está respondendo e que os dados estão a caminho.

**Why this priority**: As quatro listagens são as páginas mais visitadas no fluxo diário do operador (cadastro e acompanhamento de produção). Hoje todas exibem tela em branco durante o carregamento — é o maior volume de navegações afetadas e o ganho de percepção de qualidade mais imediato.

**Independent Test**: Pode ser testado de forma totalmente independente navegando para `/books`, `/narrators`, `/editors` e `/studios` com rede lenta simulada e verificando que a moldura real (cabeçalho + busca desabilitada) com bloco de skeleton na região da tabela aparece instantaneamente antes do conteúdo real. Entrega valor sozinho, mesmo sem as demais histórias.

**Acceptance Scenarios**:

1. **Given** o operador autenticado em qualquer página, **When** ele navega para uma das quatro listagens e os dados ainda não chegaram, **Then** o cabeçalho real da página (título, descrição e botão de ação desabilitado) e o campo de busca desabilitado aparecem imediatamente, com um bloco único de skeleton pulsante na região da tabela.
2. **Given** o estado de carregamento visível, **When** os dados terminam de carregar, **Then** o conteúdo real substitui o bloco de skeleton e os controles são habilitados, automaticamente, sem ação do usuário e sem salto brusco de layout — a moldura (cabeçalho + busca) permanece estável.

---

### User Story 2 - Feedback imediato no detalhe do livro (Priority: P2)

Como operador, ao abrir a página de detalhe de um livro, quero ver um placeholder estruturado que reflete a silhueta real da página (barras no lugar do título, da linha de meta e das estatísticas do livro + um bloco na região da toolbar e tabela de capítulos), em vez de tela em branco, para ter continuidade visual durante o carregamento. Como o título é dinâmico (nome do livro), aqui não há conteúdo estático a antecipar.

**Why this priority**: O detalhe do livro é a página operacional central (gestão de capítulos), mas é uma única rota e o padrão estrutural difere das listagens — por isso vem depois do ganho em volume da P1.

**Independent Test**: Navegar de `/books` para `/books/[id]` com rede lenta simulada e verificar que um placeholder com cabeçalho + blocos de seção + tabela aparece antes do conteúdo real.

**Acceptance Scenarios**:

1. **Given** o operador na listagem de livros, **When** ele clica em um livro e os dados do detalhe ainda não chegaram, **Then** um placeholder com barras estruturadas no cabeçalho (título, meta, estatísticas) e um bloco único na região da toolbar + tabela de capítulos aparece imediatamente.
2. **Given** o placeholder do detalhe visível, **When** os dados chegam, **Then** o conteúdo real substitui o placeholder sem salto brusco de layout.

---

### User Story 3 - Feedback imediato nas configurações (Priority: P3)

Como operador, ao abrir a página de Configurações, quero ver o título real "Configurações" imediatamente, com dois blocos pulsantes nas regiões das seções (aparência e widgets do dashboard), em vez de tela em branco durante o carregamento das preferências.

**Why this priority**: Página de baixa frequência de acesso comparada às demais — fecha a cobertura completa das rotas autenticadas, eliminando a última tela em branco do sistema.

**Independent Test**: Navegar para `/settings` com rede lenta simulada e verificar que um placeholder com cabeçalho + seções aparece antes do formulário de preferências.

**Acceptance Scenarios**:

1. **Given** o operador autenticado, **When** ele navega para Configurações e as preferências ainda não chegaram, **Then** o título real "Configurações" aparece imediatamente com dois blocos de skeleton nas regiões das seções.
2. **Given** o placeholder visível, **When** as preferências chegam, **Then** as seções reais substituem os blocos sem salto brusco de layout — o título permanece estável.

---

### Edge Cases

- O que acontece quando os dados chegam quase instantaneamente (cache quente, rede local)? O placeholder pode aparecer por uma fração de segundo ("flash") — comportamento aceito; não deve haver atraso artificial para "segurar" o skeleton.
- Como o sistema se comporta para usuários de tecnologia assistiva? O placeholder não deve ser anunciado como conteúdo real; a página deve comunicar estado de carregamento e o conteúdo definitivo deve ser percebido quando chegar.
- O que acontece se o carregamento dos dados falhar? O tratamento de erro de carregamento (página de erro / retry) está **fora do escopo** desta feature — o comportamento atual de erro permanece inalterado.
- E o dashboard? Já possui carregamento progressivo por seção com placeholders próprios — permanece intocado por esta feature.
- Navegações repetidas rápidas entre páginas (ex.: alternar entre Livros e Narradores várias vezes) não devem produzir placeholders "presos" — cada navegação resolve para o conteúdo real ou para a próxima navegação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir um estado de carregamento visual imediatamente após a navegação para cada uma das seis rotas autenticadas hoje sem feedback (`/books`, `/books/[id]`, `/narrators`, `/editors`, `/studios`, `/settings`), eliminando a tela em branco durante o fetch de dados.
- **FR-002**: O estado de carregamento MUST seguir o princípio híbrido: todo conteúdo conhecido estaticamente é renderizado real desde o primeiro instante; skeleton apenas no conteúdo que depende de dados. Por tipo de página:
  - **Listagens** (`/books`, `/narrators`, `/editors`, `/studios`): título, descrição e botão de ação reais (botão desabilitado) + campo de busca real desabilitado + um único bloco de skeleton na região da tabela.
  - **Detalhe do livro** (`/books/[id]`): barras de skeleton estruturadas no cabeçalho (título, linha de meta, linha de estatísticas) + um único bloco na região da toolbar + tabela de capítulos.
  - **Configurações** (`/settings`): título real "Configurações" + dois blocos de skeleton (região da seção de aparência e região da seção de widgets).
- **FR-003**: Os placeholders MUST usar exclusivamente cores semânticas do sistema de design existente — nenhuma cor fixa; a adaptação aos temas claro e escuro decorre disso por construção.
- **FR-004**: O estado de carregamento MUST ser substituído automaticamente pelo conteúdo real assim que os dados estiverem disponíveis, sem interação do usuário e sem deslocamento perceptível de layout — a moldura estática (título, busca, botões) permanece idêntica entre os dois estados.
- **FR-005**: Os placeholders MUST seguir o mesmo padrão visual de carregamento já estabelecido no dashboard (mesma linguagem de blocos pulsantes), garantindo consistência percebida em todo o sistema.
- **FR-006**: A solução MUST reutilizar exclusivamente os componentes de placeholder já existentes no projeto como base — nenhuma biblioteca externa nova pode ser adicionada.
- **FR-007**: As quatro listagens MUST compartilhar um único componente de estado de carregamento reutilizável (parametrizado por título, descrição e rótulos da moldura), evitando quatro implementações duplicadas.
- **FR-008**: O estado de carregamento MUST anunciar para tecnologias assistivas que a página está carregando, por meio de uma região de status acessível ("Carregando…"), uma única vez por navegação; os blocos decorativos de skeleton MUST ficar ocultos da árvore de acessibilidade.
- **FR-009**: Os placeholders MUST respeitar a preferência de movimento reduzido do usuário — quando ativa, os blocos permanecem visíveis porém sem animação. O ajuste é feito no primitivo compartilhado, estendendo o benefício aos skeletons já existentes do dashboard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero rotas autenticadas exibem tela em branco durante o carregamento (hoje são 6 de 7 — apenas o dashboard tem feedback).
- **SC-002**: O feedback visual de carregamento aparece de forma percebida como instantânea pelo usuário ao navegar (sem janela perceptível de tela em branco antes do placeholder).
- **SC-003**: A troca do estado de carregamento pelo conteúdo real não produz salto de layout perceptível nas páginas cobertas (dentro da meta de CLS < 0.1 já adotada pelo projeto) — verificado por inspeção manual com rede lenta simulada durante o review; a moldura estática garante estabilidade por construção.
- **SC-004**: A experiência de carregamento é percebida como consistente entre o dashboard (padrão existente) e as demais páginas (mesma linguagem visual de blocos pulsantes).

## Assumptions

- O dashboard permanece fora do escopo: seu carregamento progressivo por seção já atende ao objetivo e não será alterado.
- Tratamento de erro de carregamento (falha de rede/servidor ao buscar dados da página) está fora do escopo — esta feature cobre apenas o estado de carregamento bem-sucedido.
- Estados de envio de formulários (botões com indicador de progresso durante submissão) estão fora do escopo — são feedback de mutação, não de carregamento de página, e merecem feature própria.
- Páginas não autenticadas (ex.: tela de login) estão fora do escopo — não fazem fetch de dados pesado e não apresentam o problema.
- O "flash" do placeholder em carregamentos muito rápidos é aceitável e preferível a atrasos artificiais.
- A infraestrutura de placeholder existente (primitivo de bloco pulsante já instalado e padrão de composição usado no dashboard) é a base aprovada para os novos placeholders.
- A verificação automatizada cobre estrutura e acessibilidade dos estados de carregamento (testes unitários de renderização) e o mecanismo fim-a-fim em uma rota representativa (`/books`, teste E2E com atraso de rede determinístico). Layout shift e percepção visual são verificados manualmente no PR — automação de métricas de CLS foi avaliada e descartada por custo/flakiness desproporcionais.
- Os rótulos da moldura estática (título, descrição, botão) ficam duplicados entre a página real e seu estado de carregamento; o risco de drift é aceito por serem strings estáveis e visíveis em review.
