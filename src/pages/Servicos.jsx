// ============================================================================
// SERVIÇOS — ordens de serviço em lista ou calendário
// ============================================================================
import { useState, useMemo, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Send, MapPin, Phone, X, ChevronLeft, ChevronRight, List, CalendarDays,
  MessageCircle, Printer, CheckCircle2, HardHat, Image as ImageIcon, Package, Info, CalendarClock
} from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast, useNav } from '../contexto';
import { hojeISO, isoLocal, fmtDiaLongo, contem, linkMapa, linkTelefone } from '../lib/format';
import { STATUS_OS, TIPOS_OS, montarMensagemOS } from '../lib/dominio';
import { enviarWhatsAppGrupo, imprimirCartoesOS } from '../lib/integracoes';
import { PageHeader, BuscaPagina, Segmentado, Chips, Selo, Modal, Field, Vazio } from '../components/ui';

const maiuscula = (t) => t.replace(/^./, c => c.toUpperCase());

const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});

/* ─── Calendário do mês ─── */
const Calendario = ({ servicos, onDia }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const dias = useMemo(() => {
    const inicio = new Date(cursor); inicio.setDate(1 - cursor.getDay()); // domingo da semana
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
  }, [cursor]);
  const hoje = hojeISO();
  const cor = { pendente: ['var(--aviso-fundo)', 'var(--aviso)'], em_andamento: ['var(--info-fundo)', 'var(--info)'], concluido: ['var(--ok-fundo)', 'var(--ok)'] };

  return (
    <section className="cartao">
      <div className="cartao-cab">
        <h2 className="titulo-cartao">{maiuscula(cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="btn btn-suave btn-sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</button>
          <button className="btn-icone" aria-label="Mês anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft /></button>
          <button className="btn-icone" aria-label="Próximo mês" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight /></button>
        </div>
      </div>
      <div className="cal-grade" style={{ marginBottom: 6 }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="cal-dia-semana">{d}</div>)}
      </div>
      <div className="cal-grade">
        {dias.map((d) => {
          const iso = isoLocal(d);
          const doDia = servicos.filter(s => s.data === iso && s.status !== 'cancelado').sort((a, b) => a.hora.localeCompare(b.hora));
          return (
            <button key={iso} className={`cal-cel ${d.getMonth() !== cursor.getMonth() ? 'fora' : ''} ${iso === hoje ? 'hoje' : ''}`}
              onClick={() => onDia(iso)} aria-label={`${fmtDiaLongo(iso)}: ${doDia.length} serviços`}>
              <span className="n">{d.getDate()}</span>
              {doDia.slice(0, 3).map(s => (
                <span key={s.id} className="cal-ev" style={{ background: cor[s.status]?.[0], color: cor[s.status]?.[1] }} title={`${s.hora} ${s.cliente}`}>{s.hora} {s.cliente}</span>
              ))}
              {doDia.length > 3 && <span className="t3" style={{ fontSize: 11 }}>+{doDia.length - 3}</span>}
            </button>
          );
        })}
      </div>
      <div className="legenda" style={{ marginTop: 14 }}>
        {['pendente', 'em_andamento', 'concluido'].map(k => <span key={k}><Selo tom={STATUS_OS[k].tom}>{STATUS_OS[k].label}</Selo></span>)}
      </div>
    </section>
  );
};

const Servicos = ({ search, setSearch, intent }) => {
  const { data, salvarOS, removerOS, recarregar } = useData();
  const toast = useToast();
  const { abrirCliente } = useNav();
  const hoje = hojeISO();

  const novoForm = () => ({
    cliente: '', clienteId: '', telefone: '', endereco: '',
    tipo: 'Instalação', status: 'pendente', tecnico: '',
    data: hoje, hora: '09:00', itens: [], equipamentos: '', obs: ''
  });

  // Abertura vinda de outra tela (Painel, busca, ficha do cliente, orçamento)
  const [inicio] = useState(() => {
    if (intent?.acao === 'nova') return { modal: 'new', form: { ...novoForm(), ...(intent.dados || {}) } };
    if (intent?.acao === 'abrir') {
      const s = data.servicos.find(x => x.id === intent.id);
      if (s) return { modal: 'edit', form: { ...s, itens: s.itens || [] } };
    }
    return { modal: null, form: null };
  });
  const [modal, setModal] = useState(inicio.modal);
  const [form, setForm] = useState(inicio.form);
  const [origemOrc, setOrigemOrc] = useState(intent?.orcamentoId || null);
  const [filtroData, setFiltroData] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [view, setView] = useState('lista');
  const [fotos, setFotos] = useState({});
  const [enviando, setEnviando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef(null);

  const abrir = (s) => {
    setForm(s ? { ...s, itens: s.itens || [] } : novoForm());
    setModal(s ? 'edit' : 'new');
    setOrigemOrc(null);
    setFotos({}); // fotos carregadas sob demanda do Storage (simplificado)
  };
  const fechar = () => { setModal(null); setOrigemOrc(null); };

  // Envia OS para o grupo do WhatsApp via Z-API
  const enviarGrupo = async (s) => {
    setEnviando(s.id || 'nova');
    const res = await enviarWhatsAppGrupo(data.config, montarMensagemOS(s));
    setEnviando(null);
    if (res.ok) toast(res.data?.simulado ? 'Modo protótipo: mensagem simulada — em produção iria para o grupo' : 'OS enviada para o grupo', 'success');
    else toast(res.error, 'error');
  };

  // Alternativa manual: abre o WhatsApp para escolher o destino
  const enviarManual = (s) => window.open(`https://wa.me/?text=${encodeURIComponent(montarMensagemOS(s))}`, '_blank');

  const salvar = async () => {
    if (!form.cliente.trim()) { toast('Informe o nome do cliente', 'error'); return; }
    const isEdit = modal === 'edit';
    setSalvando(true);
    const { error } = await salvarOS(form, isEdit); // o banco gera o id quando é novo
    setSalvando(false);
    if (error) { toast('Não foi possível salvar a OS: ' + error.message, 'error'); return; }
    setModal(null);

    // Veio de um orçamento: marca o orçamento como aprovado
    if (!isEdit && origemOrc) {
      const o = data.orcamentos.find(x => x.id === origemOrc);
      if (o && o.status !== 'aprovado') { await db.atualizarOrcamento(o.id, { ...o, status: 'aprovado' }); await recarregar(); }
      setOrigemOrc(null);
      toast('OS criada e orçamento marcado como aprovado', 'success');
    } else if (!isEdit && !data.config.auto_enviar_whatsapp) toast('OS criada', 'success');
    else if (isEdit) toast('OS atualizada', 'success');

    // Envio automático para o grupo, se configurado
    if (!isEdit && data.config.auto_enviar_whatsapp) setTimeout(() => enviarGrupo(form), 300);
  };

  const concluir = async (s) => {
    const { error } = await db.atualizarStatusOS(s.id, 'concluido');
    if (error) { toast('Não foi possível concluir: ' + error.message, 'error'); return; }
    await recarregar();
    toast(`OS de ${s.cliente} concluída`, 'success');
  };

  const remover = (id) => { if (confirm('Remover esta OS? Os itens voltarão ao estoque.')) removerOS(id); };

  const onUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    const novas = await Promise.all(files.filter(f => f.size < 1024 * 1024).map(fileToBase64));
    if (files.some(f => f.size >= 1024 * 1024)) toast('Algumas fotos foram ignoradas por passarem de 1 MB', 'info');
    const id = form.id || 'nova';
    setFotos({ ...fotos, [id]: [...(fotos[id] || []), ...novas] });
    e.target.value = '';
  };
  const removerFoto = (idx) => {
    const id = form.id || 'nova';
    setFotos({ ...fotos, [id]: fotos[id].filter((_, i) => i !== idx) });
  };

  const addItem = (produtoId) => {
    const p = data.produtos.find(x => x.id === produtoId);
    if (!p) return;
    setForm({ ...form, itens: [...form.itens, { produtoId, nome: p.nome, qtd: 1 }] });
  };
  const updItem = (idx, qtd) => setForm({ ...form, itens: form.itens.map((it, i) => i === idx ? { ...it, qtd } : it) });
  const rmItem = (idx) => setForm({ ...form, itens: form.itens.filter((_, i) => i !== idx) });

  const porBusca = data.servicos.filter(s => contem(`${s.cliente} ${s.endereco} ${s.tecnico} ${s.telefone}`, search));
  const filtrados = porBusca.filter(s => (!filtroData || s.data === filtroData) && (!filtroStatus || s.status === filtroStatus));

  // Próximos primeiro (do mais perto para o mais longe), depois os anteriores (do mais recente para trás)
  const porDia = {};
  filtrados.forEach(s => { (porDia[s.data] = porDia[s.data] || []).push(s); });
  const dias = Object.entries(porDia).map(([d, l]) => [d, [...l].sort((a, b) => a.hora.localeCompare(b.hora))]);
  const grupos = {
    futuros: dias.filter(([d]) => d >= hoje).sort(([a], [b]) => a.localeCompare(b)),
    passados: dias.filter(([d]) => d < hoje).sort(([a], [b]) => b.localeCompare(a))
  };

  const contagem = (k) => porBusca.filter(s => s.status === k).length;
  const abertas = data.servicos.filter(s => s.status === 'pendente' || s.status === 'em_andamento').length;
  const orcOrigem = origemOrc ? data.orcamentos.find(o => o.id === origemOrc) : null;

  const cartao = (s) => (
    <article key={s.id} className="os-cartao">
      <div className="os-hora"><b>{s.hora}</b><small>{s.tipo}</small></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {s.clienteId
            ? <button className="btn-texto" style={{ color: 'var(--tinta)', fontSize: 16 }} onClick={() => abrirCliente(s.clienteId)}>{s.cliente}</button>
            : <b style={{ fontWeight: 600, fontSize: 16 }}>{s.cliente}</b>}
          <Selo tom={STATUS_OS[s.status]?.tom}>{STATUS_OS[s.status]?.label}</Selo>
        </div>
        <div className="os-info">
          <span><HardHat />{s.tecnico || 'Técnico a definir'}</span>
          {s.telefone && <span><Phone />{linkTelefone(s.telefone) ? <a href={linkTelefone(s.telefone)} style={{ color: 'inherit' }}>{s.telefone}</a> : s.telefone}</span>}
          {s.endereco && <span style={{ minWidth: 0 }}><MapPin /><a href={linkMapa(s.endereco)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }} title="Abrir no mapa">{s.endereco}</a></span>}
        </div>
        {(s.itens?.length > 0 || s.equipamentos) && (
          <div className="os-itens">
            {s.itens?.map((it, i) => <span key={i} className="selo selo-neutro"><Package />{it.qtd}× {it.nome}</span>)}
            {s.equipamentos && <span className="t2" style={{ fontSize: 13 }}>{s.equipamentos}</span>}
          </div>
        )}
      </div>
      <div className="os-acoes">
        <button className="btn btn-whats btn-sm" onClick={() => enviarGrupo(s)} disabled={enviando === s.id} title="Enviar para o grupo dos técnicos (Z-API)">
          <MessageCircle />{enviando === s.id ? 'Enviando…' : 'Grupo'}
        </button>
        <button className="btn-icone" onClick={() => enviarManual(s)} title="Escolher contato no WhatsApp" aria-label="Enviar pelo WhatsApp escolhendo o contato"><Send /></button>
        <button className="btn-icone" onClick={() => imprimirCartoesOS(s)} title="Imprimir cartões para colar nas caixas" aria-label="Imprimir cartões"><Printer /></button>
        {(s.status === 'pendente' || s.status === 'em_andamento') && (
          <button className="btn-icone" onClick={() => concluir(s)} title="Marcar como concluída" aria-label="Marcar como concluída"><CheckCircle2 /></button>
        )}
        <button className="btn-icone" onClick={() => abrir(s)} title="Editar" aria-label="Editar OS"><Edit2 /></button>
        <button className="btn-icone perigo" onClick={() => remover(s.id)} title="Remover" aria-label="Remover OS"><Trash2 /></button>
      </div>
    </article>
  );

  const grupo = (lista) => lista.map(([dia, l]) => (
    <div key={dia} className="grupo">
      <div className="grupo-dia">
        <span>{dia === hoje ? 'Hoje' : maiuscula(fmtDiaLongo(dia))}</span>
        <span className="selo selo-neutro">{l.length}</span>
        <span className="linha" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{l.map(cartao)}</div>
    </div>
  ));

  return (
    <>
      <PageHeader titulo="Serviços" sub={`${data.servicos.length} ordens de serviço · ${abertas} em aberto`}>
        <Segmentado rotulo="Visualização" valor={view} onChange={setView} opcoes={[{ id: 'lista', label: 'Lista', icone: List }, { id: 'cal', label: 'Calendário', icone: CalendarDays }]} />
        <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Nova OS</button>
      </PageHeader>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar cliente, endereço ou técnico" />
        <Chips rotulo="Filtrar por situação" valor={filtroStatus} onChange={setFiltroStatus}
          opcoes={[{ id: '', label: 'Todas', qtd: porBusca.length }, ...Object.entries(STATUS_OS).map(([k, v]) => ({ id: k, label: v.label, qtd: contagem(k) }))]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="date" className="campo campo-sobre-fundo" style={{ width: 'auto', borderRadius: 999 }} value={filtroData} onChange={e => setFiltroData(e.target.value)} aria-label="Filtrar por data" />
          {filtroData && <button className="btn-icone" onClick={() => setFiltroData('')} aria-label="Limpar data"><X /></button>}
        </div>
      </div>

      {view === 'cal' ? (
        <Calendario servicos={filtrados} onDia={(iso) => { setFiltroData(iso); setView('lista'); }} />
      ) : filtrados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={CalendarClock} titulo={data.servicos.length ? 'Nenhuma OS com esses filtros' : 'Nenhuma OS ainda'}
            texto={data.servicos.length ? 'Limpe a busca ou os filtros para ver todas.' : 'Crie a primeira ordem de serviço: ela aparece aqui, no calendário e no painel.'}>
            {data.servicos.length
              ? <button className="btn btn-contorno btn-sm" onClick={() => { setSearch(''); setFiltroData(''); setFiltroStatus(''); }}>Limpar filtros</button>
              : <button className="btn btn-preto btn-sm" onClick={() => abrir(null)}><Plus /> Nova OS</button>}
          </Vazio>
        </div>
      ) : (
        <div>
          {grupo(grupos.futuros)}
          {grupos.passados.length > 0 && grupos.futuros.length > 0 && <div className="grupo-dia t2" style={{ marginTop: 40 }}><span>Anteriores</span><span className="linha" /></div>}
          {grupo(grupos.passados)}
        </div>
      )}

      {/* JANELA DA OS */}
      <Modal open={!!modal} onClose={fechar} title={modal === 'edit' ? 'Editar OS' : 'Nova ordem de serviço'} maxWidth="760px"
        rodape={<>
          <button className="btn btn-contorno" onClick={fechar}>Cancelar</button>
          <button className="btn btn-preto" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar OS'}</button>
        </>}>
        {form && (
          <>
            {orcOrigem && (
              <div className="aviso-faixa"><Info /><span>Criando a OS a partir do orçamento de <b>{orcOrigem.cliente}</b>. Ao salvar, o orçamento fica marcado como aprovado.</span></div>
            )}
            <div className="grade-form">
              <div className="secao-form">Cliente</div>
              <Field label="Cliente cadastrado" span={12}>
                <select className="campo" value={form.clienteId || ''} onChange={(e) => {
                  const c = data.clientes.find(x => x.id === e.target.value);
                  if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, telefone: c.telefone || '', endereco: c.endereco || '' });
                  else setForm({ ...form, clienteId: '' });
                }}>
                  <option value="">— Cliente avulso (digite abaixo) —</option>
                  {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Nome do cliente" span={6}><input className="campo" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
              <Field label="Telefone" span={6}><input className="campo" value={form.telefone || ''} onChange={e => setForm({ ...form, telefone: e.target.value })} inputMode="tel" /></Field>
              <Field label="Endereço" span={12}><input className="campo" value={form.endereco || ''} onChange={e => setForm({ ...form, endereco: e.target.value })} /></Field>

              <div className="secao-form">Agendamento</div>
              <Field label="Tipo" span={4}>
                <select className="campo" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {TIPOS_OS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Status" span={4}>
                <select className="campo" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_OS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Técnico responsável" span={4}>
                <input className="campo" value={form.tecnico || ''} onChange={e => setForm({ ...form, tecnico: e.target.value })} placeholder="Nome do técnico" list="tecnicos" />
                <datalist id="tecnicos">{[...new Set(data.servicos.map(s => s.tecnico).filter(Boolean))].map(t => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Data" span={6}><input type="date" className="campo" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></Field>
              <Field label="Hora" span={6}><input type="time" className="campo" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} /></Field>

              <div className="secao-form">Itens e observações</div>
              {/* ITENS — movimentação automática de estoque */}
              <Field label="Itens do estoque (saem do estoque ao salvar)" span={12}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.itens.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 6px 6px 14px', borderRadius: 12, background: 'var(--tile)' }}>
                      <span style={{ flex: 1, fontSize: 14 }}>{it.nome}</span>
                      <input type="number" min="1" className="campo num" style={{ width: 80, background: 'var(--superficie)' }} value={it.qtd} onChange={e => updItem(idx, parseInt(e.target.value) || 1)} aria-label={`Quantidade de ${it.nome}`} />
                      <button className="btn-icone" onClick={() => rmItem(idx)} aria-label={`Tirar ${it.nome}`}><X /></button>
                    </div>
                  ))}
                  <select className="campo" value="" onChange={e => { if (e.target.value) addItem(e.target.value); }}>
                    <option value="">+ Adicionar item do estoque…</option>
                    {data.produtos.filter(p => p.qtd > 0).map(p => <option key={p.id} value={p.id}>{p.nome} (estoque: {p.qtd})</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Notas adicionais (texto livre)" span={12}><textarea className="campo" rows="2" value={form.equipamentos || ''} onChange={e => setForm({ ...form, equipamentos: e.target.value })} /></Field>
              <Field label="Observações" span={12}><textarea className="campo" rows="2" value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>

              {/* FOTOS */}
              <Field label="Fotos do serviço (máx. 1 MB cada)" span={12}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {(fotos[form.id || 'nova'] || []).map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} alt={`Foto ${i + 1}`} className="foto-mini" />
                      <button className="btn-icone" style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, background: 'var(--superficie)', boxShadow: 'var(--sombra-pop)' }} onClick={() => removerFoto(i)} aria-label="Remover foto"><X size={13} /></button>
                    </div>
                  ))}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
                  <button type="button" className="btn btn-suave btn-sm" onClick={() => fileInputRef.current?.click()}><ImageIcon /> Adicionar fotos</button>
                </div>
              </Field>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

export default Servicos;
