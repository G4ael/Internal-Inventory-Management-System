// ============================================================================
// Busca global (Ctrl+K) — acha qualquer registro e abre direto nele
// ============================================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, User, Receipt, Wrench, ShoppingCart, Package, Plus, LayoutDashboard, Users, Store,
  FileText, Settings, CornerDownLeft
} from 'lucide-react';
import { useData, useNav } from '../contexto';
import { contem, fmtBRL, fmtDate, hojeISO } from '../lib/format';
import { STATUS_OS, STATUS_ORC, statusOrc } from '../lib/dominio';

const ACOES = [
  { id: 'a-os', titulo: 'Nova ordem de serviço', icone: Plus, pagina: 'servicos', acao: 'nova' },
  { id: 'a-orc', titulo: 'Novo orçamento', icone: Plus, pagina: 'orcamentos', acao: 'nova' },
  { id: 'a-venda', titulo: 'Nova venda', icone: Plus, pagina: 'vendas', acao: 'nova' },
  { id: 'a-cli', titulo: 'Novo cliente', icone: Plus, pagina: 'clientes', acao: 'nova' },
  { id: 'a-prod', titulo: 'Novo produto no estoque', icone: Plus, pagina: 'estoque', acao: 'nova' }
];
const PAGINAS = [
  { id: 'painel', titulo: 'Painel', icone: LayoutDashboard },
  { id: 'servicos', titulo: 'Serviços', icone: Wrench },
  { id: 'orcamentos', titulo: 'Orçamentos', icone: Receipt },
  { id: 'clientes', titulo: 'Clientes', icone: Users },
  { id: 'estoque', titulo: 'Estoque', icone: Package },
  { id: 'loja', titulo: 'Loja virtual', icone: Store },
  { id: 'vendas', titulo: 'Vendas', icone: ShoppingCart },
  { id: 'notas', titulo: 'Notas fiscais', icone: FileText },
  { id: 'config', titulo: 'Configurações', icone: Settings }
];
const LIMITE = 5;

