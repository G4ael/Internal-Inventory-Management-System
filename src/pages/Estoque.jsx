// ============================================================================
// ESTOQUE + MOVIMENTAÇÕES
// ============================================================================
import { useState } from 'react';
import { Plus, Edit2, Trash2, ArrowDownUp, Package, ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast } from '../contexto';
import { fmtBRL, fmtNum, fmtDataHora, contem } from '../lib/format';
import { PageHeader, BuscaPagina, Segmentado, Selo, Modal, Field, Vazio } from '../components/ui';

const PROD_VAZIO = { nome: '', sku: '', qtd: 0, minimo: 1, preco: 0 };

const Estoque = ({ search, setSearch, intent }) => {
  const { data, recarregar, registrarMovimentacao } = useData();
  const toast = useToast();

  const [inicio] = useState(() => {
    if (intent?.acao === 'nova') return { modal: 'new', form: PROD_VAZIO };
    if (intent?.acao === 'abrir') { const p = data.produtos.find(x => x.id === intent.id); if (p) return { modal: 'edit', form: p }; }
    return { modal: null, form: PROD_VAZIO };
  });
  const [aba, setAba] = useState('produtos');
  const [soAlerta, setSoAlerta] = useState(intent?.filtro === 'alerta');
  const [modal, setModal] = useState(inicio.modal);
  const [form, setForm] = useState(inicio.form);
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState({ produtoId: '', tipo: 'entrada', qtd: 1, motivo: '' });

  const abrir = (p) => { setForm(p || PROD_VAZIO); setModal(p ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.nome.trim()) { toast('Dê um nome ao produto', 'error'); return; }
    const { error } = modal === 'edit' ? await db.atualizarProduto(form.id, form) : await db.inserirProduto(form);
    if (error) { toast('Não foi possível salvar: ' + error.message, 'error'); return; }
    await recarregar();
    setModal(null);
  };
  const remover = async (p) => { if (confirm(`Remover "${p.nome}" do estoque?`)) { await db.removerProduto(p.id); await recarregar(); } };

  const abrirMov = (produtoId = '') => { setMovForm({ produtoId, tipo: 'entrada', qtd: 1, motivo: '' }); setMovModal(true); };
  const registrarMov = async () => {
    if (!movForm.produtoId || !movForm.qtd) { toast('Escolha o produto e a quantidade', 'error'); return; }
    setMovModal(false);
    await registrarMovimentacao(movForm.produtoId, movForm.tipo, movForm.qtd, movForm.motivo || 'Ajuste manual');
    toast(movForm.tipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada', 'success');
  };

  const alerta = data.produtos.filter(p => p.qtd <= p.minimo);
  const valorEstoque = data.produtos.reduce((s, p) => s + p.qtd * p.preco, 0);
  const filtrados = data.produtos.filter(p => contem(`${p.nome} ${p.sku}`, search) && (!soAlerta || p.qtd <= p.minimo));
  const movFiltradas = data.movimentacoes.filter(m => {
    const p = data.produtos.find(x => x.id === m.produtoId);
    return contem(`${p?.nome || ''} ${m.motivo || ''}`, search);
  });

  return (
    <>
      <PageHeader titulo="Estoque" sub={`${data.produtos.length} produtos · ${data.movimentacoes.length} movimentações recentes`}>
        <button className="btn btn-contorno" onClick={() => abrirMov()}><ArrowDownUp /> Lançar movimentação</button>
        <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Novo produto</button>
      </PageHeader>

      <div className="grade-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 16 }}>
        <div className="cartao"><div className="kpi-cab"><span>Produtos</span><span className="kpi-ic"><Package /></span></div><div className="kpi-valor">{fmtNum(data.produtos.length)}</div><div className="kpi-rodape">{fmtNum(data.produtos.reduce((s, p) => s + p.qtd, 0))} unidades no total</div></div>
        <div className="cartao"><div className="kpi-cab"><span>Valor em estoque</span><span className="kpi-ic"><SlidersHorizontal /></span></div><div className="kpi-valor" title={fmtBRL(valorEstoque)}>{fmtBRL(valorEstoque)}</div><div className="kpi-rodape">quantidade × preço de cada item</div></div>
        <button className="cartao clicavel" onClick={() => { setAba('produtos'); setSoAlerta(true); }}>
          <div className="kpi-cab"><span>Em alerta</span><span className="kpi-ic" style={alerta.length ? { background: 'var(--erro-fundo)', color: 'var(--erro)' } : undefined}><Package /></span></div>
          <div className="kpi-valor" style={alerta.length ? { color: 'var(--erro)' } : undefined}>{fmtNum(alerta.length)}</div>
          <div className="kpi-rodape">{alerta.length ? 'no estoque mínimo ou abaixo · clique para ver' : 'tudo acima do mínimo'}</div>
        </button>
      </div>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder={aba === 'produtos' ? 'Buscar produto ou SKU' : 'Buscar produto ou motivo'} />
        <Segmentado rotulo="Aba" valor={aba} onChange={setAba} opcoes={[{ id: 'produtos', label: 'Produtos', icone: Package }, { id: 'mov', label: 'Movimentações', icone: ArrowDownUp }]} />
        {aba === 'produtos' && <button className="chip" aria-pressed={soAlerta} onClick={() => setSoAlerta(v => !v)}>Só em alerta <span className="qtd">{alerta.length}</span></button>}
      </div>

      {aba === 'produtos' && (filtrados.length === 0 ? (
        <div className="cartao"><Vazio icone={Package} titulo={data.produtos.length ? 'Nenhum produto encontrado' : 'Nenhum produto ainda'} texto={data.produtos.length ? 'Limpe a busca ou o filtro de alerta.' : 'Cadastre os produtos para controlar entradas, saídas e o mínimo de cada um.'} /></div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Produto</th><th>Quantidade</th><th className="dir">Mínimo</th><th className="dir">Preço</th><th className="dir">Valor em estoque</th><th><span className="oculto-visual">Ações</span></th></tr></thead>
            <tbody>
              {filtrados.map(p => {
                const baixo = p.qtd <= p.minimo;
                return (
                  <tr key={p.id}>
                    <td><div style={{ fontWeight: 500 }}>{p.nome}</div>{p.sku && <div className="t3 mono" style={{ fontSize: 12 }}>{p.sku}</div>}</td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <b className="num" style={{ fontWeight: 600, minWidth: 24, color: baixo ? 'var(--erro)' : undefined }}>{p.qtd}</b>
                        <span className={`medidor ${baixo ? 'baixo' : ''}`} style={{ flex: 1, maxWidth: 110 }}><i style={{ width: `${Math.min(100, (p.qtd / Math.max(1, p.minimo * 3)) * 100)}%` }} /></span>
                        {baixo && <Selo tom="erro">Repor</Selo>}
                      </div>
                    </td>
                    <td className="dir num t2">{p.minimo}</td>
                    <td className="dir num">{fmtBRL(p.preco)}</td>
                    <td className="dir num">{fmtBRL(p.qtd * p.preco)}</td>
                    <td className="acoes-linha">
                      <button className="btn-icone" onClick={() => abrirMov(p.id)} title="Lançar entrada ou saída" aria-label={`Movimentar ${p.nome}`}><ArrowDownUp /></button>
                      <button className="btn-icone" onClick={() => abrir(p)} title="Editar" aria-label={`Editar ${p.nome}`}><Edit2 /></button>
                      <button className="btn-icone perigo" onClick={() => remover(p)} title="Remover" aria-label={`Remover ${p.nome}`}><Trash2 /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {aba === 'mov' && (movFiltradas.length === 0 ? (
        <div className="cartao"><Vazio icone={ArrowDownUp} titulo="Nenhuma movimentação" texto="Entradas, saídas das OS e das vendas aparecem aqui." /></div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="dir">Qtd</th><th>Motivo</th></tr></thead>
            <tbody>
              {movFiltradas.slice(0, 100).map(m => {
                const prod = data.produtos.find(p => p.id === m.produtoId);
                const entrada = m.tipo === 'entrada';
                return (
                  <tr key={m.id}>
                    <td className="num t2" style={{ whiteSpace: 'nowrap' }}>{fmtDataHora(m.data)}</td>
                    <td>{prod?.nome || <span className="t3">produto removido</span>}</td>
                    <td><Selo tom={entrada ? 'ok' : m.tipo === 'saida' ? 'erro' : 'neutro'} icone={entrada ? ArrowDownLeft : ArrowUpRight}>{entrada ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste'}</Selo></td>
                    <td className="dir num" style={{ fontWeight: 600 }}>{m.tipo === 'saida' ? '−' : '+'}{m.qtd}</td>
                    <td className="t2">{m.motivo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar produto' : 'Novo produto'}
        rodape={<><button className="btn btn-contorno" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvar}>Salvar</button></>}>
        <div className="grade-form">
          <Field label="Nome" span={12}><input className="campo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="SKU" span={6}><input className="campo mono" value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Preço (R$)" span={6}><input type="number" step="0.01" className="campo num" value={form.preco} onChange={e => setForm({ ...form, preco: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Quantidade" span={6}><input type="number" className="campo num" value={form.qtd} onChange={e => setForm({ ...form, qtd: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Estoque mínimo" span={6}><input type="number" className="campo num" value={form.minimo} onChange={e => setForm({ ...form, minimo: parseInt(e.target.value) || 0 })} /></Field>
        </div>
      </Modal>

      <Modal open={movModal} onClose={() => setMovModal(false)} title="Lançar movimentação"
        rodape={<><button className="btn btn-contorno" onClick={() => setMovModal(false)}>Cancelar</button><button className="btn btn-preto" onClick={registrarMov}>Registrar</button></>}>
        <div className="grade-form">
          <Field label="Produto" span={12}>
            <select className="campo" value={movForm.produtoId} onChange={e => setMovForm({ ...movForm, produtoId: e.target.value })}>
              <option value="">— Selecione —</option>
              {data.produtos.map(p => <option key={p.id} value={p.id}>{p.nome} (estoque: {p.qtd})</option>)}
            </select>
          </Field>
          <Field label="Tipo" span={6}>
            <Segmentado rotulo="Tipo" valor={movForm.tipo} onChange={(t) => setMovForm({ ...movForm, tipo: t })} opcoes={[{ id: 'entrada', label: 'Entrada', icone: ArrowDownLeft }, { id: 'saida', label: 'Saída', icone: ArrowUpRight }]} />
          </Field>
          <Field label="Quantidade" span={6}><input type="number" min="1" className="campo num" value={movForm.qtd} onChange={e => setMovForm({ ...movForm, qtd: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Motivo" span={12}><input className="campo" value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} placeholder="Ex: Compra do fornecedor X" /></Field>
        </div>
      </Modal>
    </>
  );
};

export default Estoque;
