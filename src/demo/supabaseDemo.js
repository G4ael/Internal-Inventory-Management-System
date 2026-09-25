// ============================================================================
// supabaseDemo.js — "Supabase de mentira" para a versão de demonstração
// ----------------------------------------------------------------------------
// Substitui src/lib/supabase.js só no build de demonstração (vite.demo.config.js).
// Guarda tudo na memória do navegador: nada vai para o banco real e, ao
// recarregar a página, os dados fictícios voltam ao estado inicial.
// Imita também os gatilhos de estoque do banco (OS e vendas).
// ============================================================================
import { criarDadosDemo } from './dadosDemo';

const db = criarDadosDemo();
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const agora = () => new Date().toISOString();
const copia = (v) => JSON.parse(JSON.stringify(v));
let seqVenda = Math.max(1000, ...db.vendas.map(v => v.numero));

const mover = (produtoId, qtd, tipo, motivo, extra = {}) => {
  const p = db.produtos.find(x => x.id === produtoId);
  if (!p) return;
  p.quantidade = Math.max(0, p.quantidade + (tipo === 'entrada' ? qtd : -qtd));
  db.movimentacoes.unshift({ id: novoId(), produto_id: produtoId, tipo, quantidade: qtd, motivo, criado_em: agora(), ...extra });
};

const PADROES = {
  clientes: () => ({ deletado_em: null, criado_em: agora() }),
  produtos: () => ({ deletado_em: null, criado_em: agora() }),
  tabela_precos: () => ({ ativo: true }),
  ordens_servico: () => ({ status: 'pendente', criado_em: agora() }),
  orcamentos: () => ({ status: 'aberto', criado_em: agora() }),
  vendas: () => ({ numero: ++seqVenda, status: 'finalizada', criado_em: agora(), desconto: 0 }),
  movimentacoes: () => ({ criado_em: agora() }),
  loja_produtos: () => ({ ativo: true, destaque: false, na_escolha: false, promo_principal: false, specs: [], fotos: [] }),
  loja_instalacoes: () => ({ ativo: true, legenda: '', ordem: 0, criado_em: agora() })
};

// Gatilhos (o que o banco real faz sozinho)
const aoInserir = (tabela, r) => {
  if (tabela === 'os_itens') {
    r.nome_snapshot = r.nome_snapshot || db.produtos.find(p => p.id === r.produto_id)?.nome || '';
    mover(r.produto_id, r.quantidade, 'saida', 'OS — uso de item', { os_id: r.os_id });
  }
  if (tabela === 'vendas_itens' && r.origem === 'estoque') mover(r.ref_id, r.quantidade, 'saida', 'Venda', { venda_id: r.venda_id });
};
const aoApagar = (tabela, r) => {
  if (tabela === 'os_itens') mover(r.produto_id, r.quantidade, 'entrada', 'Estorno — remoção de item', { os_id: r.os_id });
  if (tabela === 'ordens_servico') db.os_itens.filter(i => i.os_id === r.id).forEach(i => aoApagar('os_itens', i));
  if (tabela === 'ordens_servico') db.os_itens = db.os_itens.filter(i => i.os_id !== r.id);
};
const aoAtualizar = (tabela, antes, depois) => {
  if (tabela === 'vendas' && antes.status !== 'cancelada' && depois.status === 'cancelada') {
    db.vendas_itens.filter(i => i.venda_id === depois.id && i.origem === 'estoque')
      .forEach(i => mover(i.ref_id, i.quantidade, 'entrada', 'Estorno — venda cancelada', { venda_id: depois.id }));
  }
};

const comparar = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR');
};

