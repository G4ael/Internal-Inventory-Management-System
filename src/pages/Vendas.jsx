// ============================================================================
// VENDAS (PDV)
// Fluxo: nova venda → cliente → itens (estoque ou tabela de preços) →
// forma de pagamento → finaliza → emite NF → imprime DANFE.
// ============================================================================
import { useState, useMemo } from 'react';
import { ShoppingCart, X, Printer, CheckCircle2, Ban, Receipt } from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast, useNav } from '../contexto';
import { fmtBRL, fmtDataHora, hojeISO, diaDe, contem } from '../lib/format';
import { FORMAS_PAGAMENTO, rotuloPagamento } from '../lib/dominio';
import { emitirNotaFiscal, imprimirDanfe, IS_PROTOTIPO } from '../lib/integracoes';
import { PageHeader, BuscaPagina, Selo, Modal, Field, Vazio } from '../components/ui';

const novoForm = () => ({
  cliente: '', clienteId: '', clienteDocumento: '', clienteEndereco: '',
  itens: [], // [{ origem: 'estoque'|'tabela', refId, nome, qtd, preco }]
  desconto: 0,
  forma_pagamento: 'Dinheiro',
  tipo_nota: 'nfse', // 'nfse' | 'nfce' | 'sem_nota'
  observacoes: ''
});

