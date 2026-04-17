# Quickstart — CRUD de Narradores

Passo a passo para validar a feature localmente após implementação.

## Pré-requisitos

- PostgreSQL rodando localmente (ver `.env` / `docker-compose.yml`).
- Dependências instaladas: `bun install`.
- Migration aplicada: `bun run db:migrate`.
- Servidor rodando: `bun dev` (porta 1197).
- Usuário de teste criado via seed ou fluxo de registro.

---

## 1. Verificar schema e migration

```bash
bun run db:studio
```

Na aba "narrator" deve aparecer a tabela recém-criada com as colunas `id`, `name`, `email`, `created_at`, `updated_at` e o índice único em `email`.

---

## 2. Acessar a página

1. Acesse `http://localhost:1197/login` e autentique.
2. Navegue para `/narrators` pela sidebar (ícone "Narradores").
3. A página carrega com título "Narradores", descrição "Gerencie os narradores de audiobooks" e botão "+ Novo Narrador" no canto superior direito.
4. Se não houver narradores cadastrados, aparece estado vazio com mensagem.

---

## 3. Criar um narrador

1. Clique em **"+ Novo Narrador"**.
2. Uma nova linha editável aparece no topo da tabela com campos "Nome" e "E-mail" vazios, e botões "Cancelar" / "Confirmar".
3. Preencha:
   - Nome: `João Silva`
   - E-mail: `joao@exemplo.com`
4. Clique em **"Confirmar"**.
5. A linha sai do modo editável e exibe os dados. Os ícones voltam a ser "Editar" e "Excluir".
6. **Validação**: preencher nome com 1 caractere deve mostrar erro "Nome deve ter no mínimo 2 caracteres"; e-mail malformado mostra "E-mail inválido".
7. **Duplicata**: tentar criar outro narrador com o mesmo e-mail mostra erro "E-mail já cadastrado".
8. **Cancelar**: clique em "Cancelar" numa nova linha → a linha desaparece sem criar registro.

---

## 4. Editar um narrador

1. Clique no ícone **"Editar"** (lápis) da linha.
2. Os campos "Nome" e "E-mail" viram inputs com os valores atuais. Ícones de ação viram "Cancelar" / "Confirmar".
3. Altere o nome para `João Santos` e clique em **"Confirmar"**.
4. A linha sai do modo edição e exibe o nome atualizado.
5. **Cancelar**: reentre no modo edição, altere valores, clique em **"Cancelar"** → valores originais são restaurados.
6. **Duplicata**: alterar e-mail para um já existente em outro narrador mostra erro.

---

## 5. Excluir um narrador

1. Clique no ícone **"Excluir"** (lixeira, cor destructive).
2. Um modal de confirmação aparece com:
   - Título: "Tem certeza que deseja excluir este narrador?"
   - Descrição: "Esta ação não pode ser desfeita. O narrador **João Santos** será removido permanentemente."
   - Botões: "Cancelar" (outline) e "Excluir" (variant destructive)
3. Clicar em **"Cancelar"** ou pressionar ESC → modal fecha, nada é alterado.
4. Clicar em **"Excluir"** → o registro é removido, o modal fecha, a linha desaparece da tabela. **Nenhum toast de sucesso** (FR-014).

---

## 6. Testar sorting

1. Com 3+ narradores cadastrados, clique no cabeçalho **"Nome"** → ordenação ascendente (ícone de seta para cima).
2. Clique novamente → descendente (seta para baixo).
3. Clique no cabeçalho **"E-mail"** → alterna ordenação pela coluna e-mail.

---

## 7. Testar ScrollArea e font-size

1. Abra as Configurações (`/settings`) e altere **Tamanho da fonte** para "Grande".
2. Volte para `/narrators`. A tabela deve manter layout sem quebrar; se o conteúdo exceder a altura disponível, scroll vertical aparece dentro da tabela (não na página inteira).
3. Altere o **tamanho da fonte** para "Pequeno" e verifique que a tabela continua legível.

---

## 8. Testar cor destrutiva por cor primária

1. Vá para `/settings` → **Cor primária**.
2. Selecione cada uma das 5 variantes: `blue`, `orange`, `green`, `red`, `amber`.
3. Para cada variante, volte em `/narrators` e confirme:
   - O ícone de lixeira (trash) é **visualmente distinto** da cor primária.
   - O botão "Excluir" no modal de confirmação também contrasta claramente.
4. **Foco especial**: com `red` selecionado, o ícone e o botão devem exibir um tom mais escuro / bordô, diferente do botão "+ Novo Narrador" (que usa primary red).

---

## 9. Dark mode

1. Alterne tema para **escuro** via `/settings` → Tema.
2. Toda a página deve funcionar: tabela, modals, inputs, ícones. Nenhum elemento hardcoded.

---

## 10. API (manual via curl)

```bash
# Lista
curl -b cookies.txt http://localhost:1197/api/v1/narrators

# Cria
curl -b cookies.txt -X POST http://localhost:1197/api/v1/narrators \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@exemplo.com"}'

# Atualiza
curl -b cookies.txt -X PATCH http://localhost:1197/api/v1/narrators/<ID> \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Souza"}'

# Exclui
curl -b cookies.txt -X DELETE http://localhost:1197/api/v1/narrators/<ID>
```

---

## 11. Rodar testes

```bash
bun run lint                # Biome sem warnings
bun run test:unit           # Vitest unit (schemas, service, route handlers)
bun run test:integration    # Vitest integration (Drizzle repo no DB real)
bun run test:e2e            # Playwright E2E
bun run build               # Next build sem erros
```

Todos os comandos devem passar sem erros nem warnings antes de abrir o PR.