class Consulta {
  constructor(tabela) {
    this.t = tabela; this.op = 'select'; this.filtros = []; this.ordem = []; this.lim = null;
    this.um = false; this.head = false; this.contar = false; this.valor = null; this.embutir = []; this.devolver = false;
  }
  select(cols = '*', opts = {}) {
    if (this.op === 'select') {
      this.embutir = [...String(cols).matchAll(/(\w+)\(\*\)/g)].map(m => m[1]);
      this.head = !!opts.head; this.contar = !!opts.count;
    } else this.devolver = true;
    return this;
  }
  insert(v) { this.op = 'insert'; this.valor = v; return this; }
  update(v) { this.op = 'update'; this.valor = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filtros.push(r => r[c] === v); return this; }
  is(c, v) { this.filtros.push(r => (r[c] ?? null) === v); return this; }
  order(c, o = {}) { this.ordem.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.um = true; return this; }
  then(ok, falha) { return new Promise(r => setTimeout(r, 60)).then(() => this.executar()).then(ok, falha); }

  linhas() { return (db[this.t] = db[this.t] || []).filter(r => this.filtros.every(f => f(r))); }

  executar() {
    const t = this.t;
    if (this.op === 'select') {
      let rows = this.linhas();
      if (this.head) return { data: null, count: rows.length, error: null };
      rows = [...rows].sort((a, b) => { for (const [c, asc] of this.ordem) { const d = comparar(a[c], b[c]); if (d) return asc ? d : -d; } return 0; });
      if (this.lim != null) rows = rows.slice(0, this.lim);
      rows = rows.map(r => {
        const x = copia(r);
        if (this.embutir.includes('os_itens')) x.os_itens = copia(db.os_itens.filter(i => i.os_id === r.id));
        if (this.embutir.includes('vendas_itens')) x.vendas_itens = copia(db.vendas_itens.filter(i => i.venda_id === r.id));
        return x;
      });
      if (this.um) return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'Nenhum registro encontrado' } };
      return { data: rows, count: this.contar ? rows.length : null, error: null };
    }
    if (this.op === 'insert') {
      const lista = (Array.isArray(this.valor) ? this.valor : [this.valor]).map(v => ({ id: novoId(), ...(PADROES[t]?.() || {}), ...copia(v) }));
      lista.forEach(r => { (db[t] = db[t] || []).push(r); aoInserir(t, r); });
      if (!this.devolver) return { data: null, error: null };
      return { data: this.um ? copia(lista[0]) : copia(lista), error: null };
    }
    if (this.op === 'update') {
      this.linhas().forEach(r => { const antes = { ...r }; Object.assign(r, copia(this.valor)); aoAtualizar(t, antes, r); });
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      const sai = this.linhas();
      db[t] = db[t].filter(r => !sai.includes(r));
      sai.forEach(r => aoApagar(t, r));
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

// Arquivos (fotos da loja, PDFs de notas) ficam na memória como blob:
const arquivos = new Map();
const storage = {
  from: () => ({
    upload: async (path, file) => { arquivos.set(path, URL.createObjectURL(file)); return { data: { path }, error: null }; },
    getPublicUrl: (path) => ({ data: { publicUrl: arquivos.get(path) || '' } }),
    createSignedUrl: async (path) => ({ data: { signedUrl: arquivos.get(path) || null }, error: null }),
    remove: async () => ({ data: null, error: null })
  })
};

// Login de mentira: já começa conectado; qualquer botão de entrar funciona
const usuario = { id: 'demo', email: 'demonstracao@servigas.com.br', user_metadata: { full_name: 'Equipe Servigás' } };
let sessao = { user: usuario, access_token: 'demo' };
const ouvintes = new Set();
const avisar = (evento) => ouvintes.forEach(cb => cb(evento, sessao));
const auth = {
  getSession: async () => ({ data: { session: sessao }, error: null }),
  onAuthStateChange: (cb) => { ouvintes.add(cb); return { data: { subscription: { unsubscribe: () => ouvintes.delete(cb) } } }; },
  signInWithPassword: async () => { sessao = { user: usuario, access_token: 'demo' }; avisar('SIGNED_IN'); return { data: { user: usuario, session: sessao }, error: null }; },
  signInWithOAuth: async () => { sessao = { user: usuario, access_token: 'demo' }; avisar('SIGNED_IN'); return { data: {}, error: null }; },
  signOut: async () => { sessao = null; avisar('SIGNED_OUT'); return { error: null }; }
};

export const supabase = { from: (tabela) => new Consulta(tabela), storage, auth };
