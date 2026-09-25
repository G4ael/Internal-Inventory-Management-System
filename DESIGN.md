# Design: Servigás Gestão interna

O sistema interno usa o mesmo sistema visual do site da loja
(`heaters-sales-platform/DESIGN.md`): as mesmas cores, fontes e formas,
adaptadas para uma ferramenta de trabalho. Layout de painel com menu
lateral, cartões de números e gráficos.

Tudo mora em `src/index.css` como variáveis; o tema escuro só troca as
variáveis (`:root[data-theme="dark"]`).

## Cores

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| Laranja da marca | `#EA580C` | igual | Logo, avatar, dia de hoje, selo "Destaque", contador do sino. Nunca em botão de ação. |
| Azul-água | `#0B4FB3` | `#7FB0F5` (`--acento`) | Item ativo do menu, foco, links, linha dos gráficos, ícones dos cartões de número, bloco "Loja virtual" |
| Azul claro | `#E8F0FB` | `#12213A` | Fundo do item ativo e dos ícones |
| Tinta | `#111111` | `#F4F4F6` | Texto e botão principal (pílula preta; no escuro inverte) |
| Fundo / superfície | `#F2F2F4` / `#FFFFFF` | `#0E0E10` / `#16161A` | Página cinza, cartões brancos sem borda |
| Verde WhatsApp | `#15803D` | igual | Botões de WhatsApp |

Estados (sempre com texto, nunca só a cor): ok/concluído/aprovado em verde,
pendente em âmbar, em andamento/aberto em azul, vencido/erro em vermelho,
cancelado/recusado em cinza. Diferente da loja, aqui o verde também marca
"deu certo", porque numa ferramenta de trabalho o estado precisa ser lido
de relance.

## Tipografia

- **Unbounded** (600) só nos títulos de página ("Painel", "Orçamentos") e no login.
- **Onest** em todo o resto: rótulos, botões, tabelas e números.
- Números em colunas usam `tabular-nums` (classe `.num`); SKU e chaves de
  nota usam a fonte mono do sistema (`.mono`).

## Formas

- Cartões: raio 20px, fundo branco sobre o cinza, sem borda e sem sombra parados.
- Botões, busca, chips e selos: pílula (999px). Campos de formulário: raio 12px, fundo cinza.
- Janelas: raio 24px; no celular viram folha que sobe de baixo.
- Sombra só em coisas que flutuam (menus suspensos, janelas, avisos) e no hover de cartão clicável.

## Componentes (em `src/components/ui.jsx`)

`PageHeader`, `BuscaPagina`, `Chips` (filtros com contagem), `Segmentado`,
`Selo`, `Delta`, `Modal` (com `rodape`), `Gaveta`, `Field`, `Vazio`,
`Esqueleto`, `Avatar`, `Logo`.

Botões: `.btn` + `.btn-preto` (ação principal, uma por área), `.btn-contorno`,
`.btn-suave`, `.btn-whats`, `.btn-sm`; ícones: `.btn-icone` (`.perigo` para excluir).

## Gráficos (`src/components/graficos.jsx`)

SVG sem biblioteca. Linha de 2px em azul-água com área a 16%→0%; período
anterior tracejado em cinza; grade fina; dica ao passar o mouse e com as
setas do teclado; os números também ficam numa tabela ("Ver os números em
tabela"). Nas colunas, só a maior fica azul e com o valor escrito.

## Não fazer

- Laranja em botão de ação ou em gráfico (ele é a marca, não um estado).
- Borda colorida grossa na lateral de cartões.
- Emoji como ícone na tela (ícones Lucide, traço 1,8). Emoji só nos textos enviados por WhatsApp.
- Rótulo pequeno em cima de título.
