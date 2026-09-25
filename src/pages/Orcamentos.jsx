// ============================================================================
// ORÇAMENTOS — com tabela de preços ao lado
// ============================================================================
import { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Copy, MessageCircle, Receipt, Wrench, RefreshCw, MapPin, CalendarDays, Tag, DollarSign
} from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast, useNav } from '../contexto';
import { fmtBRL, fmtDate, hojeISO, somarDias, diasEntre, contem, normalizar, linkWhats, copiarTexto } from '../lib/format';
import { STATUS_ORC, statusOrc, montarTextoOrcamento } from '../lib/dominio';
import { emitirNotaFiscal } from '../lib/integracoes';
import { PageHeader, BuscaPagina, Chips, Selo, Modal, Field, Vazio } from '../components/ui';

const FORM_VAZIO = () => ({ cliente: '', clienteId: '', clienteDocumento: '', clienteEndereco: '', local: '', itens: '', total: 0, validade: '', data: hojeISO(), status: 'aberto' });
const FILTRO_INTENT = { aberto: 'pendentes', pendentes: 'pendentes', vencido: 'vencido', aprovado: 'aprovado', recusado: 'recusado' };

const Orcamentos = ({ search, setSearch, intent }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const { ir, abrirCliente } = useNav();
  const hoje = hojeISO();

  const [inicio] = useState(() => {
    if (intent?.acao === 'nova') return { modal: 'new', form: { ...FORM_VAZIO(), ...(intent.dados || {}) } };
    if (intent?.acao === 'abrir') { const o = data.orcamentos.find(x => x.id === intent.id); if (o) return { modal: 'edit', form: o }; }
    return { modal: null, form: FORM_VAZIO() };
  });
  const [modal, setModal] = useState(inicio.modal);
  const [form, setForm] = useState(inicio.form);
  const [filtro, setFiltro] = useState(FILTRO_INTENT[intent?.filtro] || 'todos');
  const [tabModal, setTabModal] = useState(null);
  const [tabForm, setTabForm] = useState({ nome: '', categoria: '', descricao: '', preco: 0 });
  const [gerandoNF, setGerandoNF] = useState(null);
  const [expandidos, setExpandidos] = useState({});

  /* === Orçamentos === */
  const abrir = (o) => { setForm(o || FORM_VAZIO()); setModal(o ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.cliente.trim()) { toast('Informe o nome do cliente', 'error'); return; }
    const { error } = modal === 'edit' ? await db.atualizarOrcamento(form.id, form) : await db.inserirOrcamento(form);
    if (error) { toast('Não foi possível salvar: ' + error.message, 'error'); return; }
    await recarregar(); setModal(null);
    toast(modal === 'edit' ? 'Orçamento atualizado' : 'Orçamento criado', 'success');
  };
  const remover = async (o) => {
    if (!confirm(`Remover o orçamento de ${o.cliente}?`)) return;
    await db.removerOrcamento(o.id); await recarregar();
  };

  // Insere um item da tabela de preços na descrição e soma no total
  const inserirDaTabela = (id) => {
    const t = data.tabelaPrecos.find(x => x.id === id);
    if (!t) return;
    const linha = `• ${t.nome} — ${fmtBRL(t.preco)}`;
    setForm(f => ({ ...f, itens: f.itens ? `${f.itens.replace(/\s+$/, '')}\n${linha}` : linha, total: Math.round((Number(f.total || 0) + t.preco) * 100) / 100 }));
  };

  const renovar = async (o) => {
    const validade = somarDias(hoje, 15);
    const { error } = await db.atualizarOrcamento(o.id, { ...o, validade });
    if (error) { toast('Não foi possível renovar: ' + error.message, 'error'); return; }
    await recarregar();
    toast(`Validade renovada até ${fmtDate(validade)}`, 'success');
  };

  // Abre a OS já preenchida; ao salvar, o orçamento vira "aprovado"
  const criarOS = (o) => {
    const c = data.clientes.find(x => x.id === o.clienteId);
    ir('servicos', {
      acao: 'nova', orcamentoId: o.id,
      dados: {
        clienteId: o.clienteId || '', cliente: o.cliente, telefone: c?.telefone || '',
        endereco: o.local || o.clienteEndereco || c?.endereco || '',
        equipamentos: o.itens || '', obs: `Orçamento de ${fmtDate(o.data)} · ${fmtBRL(o.total)}`
      }
    });
  };

  /* === Tabela de preços (CRUD independente) === */
  const abrirTab = (t) => { setTabForm(t || { nome: '', categoria: '', descricao: '', preco: 0 }); setTabModal(t ? 'edit' : 'new'); };
  const salvarTab = async () => {
    if (!tabForm.nome.trim()) { toast('Dê um nome ao item', 'error'); return; }
    if (tabModal === 'edit') await db.atualizarTabelaPreco(tabForm.id, tabForm);
    else await db.inserirTabelaPreco(tabForm);
    await recarregar();
    setTabModal(null);
  };
  const removerTab = async (t) => {
    if (confirm(`Remover "${t.nome}" da tabela?`)) { await db.removerTabelaPreco(t.id); await recarregar(); }
  };

  /* === Gerar NF a partir do orçamento === */
  const gerarNF = async (orc) => {
    if (!data.config.plugnotas_token || !data.config.emitente_cnpj) {
      toast('Configure a Plugnotas em Configurações → Integrações', 'info');
      return;
    }
    setGerandoNF(orc.id);
    const res = await emitirNotaFiscal(data.config, {
      tipo: 'nfse',
      cliente_nome: orc.cliente,
      cliente_documento: orc.clienteDocumento || '',
      cliente_endereco: orc.clienteEndereco || orc.local,
      descricao: orc.itens,
      valor: orc.total
    });
    setGerandoNF(null);
    if (res.ok) {
      // Cria registro na aba Notas e marca orçamento como aprovado
      await db.inserirNota({
        numero: res.data.numero,
        fornecedor: orc.cliente,
        valor: orc.total,
        data: hoje,
        obs: `Gerada do orçamento. Chave: ${res.data.chave_acesso || '—'}${res.data.simulado ? ' (SIMULADA)' : ''}`,
        pdfRef: null
      });
      await db.atualizarOrcamento(orc.id, { ...orc, status: 'aprovado', nfNumero: res.data.numero });
      await recarregar();
      toast(res.data.simulado ? `NF simulada nº ${res.data.numero}` : `NF nº ${res.data.numero} emitida`, 'success');
    } else {
      toast(res.error, 'error');
    }
  };

  /* === Copiar e enviar === */
  const texto = (o) => montarTextoOrcamento(o, data.config.emitente_razao);
  const copiarOrcamento = async (o) => { await copiarTexto(texto(o)); toast('Orçamento copiado — cole no WhatsApp ou no email', 'success'); };
  const telefoneDe = (o) => data.clientes.find(c => c.id === o.clienteId)?.telefone;
  const enviarWhats = (o) => window.open(linkWhats(telefoneDe(o), texto(o)) || `https://wa.me/?text=${encodeURIComponent(texto(o))}`, '_blank');

  /* === Filtros === */
  const comStatus = data.orcamentos.map(o => ({ ...o, st: statusOrc(o, hoje) }));
  const porBusca = comStatus.filter(o => contem(`${o.cliente} ${o.local} ${o.itens}`, search));
  const passa = (o) => filtro === 'todos' || (filtro === 'pendentes' ? (o.st === 'aberto' || o.st === 'vencido') : o.st === filtro);
  const filtrados = porBusca.filter(passa);
  const conta = (f) => porBusca.filter(o => f === 'pendentes' ? (o.st === 'aberto' || o.st === 'vencido') : o.st === f).length;
  const emAbertoValor = comStatus.filter(o => o.st === 'aberto' || o.st === 'vencido').reduce((s, o) => s + o.total, 0);

  // Tabela de preços agrupada por categoria (sem diferenciar maiúsculas)
  const tabPorCategoria = useMemo(() => {
    const g = new Map();
    data.tabelaPrecos.filter(t => contem(`${t.nome} ${t.categoria}`, search)).forEach(t => {
      const chave = normalizar(t.categoria) || 'outros';
      if (!g.has(chave)) g.set(chave, { nome: t.categoria || 'Outros', itens: [] });
      g.get(chave).itens.push(t);
    });
    return [...g.values()];
  }, [data.tabelaPrecos, search]);

  const validadeTxt = (o) => {
    if (!o.validade) return null;
    if (o.st === 'vencido') { const d = diasEntre(o.validade, hoje); return <span style={{ color: 'var(--erro)', fontWeight: 500 }}>Venceu há {d} {d === 1 ? 'dia' : 'dias'}</span>; }
    return <>Vale até {fmtDate(o.validade)}</>;
  };

  return (
    <>
      <PageHeader titulo="Orçamentos" sub={`${data.orcamentos.length} orçamentos · ${fmtBRL(emAbertoValor)} aguardando resposta`}>
        <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Novo orçamento</button>
      </PageHeader>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar cliente, local ou item" />
        <Chips rotulo="Filtrar por situação" valor={filtro} onChange={setFiltro} opcoes={[
          { id: 'todos', label: 'Todos', qtd: porBusca.length },
          { id: 'pendentes', label: 'Aguardando resposta', qtd: conta('pendentes') },
          { id: 'vencido', label: 'Vencidos', qtd: conta('vencido') },
          { id: 'aprovado', label: 'Aprovados', qtd: conta('aprovado') },
          { id: 'recusado', label: 'Recusados', qtd: conta('recusado') }
        ]} />
      </div>

      <div className="grade-painel" style={{ marginTop: 0 }}>
        <div className="coluna" style={{ gap: 12 }}>
          {filtrados.length === 0 ? (
            <div className="cartao">
              <Vazio icone={Receipt} titulo={data.orcamentos.length ? 'Nenhum orçamento com esses filtros' : 'Nenhum orçamento ainda'}
                texto={data.orcamentos.length ? 'Mude o filtro ou a busca para ver os outros.' : 'Monte o primeiro orçamento usando os itens da tabela de preços ao lado.'}>
                {!data.orcamentos.length && <button className="btn btn-preto btn-sm" onClick={() => abrir(null)}><Plus /> Novo orçamento</button>}
              </Vazio>
            </div>
          ) : filtrados.map(o => (
            <article key={o.id} className="orc-cartao">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {o.clienteId
                      ? <button className="btn-texto" style={{ color: 'var(--tinta)', fontSize: 16 }} onClick={() => abrirCliente(o.clienteId)}>{o.cliente}</button>
                      : <b style={{ fontSize: 16, fontWeight: 600 }}>{o.cliente}</b>}
                    <Selo tom={STATUS_ORC[o.st].tom}>{STATUS_ORC[o.st].label}</Selo>
                    {o.nfNumero && <Selo tom="info" icone={Receipt}>NF {o.nfNumero}</Selo>}
                  </div>
                  <div className="os-info">
                    <span><CalendarDays />{fmtDate(o.data)}</span>
                    {o.local && <span><MapPin />{o.local}</span>}
                    {o.validade && <span>{validadeTxt(o)}</span>}
                  </div>
                </div>
                <div className="orc-valor">{fmtBRL(o.total)}</div>
              </div>
              {o.itens && (
                <div>
                  <div className="orc-desc"><div className={expandidos[o.id] ? '' : 'limite-3'}>{o.itens}</div></div>
                  {o.itens.split('\n').length > 3 && (
                    <button className="btn-texto" style={{ marginTop: 6 }} onClick={() => setExpandidos(e => ({ ...e, [o.id]: !e[o.id] }))}>
                      {expandidos[o.id] ? 'Mostrar menos' : 'Mostrar tudo'}
                    </button>
                  )}
                </div>
              )}
              <div className="orc-acoes">
                {(o.st === 'aberto' || o.st === 'vencido') && (
                  <button className="btn btn-preto btn-sm" onClick={() => criarOS(o)} title="Abre a OS preenchida; ao salvar, o orçamento fica aprovado"><Wrench /> Aprovar e criar OS</button>
                )}
                {o.st === 'vencido' && <button className="btn btn-suave btn-sm" onClick={() => renovar(o)} title="Nova validade: 15 dias a partir de hoje"><RefreshCw /> Renovar</button>}
                <button className="btn btn-whats btn-sm" onClick={() => enviarWhats(o)} title={telefoneDe(o) ? 'Enviar para o WhatsApp do cliente' : 'Escolher o contato no WhatsApp'}><MessageCircle /> WhatsApp</button>
                {!o.nfNumero && (
                  <button className="btn btn-contorno btn-sm" onClick={() => gerarNF(o)} disabled={gerandoNF === o.id} title="Emitir NF pela Plugnotas">
                    <Receipt /> {gerandoNF === o.id ? 'Emitindo…' : 'Gerar NF'}
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <button className="btn-icone" onClick={() => copiarOrcamento(o)} aria-label="Copiar orçamento formatado" title="Copiar o texto (para colar no WhatsApp ou email)"><Copy /></button>
                <button className="btn-icone" onClick={() => abrir(o)} aria-label="Editar orçamento" title="Editar"><Edit2 /></button>
                <button className="btn-icone perigo" onClick={() => remover(o)} aria-label="Remover orçamento" title="Remover"><Trash2 /></button>
              </div>
            </article>
          ))}
        </div>

        {/* Tabela de preços EDITÁVEL */}
        <aside className="cartao">
          <div className="cartao-cab">
            <div><h2 className="titulo-cartao">Tabela de preços</h2><p>{data.tabelaPrecos.length} itens · usados nos orçamentos e vendas</p></div>
            <button className="btn btn-suave btn-sm" onClick={() => abrirTab(null)}><Plus /> Item</button>
          </div>
          {tabPorCategoria.length === 0 ? (
            <Vazio icone={DollarSign} titulo="Nenhum item" texto="Cadastre serviços e produtos com preço para montar orçamentos mais rápido." />
          ) : tabPorCategoria.map(g => (
            <div key={g.nome} style={{ marginBottom: 12 }}>
              <div className="t3" style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 2px' }}><Tag size={13} />{g.nome}</div>
              {g.itens.map(t => (
                <div key={t.id} className="preco-linha">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }} className="limite-2">{t.nome}</div>
                    {t.descricao && <div className="t3 limite-2" style={{ fontSize: 12.5 }}>{t.descricao}</div>}
                  </div>
                  <div className="num" style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{fmtBRL(t.preco)}</div>
                  <div className="acoes-hover">
                    <button className="btn-icone" style={{ width: 30, height: 30 }} onClick={() => abrirTab(t)} aria-label={`Editar ${t.nome}`}><Edit2 size={14} /></button>
                    <button className="btn-icone perigo" style={{ width: 30, height: 30 }} onClick={() => removerTab(t)} aria-label={`Remover ${t.nome}`}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </aside>
      </div>

      {/* Janela do orçamento */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar orçamento' : 'Novo orçamento'} maxWidth="680px"
        rodape={<><button className="btn btn-contorno" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvar}>Salvar orçamento</button></>}>
        <div className="grade-form">
          <Field label="Cliente cadastrado" span={12}>
            <select className="campo" value={form.clienteId || ''} onChange={(e) => {
              const c = data.clientes.find(x => x.id === e.target.value);
              if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, clienteDocumento: c.documento || '', clienteEndereco: c.endereco || '', local: form.local || c.endereco || '' });
              else setForm({ ...form, clienteId: '' });
            }}>
              <option value="">— Cliente avulso —</option>
              {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Nome do cliente" span={6}><input className="campo" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="CPF/CNPJ" span={6}><input className="campo mono" value={form.clienteDocumento || ''} onChange={e => setForm({ ...form, clienteDocumento: e.target.value })} /></Field>
          <Field label="Local / endereço" span={12}><input className="campo" value={form.local || ''} onChange={e => setForm({ ...form, local: e.target.value })} /></Field>
          <Field label="Inserir item da tabela de preços" span={12} dica="Cada item entra como uma linha na descrição e o preço é somado ao total.">
            <select className="campo" value="" onChange={e => { if (e.target.value) inserirDaTabela(e.target.value); }}>
              <option value="">+ Escolher item…</option>
              {data.tabelaPrecos.map(t => <option key={t.id} value={t.id}>{t.nome} — {fmtBRL(t.preco)}</option>)}
            </select>
          </Field>
          <Field label="Itens / descrição" span={12}><textarea className="campo" rows="5" value={form.itens || ''} onChange={e => setForm({ ...form, itens: e.target.value })} /></Field>
          <Field label="Total (R$)" span={4}><input type="number" step="0.01" className="campo num" value={form.total} onChange={e => setForm({ ...form, total: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Validade" span={4}>
            <input type="date" className="campo" value={form.validade || ''} onChange={e => setForm({ ...form, validade: e.target.value })} />
            <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 12.5 }} className="t3">
              {[7, 15, 30].map(d => <button key={d} type="button" className="btn-texto" style={{ fontSize: 12.5 }} onClick={() => setForm({ ...form, validade: somarDias(form.data || hoje, d) })}>+{d} dias</button>)}
            </div>
          </Field>
          <Field label="Status" span={4}>
            <select className="campo" value={form.status || 'aberto'} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="aberto">Aberto</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option><option value="vencido">Vencido</option>
            </select>
          </Field>
        </div>
      </Modal>

      {/* Janela da tabela de preços */}
      <Modal open={!!tabModal} onClose={() => setTabModal(null)} title={tabModal === 'edit' ? 'Editar item da tabela' : 'Novo item na tabela'}
        rodape={<><button className="btn btn-contorno" onClick={() => setTabModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvarTab}>Salvar</button></>}>
        <div className="grade-form">
          <Field label="Nome" span={12}><input className="campo" value={tabForm.nome} onChange={e => setTabForm({ ...tabForm, nome: e.target.value })} /></Field>
          <Field label="Categoria" span={6}>
            <input className="campo" value={tabForm.categoria || ''} onChange={e => setTabForm({ ...tabForm, categoria: e.target.value })} placeholder="Ex: Aquecedor, Serviço, Kit" list="categorias-tabela" />
            <datalist id="categorias-tabela">{tabPorCategoria.map(g => <option key={g.nome} value={g.nome} />)}</datalist>
          </Field>
          <Field label="Preço (R$)" span={6}><input type="number" step="0.01" className="campo num" value={tabForm.preco} onChange={e => setTabForm({ ...tabForm, preco: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Descrição" span={12}><textarea className="campo" rows="2" value={tabForm.descricao || ''} onChange={e => setTabForm({ ...tabForm, descricao: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
};

export default Orcamentos;
