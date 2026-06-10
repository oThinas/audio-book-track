# Feature Specification: Resiliência de Refresh no Detalhe do Livro + Skeleton de Carregamento do Detalhe

**Feature Branch**: `032-book-detail-refresh-resilience`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "quero implementar a parte Resiliência de refresh no detalhe do livro + loading.tsx do detalhe (US2 da 031) de futuras-features.md"

## Context

A US2 da feature 031 (skeleton de rota em `/books/[id]`) foi implementada com TDD e **revertida antes do merge**. Causa: o bug aberto [vercel/next.js#86151](https://github.com/vercel/next.js/issues/86151) — quando um segmento tem estado de carregamento de rota (`loading.tsx`), a atualização de dados em segundo plano (o "refresh" do roteador) trava de forma intermitente: a resposta chega do servidor, mas a árvore nova nunca é exibida (sem erro, sem retry; só um recarregamento manual resolve). A probabilidade cresce com a complexidade da página e com a velocidade da conexão. No detalhe do livro — a página mais pesada do app (tabela com arrastar-e-soltar, seletores por linha) — o cenário E2E de "reordenar e depois adicionar capítulo" reproduziu o travamento de forma consistente (0 de 4 com o estado de carregamento presente; 4 de 4 sem ele).

A exposição vem de um único ponto: o fluxo de **criação de capítulo** é o único do detalhe que **não** atualiza a lista localmente — ele depende 100% da atualização em segundo plano para o capítulo novo aparecer. Todos os fluxos irmãos (salvar edição, excluir, excluir em massa, atualizar livro, trocar PDF) já atualizam a lista de capítulos localmente e usam a atualização apenas como re-sincronização. Esta feature elimina essa dependência crítica, tornando seguro restaurar o estado de carregamento do detalhe do livro — a última rota autenticada que ainda exibe tela em branco no carregamento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capítulo recém-criado aparece imediatamente e de forma confiável (Priority: P1)

Como operador, ao adicionar um capítulo na página de detalhe de um livro, quero que o capítulo apareça na lista assim que o servidor confirma a criação — imediatamente e de forma confiável — em vez de depender de uma atualização em segundo plano que pode travar e deixar o capítulo "sumido" até eu recarregar a página manualmente.

**Why this priority**: É a raiz do problema. Hoje, em conexões lentas (e especialmente com o estado de carregamento de rota presente), há um estado em que o capítulo é criado no servidor mas **nunca** aparece na tela sem recarregar — uma falha que parece perda de dados para o operador. Capítulo é a unidade central do domínio; gestão de capítulos é a função operacional principal do detalhe do livro. Corrigir isso é pré-requisito para qualquer outra melhoria nesta página.

**Independent Test**: Pode ser testado isoladamente abrindo o detalhe de um livro com rede lenta simulada, adicionando um capítulo e verificando que ele entra na lista na posição correta assim que o servidor responde — sem aguardar nenhuma atualização de fundo e sem recarregar a página. Entrega valor sozinho: elimina a aparência de perda de dados ao criar capítulos.

**Acceptance Scenarios**:

1. **Given** o operador no detalhe de um livro, **When** ele adiciona um capítulo e o servidor confirma a criação, **Then** o capítulo aparece na lista na posição retornada pelo servidor, com a ordem densa preservada e o status do livro atualizado — imediatamente, sem depender de qualquer atualização em segundo plano.
2. **Given** uma conexão lenta, **When** o operador adiciona um capítulo, **Then** o capítulo aparece na lista assim que a resposta chega; uma eventual re-sincronização em segundo plano que trave **não** impede o capítulo de aparecer.
3. **Given** o servidor rejeita a criação (validação ou conflito de versão), **When** a resposta de erro chega, **Then** nenhum capítulo é inserido na lista e o operador recebe o feedback de erro/recuperação correspondente.

---

### User Story 2 - Feedback de carregamento ao abrir o detalhe do livro (Priority: P2)

Como operador, ao abrir a página de detalhe de um livro, quero ver imediatamente um placeholder estruturado que reflete a silhueta real da página (barras no lugar do título, da linha de meta e das estatísticas + um bloco na região da barra de ferramentas e tabela de capítulos), em vez de tela em branco, para ter continuidade visual durante o carregamento. Como o título é dinâmico (nome do livro), aqui não há conteúdo estático a antecipar.

**Why this priority**: É o objetivo visível originalmente planejado na US2 da 031 e a última rota autenticada sem feedback de carregamento. Depende da resiliência da US1 para ser seguro restaurar — por isso vem depois. Fecha a cobertura completa de estados de carregamento iniciada na 031.

**Independent Test**: Navegar de `/books` para `/books/[id]` com rede lenta simulada e verificar que um placeholder com cabeçalho estruturado + bloco da região de capítulos aparece antes do conteúdo real, com anúncio acessível de "Carregando…". Entrega valor sozinho: elimina a tela em branco no detalhe.

**Acceptance Scenarios**:

1. **Given** o operador na listagem de livros, **When** ele clica em um livro e os dados do detalhe ainda não chegaram, **Then** um placeholder com barras estruturadas no cabeçalho (título, meta, estatísticas) e um bloco único na região da barra de ferramentas + tabela de capítulos aparece imediatamente.
2. **Given** o placeholder do detalhe visível, **When** os dados chegam, **Then** o conteúdo real substitui o placeholder sem salto brusco de layout.
3. **Given** o estado de carregamento de rota do detalhe está presente, **When** o operador reordena capítulos e em seguida adiciona um capítulo (o cenário que antes travava), **Then** o capítulo adicionado aparece e a página permanece responsiva — sem travamento.

---

### User Story 3 - Re-sincronização confiável das demais mutações e da recuperação de conflito (Priority: P3)

Como operador, ao editar, excluir ou excluir em massa capítulos (ou atualizar o livro), quero que o estado da página permaneça consistente com o servidor — incluindo o token de versão de capítulos usado para detectar conflitos — sem que isso dependa de uma atualização em segundo plano que pode travar.

**Why this priority**: Esses fluxos já atualizam a lista localmente, então o capítulo afetado já aparece/some na hora; o risco residual é o token de versão e o status do livro ficarem dessincronizados quando a atualização de fundo trava, podendo gerar um falso conflito na próxima operação. É uma blindagem complementar, de impacto menor que a US1, mas que remove a última dependência crítica da atualização bloqueante.

**Independent Test**: Editar/excluir um capítulo com rede lenta simulada e verificar que a próxima operação (ex.: adicionar capítulo) não falha por conflito de versão espúrio; forçar um conflito de versão e verificar que o detalhe se re-sincroniza sem recarregamento manual.

**Acceptance Scenarios**:

1. **Given** o operador edita ou exclui um capítulo, **When** a operação é confirmada, **Then** o token de versão de capítulos e o status do livro ficam atualizados localmente, de modo que a operação seguinte não dispare conflito espúrio — mesmo que a atualização em segundo plano trave.
2. **Given** uma operação de criação detecta versão divergente (conflito), **When** a recuperação é acionada, **Then** o detalhe do livro é re-sincronizado de forma confiável, sem depender de um mecanismo que possa travar.

---

### Edge Cases

- **Conexão muito lenta + estado de carregamento presente**: é o pior caso, onde o travamento se manifestava. A criação otimista garante que o capítulo apareça mesmo que a re-sincronização de fundo nunca complete.
- **Servidor rejeita a criação**: validação de título (obrigatório, ≤ 100 caracteres, sem quebra de linha) ou conflito de versão — nenhum capítulo é inserido na lista; a UI reflete apenas o que o servidor confirmou.
- **Conflito de versão durante a criação**: a recuperação re-sincroniza o detalhe e o operador pode tentar novamente.
- **Exclusão do último capítulo não-pago elimina o livro**: o comportamento existente de redirecionar para a listagem permanece inalterado.
- **Livro inexistente sob streaming**: com o estado de carregamento presente, a resposta inicial é enviada antes da decisão de "não encontrado"; o operador deve ver a mensagem de "não encontrado" na interface (não uma tela em branco nem um erro técnico).
- **Conteúdo entrando no DOM oculto antes da troca do placeholder**: medições e interações devem considerar a visibilidade real do conteúdo, não apenas sua presença no DOM.
- **Capítulo marcado como `paid`**: a criação otimista não pode contornar nenhuma regra de imutabilidade — apenas reflete o que o servidor persistiu.
- **Correção upstream do bug #86151**: se o bug for corrigido na dependência antes da entrega, a parte de resiliência (US1/US3) deixa de ser estritamente necessária; ainda assim o feedback de carregamento (US2) e os ajustes de teste permanecem desejáveis.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao criar um capítulo, o sistema MUST inserir o capítulo recém-criado na lista de capítulos imediatamente após a confirmação do servidor, usando os dados retornados na própria resposta de criação (capítulo, posição, status do livro e token de versão de capítulos), sem depender de uma atualização de dados em segundo plano para o capítulo aparecer.
- **FR-002**: O capítulo recém-criado MUST aparecer na posição retornada pelo servidor, com a ordem densa dos capítulos preservada (sem renumeração de títulos, conforme regra pós-026) e o status do livro refletindo o valor confirmado pelo servidor.
- **FR-003**: A criação de capítulo MUST permanecer confiável independentemente da velocidade da conexão e da presença do estado de carregamento da rota — não pode existir estado em que o capítulo criado no servidor nunca apareça na tela sem recarregamento manual.
- **FR-004**: A atualização de dados em segundo plano, quando mantida, MUST atuar apenas como re-sincronização (não como caminho crítico para o capítulo aparecer), alinhando o fluxo de criação ao padrão já adotado pelos fluxos irmãos (editar, excluir, excluir em massa, atualizar livro).
- **FR-005**: As mutações de capítulo que hoje não devolvem o token de versão de capítulos atualizado (edição, exclusão individual, exclusão em massa) MUST passar a permitir que a interface re-sincronize esse token (e o status do livro quando aplicável) sem depender exclusivamente de uma atualização bloqueante que possa travar.
- **FR-006**: A recuperação de um conflito de versão de capítulos MUST re-sincronizar o detalhe do livro de forma confiável, sem depender de um mecanismo que possa travar de forma intermitente.
- **FR-007**: O sistema MUST exibir um estado de carregamento no detalhe do livro (`/books/[id]`) imediatamente após a navegação, com barras estruturadas no cabeçalho (título, linha de meta, linha de estatísticas) e um bloco único na região da barra de ferramentas + tabela de capítulos, eliminando a tela em branco — restaurando o comportamento da US2 da 031.
- **FR-008**: O estado de carregamento do detalhe MUST anunciar para tecnologias assistivas que a página está carregando, por meio de uma região de status acessível ("Carregando…") uma única vez por navegação; os blocos decorativos de skeleton MUST ficar ocultos da árvore de acessibilidade; placeholders MUST usar apenas cores semânticas do sistema de design (adaptação a tema claro/escuro por construção) e respeitar a preferência de movimento reduzido.
- **FR-009**: O estado de carregamento do detalhe MUST reutilizar a infraestrutura de placeholder e o padrão de página de carregamento já existentes no projeto — nenhuma biblioteca externa nova pode ser adicionada.
- **FR-010**: Os testes E2E afetados pela introdução do estado de carregamento no segmento de detalhe MUST ser ajustados para refletir o comportamento real do usuário sob streaming: o livro inexistente deve ser verificado pela mensagem de "não encontrado" na interface; medições de layout/altura dependentes de capítulos devem aguardar a visibilidade do conteúdo antes de medir.
- **FR-011**: A criação otimista MUST refletir somente o que o servidor confirmou — não pode contornar nenhuma validação de servidor nem regra de imutabilidade (ex.: dados financeiros de capítulo `paid`); em caso de erro do servidor, nenhuma alteração otimista permanece na lista.
- **FR-012**: Nenhuma regressão MUST ser introduzida nos fluxos de capítulo existentes (editar, excluir, excluir em massa, reordenar, atualizar livro, trocar PDF) nem nas garantias de status do livro como cache materializado recomputado na mesma transação da mutação.

### Key Entities *(include if feature involves data)*

- **Capítulo**: unidade central do domínio. Atributos relevantes para esta feature: identificador, título, posição (ordem densa `0..N-1`), status, narrador, editor, tempo editado. A criação devolve o capítulo persistido para inserção imediata na lista.
- **Livro**: contém a lista de capítulos. Atributos relevantes: status (cache materializado, recomputado por mutação de capítulo) e token de versão de capítulos (usado para detectar conflitos de operações concorrentes/declarativas).
- **Resposta de mutação de capítulo**: o "envelope" devolvido por operações de criação/edição/exclusão. Para esta feature, deve carregar o token de versão de capítulos atualizado (e o status do livro quando aplicável), de modo que a interface possa re-sincronizar sem depender de uma atualização de fundo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O cenário E2E que reproduzia o travamento (reordenar e depois adicionar capítulo) passa de forma consistente **com** o estado de carregamento do detalhe presente — alvo de **10 execuções consecutivas sem falha** (era 0 de 4 antes da correção).
- **SC-002**: Um capítulo recém-criado aparece na lista assim que o servidor confirma a criação, sem necessidade de recarregar a página e sem depender da conclusão de qualquer atualização em segundo plano. Verificação: testes unitários do fluxo de criação (inserção otimista a partir da resposta) + a asserção de capítulo visível no E2E de aceite (SC-001). Nota: o travamento reproduz **sem** throttling artificial de rede — a detecção se dá pela repetição do cenário de aceite, não por simulação de conexão lenta.
- **SC-003**: Zero rotas autenticadas exibem tela em branco no carregamento — o detalhe do livro, última rota pendente, passa a ter feedback de carregamento, fechando a cobertura iniciada na 031.
- **SC-004**: Nenhuma regressão observável nos fluxos de capítulo existentes (editar, excluir, excluir em massa, reordenar, atualizar livro) — suítes de teste unitário, integração e E2E relacionadas permanecem verdes.
- **SC-005**: Após editar/excluir um capítulo em conexão lenta, a operação seguinte (ex.: adicionar capítulo) não dispara conflito de versão espúrio.

## Assumptions

- **Bug upstream permanece aberto**: a feature assume que o #86151 não foi corrigido na dependência até a entrega. Se for corrigido antes, a parte de resiliência (US1/US3) torna-se opcional e o escopo se reduz ao feedback de carregamento (US2) + ajustes de teste (FR-010).
- **Limiar de aceite (N = 10)**: o número de execuções consecutivas do E2E para considerar o travamento resolvido é fixado em 10. Valor escolhido como padrão razoável para detectar intermitência; ajustável no review se necessário.
- **Decisões de contrato deferidas ao planejamento**: o formato exato das respostas de mutação que passam a carregar o token de versão (por exemplo, manter "sem conteúdo" na exclusão vs. devolver um envelope; usar uma busca dedicada vs. reaproveitar a atualização para recuperação de conflito) é decisão de design a ser resolvida em `/speckit-plan`, respeitando os padrões de API REST e envelope do projeto.
- **Sem dependências novas**: o estado de carregamento do detalhe reutiliza os componentes de placeholder e o padrão de página de carregamento já existentes (introduzidos na 031); nenhuma biblioteca externa é adicionada.
- **Escopo restrito ao detalhe do livro**: as cinco demais rotas autenticadas (que mantiveram seus estados de carregamento na 031) não são alteradas. O dashboard permanece intocado.
- **Tratamento de erro de carregamento de página** (falha de rede/servidor ao buscar o detalhe) permanece com o comportamento atual — fora do escopo, exceto pelo ajuste do caso "livro inexistente sob streaming" (FR-010).
- **Revisão dupla obrigatória**: itens da US1/US3 tocam fluxos de capítulo (coração do domínio) e a recomputação de status/token; conforme a constituição, qualquer mudança no modelo financeiro/responsáveis ou nos fluxos de capítulo exige revisão dupla antes do merge.
- **Implementação e testes da US2 da 031 preservados no histórico git** (commit `d4154de`) servem de base para restaurar o estado de carregamento do detalhe e seus testes unitários.