const Vendas = ({ search, setSearch, intent }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const { abrirCliente } = useNav();
  const [modal, setModal] = useState(intent?.acao === 'nova' ? 'new' : null);
  const [resultModal, setResultModal] = useState(null); // { venda, nf }
  const [emitindo, setEmitindo] = useState(false);
  const [filtroData, setFiltroData] = useState('');
  const [form, setForm] = useState(() => (intent?.acao === 'nova' ? { ...novoForm(), ...(intent.dados || {}) } : null));
  const emitente = { razao: data.config.emitente_razao, cnpj: data.config.emitente_cnpj, inscricao: data.config.emitente_inscricao };

  const abrir = () => { setForm(novoForm()); setModal('new'); };

  /* === Cálculos === */
  const subtotal = useMemo(() => (form?.itens || []).reduce((s, it) => s + it.qtd * it.preco, 0), [form]);
  const total = subtotal - (form?.desconto || 0);

  /* === Itens === */
  const addProduto = (produtoId) => {
    const p = data.produtos.find(x => x.id === produtoId);
    if (!p) return;
    if (p.qtd <= 0) { toast(`${p.nome} sem estoque`, 'error'); return; }
    const existe = form.itens.find(i => i.origem === 'estoque' && i.refId === produtoId);
    if (existe) setForm({ ...form, itens: form.itens.map(i => i === existe ? { ...i, qtd: i.qtd + 1 } : i) });
    else setForm({ ...form, itens: [...form.itens, { origem: 'estoque', refId: p.id, nome: p.nome, qtd: 1, preco: p.preco }] });
  };
  const addServico = (itemId) => {
    const t = data.tabelaPrecos.find(x => x.id === itemId);
    if (!t) return;
    setForm({ ...form, itens: [...form.itens, { origem: 'tabela', refId: t.id, nome: t.nome, qtd: 1, preco: t.preco }] });
  };
  const updItem = (idx, qtd) => setForm({ ...form, itens: form.itens.map((it, i) => i === idx ? { ...it, qtd: Math.max(1, qtd) } : it) });
  const updPreco = (idx, preco) => setForm({ ...form, itens: form.itens.map((it, i) => i === idx ? { ...it, preco } : it) });
  const rmItem = (idx) => setForm({ ...form, itens: form.itens.filter((_, i) => i !== idx) });

  /* === Finalização === */
  const finalizar = async () => {
    if (!form.cliente.trim()) { toast('Informe o cliente', 'error'); return; }
    if (form.itens.length === 0) { toast('Adicione ao menos um item', 'error'); return; }
    setEmitindo(true);

    // 1. Insere a venda no banco (número gerado pela sequence, estoque via trigger)
    const { data: vendaCriada, error } = await db.inserirVenda({ ...form, total, status: 'finalizada' });
    if (error) { setEmitindo(false); toast(`Erro ao registrar venda: ${error.message}`, 'error'); return; }
    const venda = { ...form, ...vendaCriada, total, forma_pagamento: form.forma_pagamento };
    const numero = vendaCriada.numero;
    let nfDataFinal = null;

    // 2. Se for emitir nota, chama a API (mock por enquanto)
    if (form.tipo_nota !== 'sem_nota') {
      const res = await emitirNotaFiscal(data.config, {
        tipo: form.tipo_nota, cliente_nome: form.cliente, cliente_documento: form.clienteDocumento,
        cliente_endereco: form.clienteEndereco, descricao: form.itens.map(i => `${i.qtd}x ${i.nome}`).join(' + '),
        valor: total, itens: form.itens
      });
      if (!res.ok) {
        setEmitindo(false);
        toast(`Falha ao emitir NF: ${res.error}`, 'error');
        await recarregar();
        setModal(null);
        setResultModal({ venda, nf: null });
        return;
      }
      nfDataFinal = res.data;
      venda.nfNumero = res.data.numero;
      venda.nfChave = res.data.chave_acesso;
      venda.tipo_nota_emitida = res.data.tipo;
      await db.inserirNota({
        numero: res.data.numero, fornecedor: form.cliente, valor: total, data: hojeISO(),
        obs: `${form.tipo_nota.toUpperCase()} de venda #${numero}${res.data.simulado ? ' (SIMULADA)' : ''}. Chave: ${res.data.chave_acesso}`,
        pdfRef: null
      });
    }

    // 3. Recarrega tudo do banco (estoque já foi movido pelo trigger)
    await recarregar();
    setEmitindo(false);
    setModal(null);
    setResultModal({ venda, nf: nfDataFinal });
  };

  const cancelarVenda = async (v) => {
    if (!confirm(`Cancelar a venda #${v.numero}? O estoque volta, mas a NF NÃO é cancelada (isso é feito à parte).`)) return;
    await db.cancelarVenda(v.id); // o trigger do banco estorna o estoque
    await recarregar();
    toast('Venda cancelada', 'info');
  };

  const reimprimirNF = (v) => {
    if (!v.nfNumero) { toast('Venda sem NF emitida', 'error'); return; }
    imprimirDanfe({ ...v, forma_pagamento: rotuloPagamento(v.forma_pagamento) }, {
      numero: v.nfNumero, chave_acesso: v.nfChave, codigo_verificacao: '—',
      tipo: v.tipo_nota_emitida || v.tipo_nota, simulado: IS_PROTOTIPO
    }, emitente);
  };

  /* === Filtros === */
  const filtradas = data.vendas.filter(v => contem(`${v.cliente} ${v.numero}`, search) && (!filtroData || diaDe(v.data) === filtroData));
  const hoje = hojeISO();
  const vendasHoje = data.vendas.filter(v => diaDe(v.data) === hoje && v.status !== 'cancelada');
  const totalHoje = vendasHoje.reduce((s, v) => s + v.total, 0);

  return (
    <>
      <PageHeader titulo="Vendas" sub={`Hoje: ${vendasHoje.length} ${vendasHoje.length === 1 ? 'venda' : 'vendas'} · ${fmtBRL(totalHoje)}`}>
        <button className="btn btn-preto" onClick={abrir}><ShoppingCart /> Nova venda</button>
      </PageHeader>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar cliente ou número da venda" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="date" className="campo campo-sobre-fundo" style={{ width: 'auto', borderRadius: 999 }} value={filtroData} onChange={e => setFiltroData(e.target.value)} aria-label="Filtrar por data" />
          {filtroData && <button className="btn-icone" onClick={() => setFiltroData('')} aria-label="Limpar data"><X /></button>}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="cartao">
          <Vazio icone={ShoppingCart} titulo={data.vendas.length ? 'Nenhuma venda encontrada' : 'Nenhuma venda registrada'}
            texto={data.vendas.length ? 'Mude a busca ou a data.' : 'Registre vendas de balcão com produtos do estoque ou itens da tabela de preços, com ou sem nota.'}>
            {!data.vendas.length && <button className="btn btn-preto btn-sm" onClick={abrir}><ShoppingCart /> Nova venda</button>}
          </Vazio>
        </div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Nota</th><th className="dir">Total</th><th><span className="oculto-visual">Ações</span></th></tr></thead>
            <tbody>
              {filtradas.map(v => (
                <tr key={v.id} className={v.status === 'cancelada' ? 'apagada' : ''}>
                  <td className="num" style={{ fontWeight: 600 }}>#{v.numero}</td>
                  <td className="num t2" style={{ whiteSpace: 'nowrap' }}>{fmtDataHora(v.data)}</td>
                  <td>
                    {v.clienteId ? <button className="btn-texto" style={{ color: 'var(--tinta)', fontSize: 14 }} onClick={() => abrirCliente(v.clienteId)}>{v.cliente}</button> : <span style={{ fontWeight: 500 }}>{v.cliente}</span>}
                    {v.status === 'cancelada' && <span style={{ marginLeft: 8 }}><Selo tom="erro">Cancelada</Selo></span>}
                  </td>
                  <td className="t2">{v.itens.length} {v.itens.length === 1 ? 'item' : 'itens'}</td>
                  <td>{rotuloPagamento(v.forma_pagamento)}</td>
                  <td>{v.nfNumero ? <Selo tom="ok">{v.tipo_nota_emitida?.toUpperCase()} {v.nfNumero}</Selo> : <Selo tom="neutro">Sem nota</Selo>}</td>
                  <td className="dir num" style={{ fontWeight: 600 }}>{fmtBRL(v.total)}</td>
                  <td className="acoes-linha">
                    {v.nfNumero && <button className="btn-icone" onClick={() => reimprimirNF(v)} title="Reimprimir DANFE" aria-label="Reimprimir DANFE"><Printer /></button>}
                    {v.status !== 'cancelada' && <button className="btn-icone perigo" onClick={() => cancelarVenda(v)} title="Cancelar venda" aria-label="Cancelar venda"><Ban /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* NOVA VENDA */}
      <Modal open={!!modal} onClose={() => !emitindo && setModal(null)} title="Nova venda" maxWidth="820px"
        rodape={form && <>
          <button className="btn btn-contorno" onClick={() => setModal(null)} disabled={emitindo}>Cancelar</button>
          <button className="btn btn-preto" onClick={finalizar} disabled={emitindo}>
            {emitindo ? 'Emitindo NF…' : form.tipo_nota === 'sem_nota' ? 'Finalizar venda' : 'Finalizar e emitir NF'}
          </button>
        </>}>
        {form && (
          <div className="grade-form">
            <div className="secao-form">Cliente</div>
            <Field label="Cliente" span={12}>
              <select className="campo" value={form.clienteId} onChange={e => {
                const c = data.clientes.find(x => x.id === e.target.value);
                if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, clienteDocumento: c.documento || '', clienteEndereco: c.endereco || '' });
                else setForm({ ...form, clienteId: '' });
              }}>
                <option value="">— Consumidor avulso —</option>
                {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Nome" span={6}><input className="campo" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
            <Field label="CPF/CNPJ" span={6}><input className="campo mono" value={form.clienteDocumento} onChange={e => setForm({ ...form, clienteDocumento: e.target.value })} placeholder="necessário para NF" /></Field>
            <Field label="Endereço" span={12}><input className="campo" value={form.clienteEndereco} onChange={e => setForm({ ...form, clienteEndereco: e.target.value })} /></Field>

            <div className="secao-form">Itens</div>
            <Field span={6}>
              <select className="campo" value="" onChange={e => { if (e.target.value) addProduto(e.target.value); }} aria-label="Adicionar produto do estoque">
                <option value="">+ Produto do estoque…</option>
                {data.produtos.filter(p => p.qtd > 0).map(p => <option key={p.id} value={p.id}>{p.nome} (est: {p.qtd}) — {fmtBRL(p.preco)}</option>)}
              </select>
            </Field>
            <Field span={6}>
              <select className="campo" value="" onChange={e => { if (e.target.value) addServico(e.target.value); }} aria-label="Adicionar item da tabela de preços">
                <option value="">+ Item da tabela de preços…</option>
                {data.tabelaPrecos.map(t => <option key={t.id} value={t.id}>{t.nome} — {fmtBRL(t.preco)}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: 'span 12' }}>
              {form.itens.length === 0 ? (
                <div className="vazio" style={{ padding: 24, background: 'var(--tile)', borderRadius: 14 }}><p>Carrinho vazio — adicione itens acima.</p></div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tabela" style={{ fontSize: 13.5 }}>
                    <thead><tr><th style={{ paddingLeft: 0 }}>Item</th><th>Origem</th><th className="dir" style={{ width: 90 }}>Qtd</th><th className="dir" style={{ width: 130 }}>Preço</th><th className="dir">Subtotal</th><th style={{ width: 40 }} /></tr></thead>
                    <tbody>
                      {form.itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ paddingLeft: 0 }}>{it.nome}</td>
                          <td><Selo tom={it.origem === 'estoque' ? 'info' : 'neutro'}>{it.origem === 'estoque' ? 'Produto' : 'Serviço'}</Selo></td>
                          <td className="dir"><input type="number" min="1" className="campo num" style={{ textAlign: 'right', height: 36 }} value={it.qtd} onChange={e => updItem(i, parseInt(e.target.value) || 1)} aria-label={`Quantidade de ${it.nome}`} /></td>
                          <td className="dir"><input type="number" step="0.01" className="campo num" style={{ textAlign: 'right', height: 36 }} value={it.preco} onChange={e => updPreco(i, parseFloat(e.target.value) || 0)} aria-label={`Preço de ${it.nome}`} /></td>
                          <td className="dir num" style={{ fontWeight: 600 }}>{fmtBRL(it.qtd * it.preco)}</td>
                          <td style={{ paddingRight: 0 }}><button className="btn-icone" onClick={() => rmItem(i)} aria-label={`Tirar ${it.nome}`}><X /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="secao-form">Pagamento e nota</div>
            <Field label="Forma de pagamento" span={4}>
              <select className="campo" value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Tipo de nota" span={4}>
              <select className="campo" value={form.tipo_nota} onChange={e => setForm({ ...form, tipo_nota: e.target.value })}>
                <option value="nfce">NFC-e (produto)</option>
                <option value="nfse">NFS-e (serviço)</option>
                <option value="sem_nota">Sem nota fiscal</option>
              </select>
            </Field>
            <Field label="Desconto (R$)" span={4}><input type="number" step="0.01" className="campo num" value={form.desconto} onChange={e => setForm({ ...form, desconto: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="Observações" span={12}><input className="campo" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></Field>

            <div style={{ gridColumn: 'span 12', background: 'var(--tile)', borderRadius: 16, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span className="t2">Subtotal</span><span className="num">{fmtBRL(subtotal)}</span></div>
              {form.desconto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span className="t2">Desconto</span><span className="num">− {fmtBRL(form.desconto)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--linha-forte)' }}>
                <span style={{ fontWeight: 600 }}>Total</span>
                <span className="num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.01em' }}>{fmtBRL(total)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* RESULTADO DA VENDA */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title="Venda finalizada" maxWidth="480px">
        {resultModal && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--ok-fundo)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><CheckCircle2 size={30} /></div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>Venda #{resultModal.venda.numero}</div>
              <div className="t2">{fmtBRL(resultModal.venda.total)} · {rotuloPagamento(resultModal.venda.forma_pagamento)}</div>
            </div>
            {resultModal.nf ? (
              <div style={{ background: 'var(--tile)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div className="t3" style={{ fontSize: 12.5, marginBottom: 4 }}>Nota emitida</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}><Receipt size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{resultModal.nf.tipo.toUpperCase()} nº {resultModal.nf.numero}</div>
                <div className="mono t2" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>Chave: {resultModal.nf.chave_acesso}</div>
                {resultModal.nf.simulado && <div style={{ marginTop: 8 }}><Selo tom="aviso">Modo protótipo — NF simulada</Selo></div>}
              </div>
            ) : (
              <div className="t2" style={{ background: 'var(--tile)', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center', fontSize: 14 }}>Venda registrada sem nota fiscal</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultModal.nf && (
                <button className="btn btn-preto" onClick={() => imprimirDanfe({ ...resultModal.venda, forma_pagamento: rotuloPagamento(resultModal.venda.forma_pagamento) }, resultModal.nf, emitente)}>
                  <Printer /> Imprimir DANFE
                </button>
              )}
              <button className="btn btn-contorno" onClick={() => setResultModal(null)}>Fechar</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

export default Vendas;
