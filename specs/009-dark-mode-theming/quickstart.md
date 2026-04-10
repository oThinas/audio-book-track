# Quickstart: Dark Mode & Primary Color Theming Refactor

**Branch**: `009-dark-mode-theming`

## Verificacao rapida

### Pre-requisitos

```bash
cd /Users/thiagomartins/dev/audio-book-track
git checkout 009-dark-mode-theming
bun install
```

### Validar dark mode

1. Iniciar o servidor de desenvolvimento:
   ```bash
   bun run dev
   ```

2. Abrir `http://localhost:3000/login` no browser.

3. Alternar o tema do SO entre claro e escuro (ou usar DevTools para emular `prefers-color-scheme: dark`).

4. Verificar que:
   - A pagina de login adapta fundo, card e texto a ambos os temas.
   - O painel de branding (esquerda) usa cores semanticas, nao `bg-slate-800` fixo.

5. Fazer login e navegar para Settings.

6. Alternar o seletor de tema entre Light / Dark / System.

7. Verificar que:
   - A sidebar adapta cores ao tema (nao fica sempre escura com `bg-slate-800`).
   - A area de conteudo principal usa `bg-background` (nao `bg-slate-50` fixo).
   - Labels, descricoes e separadores sao legiveis em ambos os temas.

### Validar primary color

1. Na pagina de Settings, selecionar cada cor primaria (blue, orange, green, red, amber).

2. Para cada cor, verificar:
   - O item ativo da sidebar muda para a cor selecionada.
   - O estado checked dos seletores de tema e font size muda para a cor selecionada.
   - O icone de headphones (marca) muda para a cor selecionada.

### Validar nao-regressao

1. Alternar para modo claro.
2. Verificar que a aparencia visual e identica ao estado anterior a refatoracao.
3. Navegar por todas as paginas (login, dashboard, settings).
4. Confirmar que nao ha elementos com cores quebradas ou faltando.

### Comandos de verificacao

```bash
bun run lint          # Sem erros ou warnings
bun run test:unit     # Testes unitarios passando
bun run build         # Build de producao sem erros
```