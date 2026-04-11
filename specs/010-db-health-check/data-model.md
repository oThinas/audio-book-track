# Data Model: Database Health Check

**Branch**: `010-db-health-check` | **Date**: 2026-04-10

## Alterações no modelo de dados

**Nenhuma.**

Esta feature é puramente de infraestrutura. Não introduz novas entidades, tabelas, colunas ou migrations. Utiliza apenas o pool de conexão existente (`pg.Pool`) para verificar conectividade via `SELECT 1`.

## Entidades impactadas

Nenhuma entidade do domínio (Estúdio, Livro, Capítulo, Narrador, Editor) é afetada.