const BuscaGlobal = ({ onClose }) => {
  const { data } = useData();
  const { ir, abrirCliente } = useNav();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const grupos = useMemo(() => {
    const hoje = hojeISO();
    const g = [];
    const acoes = ACOES.filter(a => contem(a.titulo, q)).map(a => ({ ...a, rodar: () => ir(a.pagina, { acao: a.acao }) }));
    const paginas = PAGINAS.filter(p => contem(p.titulo, q)).map(p => ({ ...p, id: 'p-' + p.id, sub: 'Ir para a página', rodar: () => ir(p.id) }));
    if (q.trim()) {
      const cli = data.clientes.filter(c => contem(`${c.nome} ${c.telefone} ${c.documento} ${c.endereco}`, q)).slice(0, LIMITE)
        .map(c => ({ id: 'c-' + c.id, icone: User, titulo: c.nome, sub: [c.telefone, c.endereco].filter(Boolean).join(' · ') || 'Cliente', rodar: () => abrirCliente(c.id) }));
      const orc = data.orcamentos.filter(o => contem(`${o.cliente} ${o.local} ${o.itens}`, q)).slice(0, LIMITE)
        .map(o => ({ id: 'o-' + o.id, icone: Receipt, titulo: `${o.cliente} · ${fmtBRL(o.total)}`, sub: `Orçamento de ${fmtDate(o.data)} · ${STATUS_ORC[statusOrc(o, hoje)]?.label}`, rodar: () => ir('orcamentos', { acao: 'abrir', id: o.id }) }));
      const os = data.servicos.filter(s => contem(`${s.cliente} ${s.endereco} ${s.tecnico}`, q)).slice(0, LIMITE)
        .map(s => ({ id: 's-' + s.id, icone: Wrench, titulo: `${s.tipo} · ${s.cliente}`, sub: `${fmtDate(s.data)} às ${s.hora} · ${STATUS_OS[s.status]?.label}`, rodar: () => ir('servicos', { acao: 'abrir', id: s.id }) }));
      const vendas = data.vendas.filter(v => contem(`${v.cliente} ${v.numero}`, q)).slice(0, LIMITE)
        .map(v => ({ id: 'v-' + v.id, icone: ShoppingCart, titulo: `Venda #${v.numero} · ${v.cliente}`, sub: fmtBRL(v.total), rodar: () => ir('vendas', { busca: String(v.numero) }) }));
      const prod = data.produtos.filter(p => contem(`${p.nome} ${p.sku}`, q)).slice(0, LIMITE)
        .map(p => ({ id: 'e-' + p.id, icone: Package, titulo: p.nome, sub: `${p.qtd} em estoque · ${fmtBRL(p.preco)}`, rodar: () => ir('estoque', { acao: 'abrir', id: p.id }) }));
      if (cli.length) g.push({ nome: 'Clientes', itens: cli });
      if (orc.length) g.push({ nome: 'Orçamentos', itens: orc });
      if (os.length) g.push({ nome: 'Serviços', itens: os });
      if (vendas.length) g.push({ nome: 'Vendas', itens: vendas });
      if (prod.length) g.push({ nome: 'Estoque', itens: prod });
    }
    if (acoes.length) g.push({ nome: 'Criar', itens: acoes });
    if (paginas.length) g.push({ nome: 'Páginas', itens: paginas });
    return g;
  }, [q, data, ir, abrirCliente]);

  const plana = grupos.flatMap(g => g.itens);
  const atual = Math.min(sel, Math.max(0, plana.length - 1));

  useEffect(() => {
    listaRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [atual]);

  const executar = (item) => { if (!item) return; onClose(); item.rodar(); };
  const teclado = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((atual + 1) % Math.max(1, plana.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((atual - 1 + plana.length) % Math.max(1, plana.length)); }
    else if (e.key === 'Enter') { e.preventDefault(); executar(plana[atual]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const inicios = grupos.map((_, k) => grupos.slice(0, k).reduce((s, x) => s + x.itens.length, 0));
  return (
    <div className="paleta-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Buscar em todo o sistema">
        <div className="paleta-entrada">
          <Search size={20} className="t3" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={teclado}
            placeholder="Buscar cliente, orçamento, OS, venda ou produto…" aria-label="Buscar"
            role="combobox" aria-expanded="true" aria-controls="resultados-busca" aria-activedescendant={plana[atual] ? `r-${plana[atual].id}` : undefined} />
          <span className="kbd">Esc</span>
        </div>
        <div className="paleta-lista" id="resultados-busca" role="listbox" ref={listaRef}>
          {plana.length === 0 && (
            <div className="vazio" style={{ padding: 32 }}><b>Nada encontrado para “{q}”</b><p>Tente parte do nome, do telefone ou o número da venda.</p></div>
          )}
          {grupos.map((g, gi) => (
            <div key={g.nome}>
              <div className="paleta-grupo">{g.nome}</div>
              {g.itens.map((item, j) => {
                const i = inicios[gi] + j;
                const I = item.icone;
                return (
                  <button key={item.id} id={`r-${item.id}`} className="paleta-item" role="option" aria-selected={i === atual}
                    onMouseMove={() => { if (sel !== i) setSel(i); }} onClick={() => executar(item)}>
                    <span className="paleta-ic"><I /></span>
                    <span style={{ minWidth: 0, flex: 1 }}><b>{item.titulo}</b>{item.sub && <small>{item.sub}</small>}</span>
                    {i === atual && <CornerDownLeft size={16} className="t3" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="paleta-rodape so-desktop">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> escolher</span>
          <span><span className="kbd">Enter</span> abrir</span>
          <span><span className="kbd">Esc</span> fechar</span>
        </div>
      </div>
    </div>
  );
};

export default BuscaGlobal;
