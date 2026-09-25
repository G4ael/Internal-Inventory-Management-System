# Servigás — Gestão interna

Sistema interno da Servigás: serviços (OS), orçamentos, clientes, estoque,
vendas, notas fiscais e o catálogo do site da loja. React + Vite, dados no
Supabase.

## Rodar no computador

1. `npm install`
2. Crie o arquivo `.env.local` na raiz com as chaves do Supabase:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica
   ```
3. `npm run dev` e abra o endereço que aparecer.

`npm run build` gera a versão para publicar; `npm run lint` confere o código.

## Onde fica cada coisa

| Pasta / arquivo | O que tem |
|---|---|
| `src/App.jsx` | Menu lateral, barra do topo, busca (Ctrl+K), avisos e troca de telas |
| `src/pages/` | Uma tela por arquivo: Painel, Serviços, Orçamentos, Clientes, Estoque, Loja, Vendas, Notas, Configurações, Login |
| `src/components/` | Peças comuns (`ui.jsx`), gráficos (`graficos.jsx`), busca global e ficha do cliente |
| `src/lib/db.js` | Tudo que lê e grava no Supabase (traduz banco ↔ tela) |
| `src/lib/dominio.js` | Nomes e estados do negócio (status de OS e orçamento, textos do WhatsApp) |
| `src/lib/integracoes.js` | WhatsApp (Z-API), nota fiscal (Plugnotas), impressão de cartões e DANFE |
| `src/index.css` | Cores, fontes e componentes visuais (tema claro e escuro) |
| `DESIGN.md` | Regras do visual, alinhadas com o site da loja |

O estoque é movimentado por gatilhos no banco (OS e vendas); a tela não
soma nem subtrai sozinha.

## Cópia de segurança de 25/09/2026

Antes do redesenho foi feita uma cópia de todas as tabelas dentro do próprio
Supabase, no schema `backup_20260925` (fora da API pública: o site e o
sistema não enxergam essas tabelas). Nada foi alterado nos dados originais.

- Ver: painel do Supabase → Table Editor → trocar o schema para `backup_20260925`.
- Comparar, por exemplo: `select count(*) from backup_20260925.clientes;`
- Recuperar um registro apagado por engano (exemplo com cliente):
  ```sql
  insert into public.clientes select * from backup_20260925.clientes
  where id = 'ID-DO-CLIENTE' on conflict (id) do nothing;
  ```
- Quando não precisar mais: `drop schema backup_20260925 cascade;`

Para cópias do dia a dia use **Configurações → Baixar cópia de segurança**
(arquivo JSON com tudo, inclusive o catálogo da loja).
