// ============================================================================
// LOJA VIRTUAL — catálogo do site público
// O que você salva aqui aparece na hora em servigas-loja.vercel.app.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, ExternalLink, Image as ImageIcon, X, ChevronLeft, ChevronRight, Upload, Store, AlertCircle, Camera, Tag, Droplet } from 'lucide-react';
import * as db from '../lib/db';
import { useToast } from '../contexto';
import { fmtBRL, contem } from '../lib/format';
import { CATS_LOJA, URL_LOJA } from '../lib/dominio';
import { PageHeader, BuscaPagina, Chips, Selo, Modal, Field, Vazio, Esqueleto, Segmentado } from '../components/ui';

const FORM_LOJA_VAZIO = { nome: '', marca: '', categoria: 'aquecedores', sub: '', preco: '', precoAntigo: '', destaque: false, ativo: true, descricao: '', specsTexto: '', fotos: [], naEscolha: false, promoPrincipal: false };

const Loja = ({ search, setSearch }) => {
  const toast = useToast();
  const [estado, setEstado] = useState({ lista: [], carregando: true, erro: null });
  const [categoria, setCategoria] = useState('todas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(FORM_LOJA_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [aba, setAba] = useState('produtos');
  const { lista, carregando, erro } = estado;

  const carregar = useCallback(() => db.listarLojaProdutos().then(({ data, error }) => {
    setEstado(error ? { lista: [], carregando: false, erro: error.message } : { lista: data, carregando: false, erro: null });
  }), []);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (p) => {
    setForm(p
      ? { ...p, preco: p.preco ?? '', precoAntigo: p.precoAntigo ?? '', specsTexto: (p.specs || []).join('\n') }
      : FORM_LOJA_VAZIO);
    setModal(p ? 'edit' : 'new');
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast('Dê um nome ao produto.', 'error'); return; }
    setSalvando(true);
    const temPromo = form.precoAntigo !== '' && form.precoAntigo != null;
    const payload = {
      ...form, specs: form.specsTexto.split('\n').map(s => s.trim()).filter(Boolean),
      naEscolha: form.categoria === 'aquecedores' && form.naEscolha,
      promoPrincipal: temPromo && form.promoPrincipal
    };
    if (payload.promoPrincipal) {
      const { error: e } = await db.limparPromoPrincipal();
      if (e) { setSalvando(false); toast('Erro ao salvar: ' + e.message, 'error'); return; }
    }
    const { error } = modal === 'edit'
      ? await db.atualizarLojaProduto(form.id, payload)
      : await db.inserirLojaProduto(payload);
    setSalvando(false);
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }
    toast('Produto salvo! O site já está atualizado.', 'success');
    setModal(null);
    carregar();
  };

  const alternarAtivo = async (p) => {
    const { error } = await db.atualizarLojaProduto(p.id, { ...p, ativo: !p.ativo });
    if (error) toast('Erro: ' + error.message, 'error');
    else toast(p.ativo ? 'Produto ocultado do site.' : 'Produto de volta ao site!', 'success');
    carregar();
  };

  const remover = async (p) => {
    if (!confirm(`Remover "${p.nome}" da loja? As fotos também serão apagadas.`)) return;
    const { error } = await db.removerLojaProduto(p);
    if (error) toast('Erro ao remover: ' + error.message, 'error');
    else toast('Produto removido.', 'success');
    carregar();
  };

  const anexarFotos = async (e) => {
    const escolhidas = [...e.target.files];
    e.target.value = '';
    if (!escolhidas.length) return;
    const vagas = db.MAX_FOTOS_LOJA - form.fotos.length;
    if (vagas <= 0) { toast(`Máximo de ${db.MAX_FOTOS_LOJA} fotos por produto.`, 'error'); return; }
    const files = escolhidas.slice(0, vagas);
    if (escolhidas.length > vagas) toast(`Só cabem mais ${vagas} foto(s) — o resto foi ignorado.`, 'info');
    setSubindoFoto(true);
    for (const f of files) {
      const { url, error } = await db.uploadFotoLoja(f);
      if (error) toast('Foto não subiu: ' + error.message, 'error');
      else setForm(fm => ({ ...fm, fotos: [...fm.fotos, url] }));
    }
    setSubindoFoto(false);
  };

  // Move a foto na ordem — a primeira é a que aparece no catálogo
  const moverFoto = (i, d) => setForm(fm => {
    const fotos = [...fm.fotos];
    const j = i + d;
    if (j < 0 || j >= fotos.length) return fm;
    [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
    return { ...fm, fotos };
  });

  const catAtual = CATS_LOJA.find(c => c.id === form.categoria);
  const porBusca = lista.filter(p => contem(`${p.nome} ${p.marca}`, search));
  const filtrados = porBusca.filter(p => categoria === 'todas'
    || (categoria === 'ocultos' ? !p.ativo : categoria === 'escolha' ? p.naEscolha : p.categoria === categoria));
  const temPromoForm = form.precoAntigo !== '' && form.precoAntigo != null;
  const semFoto = lista.filter(p => p.fotos.length === 0).length;

  return (
    <>
      <PageHeader titulo="Loja virtual" sub={`${lista.length} produtos · ${lista.filter(p => p.ativo).length} no ar — o que você salva aqui aparece na hora no site`}>
        <a className="btn btn-contorno" href={URL_LOJA} target="_blank" rel="noreferrer"><ExternalLink /> Ver o site</a>
        {aba === 'produtos' && <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Novo produto</button>}
      </PageHeader>

      <div className="barra">
        <Segmentado rotulo="Parte da loja" valor={aba} onChange={setAba} opcoes={[
          { id: 'produtos', label: 'Produtos', icone: Store },
          { id: 'instalacoes', label: 'Fotos de instalações', icone: Camera }
        ]} />
      </div>

      {aba === 'instalacoes' && <Instalacoes />}

      {aba === 'produtos' && erro && (
        <div className="aviso-faixa erro"><AlertCircle />
          <span><b>Não consegui acessar o catálogo.</b> ({erro})<br />Se a tabela ainda não existe, rode o script <span className="mono">supabase/loja.sql</span> no SQL Editor do painel do Supabase e recarregue esta página.</span>
        </div>
      )}

      {aba === 'produtos' && !erro && (
        <>
          <div className="barra">
            <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar produto ou marca" />
            <Chips rotulo="Categoria" valor={categoria} onChange={setCategoria} opcoes={[
              { id: 'todas', label: 'Todas', qtd: porBusca.length },
              ...CATS_LOJA.map(c => ({ id: c.id, label: c.nome, qtd: porBusca.filter(p => p.categoria === c.id).length })).filter(c => c.qtd > 0),
              ...(porBusca.some(p => p.naEscolha) ? [{ id: 'escolha', label: 'No “Qual serve”', qtd: porBusca.filter(p => p.naEscolha).length }] : []),
              ...(porBusca.some(p => !p.ativo) ? [{ id: 'ocultos', label: 'Ocultos', qtd: porBusca.filter(p => !p.ativo).length }] : [])
            ]} />
          </div>
          {semFoto > 0 && !carregando && (
            <div className="aviso-faixa"><ImageIcon /><span><b>{semFoto} {semFoto === 1 ? 'produto está' : 'produtos estão'} sem foto.</b> No site eles aparecem com um desenho no lugar da foto.</span></div>
          )}

          {carregando ? (
            <div className="tabela-caixa" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[0, 1, 2, 3].map(i => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Esqueleto h={48} w={48} r={12} /><Esqueleto h={14} w="40%" /></div>)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="cartao">
              <Vazio icone={Store} titulo={lista.length ? 'Nenhum produto com esse filtro' : 'Nenhum produto na loja ainda'} texto={lista.length ? 'Escolha outra categoria ou limpe a busca.' : 'Clique em “Novo produto” para colocar o primeiro item no site.'} />
            </div>
          ) : (
            <div className="tabela-caixa">
              <table className="tabela">
                <thead><tr><th>Produto</th><th>Categoria</th><th className="dir">Preço</th><th className="centro">No site</th><th><span className="oculto-visual">Ações</span></th></tr></thead>
                <tbody>
                  {filtrados.map(p => (
                    <tr key={p.id} className={p.ativo ? '' : 'apagada'}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="miniatura">
                            {p.fotos[0] ? <img src={p.fotos[0]} alt="" /> : <ImageIcon size={18} />}
                            {p.fotos.length > 1 && <span className="qtd-fotos">{p.fotos.length}</span>}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }} className="limite-2">{p.nome}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              <span className="t3" style={{ fontSize: 12.5 }}>{p.marca}</span>
                              {p.destaque && <Selo tom="laranja">Destaque</Selo>}
                              {p.naEscolha && <Selo tom="info" icone={Droplet} title="Aparece no “Qual serve na sua casa?”">Qual serve</Selo>}
                              {p.promoPrincipal && <Selo tom="contorno" icone={Tag} title="Produto grande do “Baixou o preço”">Principal da promoção</Selo>}
                              {p.fotos.length === 0 && <Selo tom="aviso">sem foto</Selo>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>{CATS_LOJA.find(c => c.id === p.categoria)?.nome || p.categoria}</div>
                        {p.sub && <div className="t3" style={{ fontSize: 12.5 }}>{p.sub}</div>}
                      </td>
                      <td className="dir num" style={{ whiteSpace: 'nowrap' }}>
                        {p.preco == null
                          ? <span className="t3">Sob consulta</span>
                          : <>
                            {p.precoAntigo != null && <s className="t3" style={{ fontSize: 12.5, marginRight: 6 }}>{fmtBRL(p.precoAntigo)}</s>}
                            <b style={{ fontWeight: 600 }}>{fmtBRL(p.preco)}</b>
                          </>}
                      </td>
                      <td className="centro">
                        <button className={`selo ${p.ativo ? 'selo-ok' : 'selo-neutro'}`} style={{ border: 0, cursor: 'pointer' }}
                          onClick={() => alternarAtivo(p)} title={p.ativo ? 'Clique para ocultar do site' : 'Clique para publicar no site'}>
                          {p.ativo ? <><Eye /> No ar</> : <><EyeOff /> Oculto</>}
                        </button>
                      </td>
                      <td className="acoes-linha">
                        <button className="btn-icone" onClick={() => abrir(p)} title="Editar" aria-label={`Editar ${p.nome}`}><Edit2 /></button>
                        <button className="btn-icone perigo" onClick={() => remover(p)} title="Remover" aria-label={`Remover ${p.nome}`}><Trash2 /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar produto da loja' : 'Novo produto da loja'} maxWidth="680px"
        rodape={<><button className="btn btn-contorno" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvar} disabled={salvando || subindoFoto}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
        <div className="grade-form">
          <Field label="Nome do produto" span={12}>
            <input className="campo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aquecedor a gás Rinnai 15 litros" />
          </Field>
          <Field label="Marca" span={6}>
            <input className="campo" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Rinnai, Komeco…" />
          </Field>
          <Field label="Categoria" span={6}>
            <select className="campo" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value, sub: '' })}>
              {CATS_LOJA.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          {catAtual?.sub.length > 0 && (
            <Field label="Sub-categoria (filtro lateral do site)" span={6}>
              <select className="campo" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })}>
                <option value="">— Selecione —</option>
                {catAtual.sub.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <Field label="Preço (R$)" span={catAtual?.sub.length ? 3 : 6} dica="Vazio = “Sob consulta”">
            <input type="number" className="campo num" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} placeholder="1990" />
          </Field>
          <Field label="Preço antigo" span={catAtual?.sub.length ? 3 : 6} dica="Preenchido = promoção">
            <input type="number" className="campo num" value={form.precoAntigo} onChange={e => setForm({ ...form, precoAntigo: e.target.value })} placeholder="vazio = sem" />
          </Field>
          <Field label="Descrição (aparece nos detalhes do produto)" span={12}>
            <textarea className="campo" rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          </Field>
          <Field label="Características — uma por linha" span={12}>
            <textarea className="campo" rows={4} value={form.specsTexto} onChange={e => setForm({ ...form, specsTexto: e.target.value })} placeholder={'Vazão: 15 L/min\nGás: GN ou GLP\nGarantia de 5 anos'} />
          </Field>
          <Field label={`Fotos do produto — até ${db.MAX_FOTOS_LOJA} (${form.fotos.length} enviada${form.fotos.length === 1 ? '' : 's'})`} span={12}
            dica="A primeira foto (capa) aparece na lista da loja; as outras viram o carrossel na página do produto. Use as setas para trocar a ordem.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
              {form.fotos.map((f, i) => (
                <div key={f} style={{ position: 'relative', width: 96 }}>
                  <img src={f} alt={`Foto ${i + 1}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 14, display: 'block', background: 'var(--tile)', boxShadow: i === 0 ? '0 0 0 2px var(--laranja)' : 'none' }} />
                  {i === 0 && <span className="selo selo-laranja" style={{ position: 'absolute', bottom: 6, left: 6, height: 20, fontSize: 11 }}>Capa</span>}
                  <button title="Remover esta foto" aria-label={`Remover foto ${i + 1}`} className="btn-icone"
                    style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, background: 'var(--superficie)', boxShadow: 'var(--sombra-pop)' }}
                    onClick={() => setForm(fm => ({ ...fm, fotos: fm.fotos.filter((_, j) => j !== i) }))}>
                    <X size={13} />
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                    <button className="btn-icone" style={{ width: 30, height: 30 }} disabled={i === 0} aria-label="Mover para a esquerda" onClick={() => moverFoto(i, -1)}><ChevronLeft size={15} /></button>
                    <button className="btn-icone" style={{ width: 30, height: 30 }} disabled={i === form.fotos.length - 1} aria-label="Mover para a direita" onClick={() => moverFoto(i, 1)}><ChevronRight size={15} /></button>
                  </div>
                </div>
              ))}
              {form.fotos.length < db.MAX_FOTOS_LOJA && (
                <label className="btn btn-suave" style={{ cursor: subindoFoto ? 'wait' : 'pointer', height: 96, width: 96, flexDirection: 'column', gap: 4, fontSize: 12.5, borderRadius: 14, padding: 0 }}>
                  {subindoFoto ? <Upload /> : <Plus />}
                  {subindoFoto ? 'Enviando…' : 'Adicionar'}
                  <input type="file" accept="image/*" multiple hidden onChange={anexarFotos} disabled={subindoFoto} />
                </label>
              )}
            </div>
          </Field>
          {form.categoria === 'aquecedores' && (
            <Field span={12} dica="No site, o bloco mostra até 3 aquecedores marcados por faixa de chuveiros (1, 2 ou 3+), do menor preço para o maior. Enquanto nenhum estiver marcado, o site escolhe sozinho pela vazão.">
              <label className="marcar"><input type="checkbox" checked={form.naEscolha} onChange={e => setForm({ ...form, naEscolha: e.target.checked })} /> Aparece no “Qual serve na sua casa?”</label>
            </Field>
          )}
          <Field span={12} dica={temPromoForm
            ? 'Vira o produto grande do bloco “Baixou o preço”. Só um produto pode ser o principal: marcar este desmarca o anterior.'
            : 'Preencha o “Preço antigo” para este produto entrar no “Baixou o preço”.'}>
            <label className="marcar" style={temPromoForm ? undefined : { opacity: .5, cursor: 'not-allowed' }}>
              <input type="checkbox" disabled={!temPromoForm} checked={temPromoForm && form.promoPrincipal} onChange={e => setForm({ ...form, promoPrincipal: e.target.checked })} /> Principal do “Baixou o preço”
            </label>
          </Field>
          <Field span={6}>
            <label className="marcar"><input type="checkbox" checked={form.destaque} onChange={e => setForm({ ...form, destaque: e.target.checked })} /> Selo “Destaque” (aparece primeiro no site)</label>
          </Field>
          <Field span={6}>
            <label className="marcar"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Visível no site</label>
          </Field>
        </div>
      </Modal>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Fotos de instalações: carrossel do bloco "Quem vende é quem instala" no site
// ─────────────────────────────────────────────────────────────────────────────
const Instalacoes = () => {
  const toast = useToast();
  const [estado, setEstado] = useState({ lista: [], carregando: true, erro: null });
  const [subindo, setSubindo] = useState(false);
  const [legendas, setLegendas] = useState({});
  const { lista, carregando, erro } = estado;

  const carregar = useCallback(() => db.listarInstalacoes().then(({ data, error }) => {
    setEstado(error ? { lista: [], carregando: false, erro: error.message } : { lista: data, carregando: false, erro: null });
    if (!error) setLegendas(Object.fromEntries(data.map(i => [i.id, i.legenda])));
  }), []);
  useEffect(() => { carregar(); }, [carregar]);

  const anexar = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setSubindo(true);
    let ordem = lista.reduce((m, i) => Math.max(m, i.ordem), 0);
    for (const f of files) {
      const { url, error } = await db.uploadFotoInstalacao(f);
      if (error) { toast('Foto não subiu: ' + error.message, 'error'); continue; }
      const { error: e2 } = await db.inserirInstalacao({ foto: url, ordem: ++ordem });
      if (e2) toast('Erro ao salvar a foto: ' + e2.message, 'error');
    }
    setSubindo(false);
    toast('Fotos adicionadas! Já aparecem no site.', 'success');
    carregar();
  };

  const salvarLegenda = async (i) => {
    const nova = (legendas[i.id] ?? '').trim();
    if (nova === i.legenda) return;
    const { error } = await db.atualizarInstalacao(i.id, { legenda: nova });
    if (error) toast('Erro: ' + error.message, 'error'); else { toast('Legenda salva.', 'success'); carregar(); }
  };

  // Troca a posição com a vizinha (a primeira aparece primeiro no site)
  const mover = async (idx, d) => {
    const a = lista[idx], b = lista[idx + d];
    if (!a || !b) return;
    const ordemA = a.ordem === b.ordem ? idx : a.ordem, ordemB = a.ordem === b.ordem ? idx + d : b.ordem;
    await Promise.all([db.atualizarInstalacao(a.id, { ordem: ordemB }), db.atualizarInstalacao(b.id, { ordem: ordemA })]);
    carregar();
  };

  const alternar = async (i) => {
    const { error } = await db.atualizarInstalacao(i.id, { ativo: !i.ativo });
    if (error) toast('Erro: ' + error.message, 'error');
    else toast(i.ativo ? 'Foto ocultada do site.' : 'Foto de volta ao site!', 'success');
    carregar();
  };

  const remover = async (i) => {
    if (!confirm('Remover esta foto de instalação? Ela também é apagada do armazenamento.')) return;
    const { error } = await db.removerInstalacao(i);
    if (error) toast('Erro ao remover: ' + error.message, 'error'); else toast('Foto removida.', 'success');
    carregar();
  };

  if (erro) return (
    <div className="aviso-faixa erro"><AlertCircle />
      <span><b>Não consegui acessar as fotos de instalações.</b> ({erro})<br />Rode de novo o script <span className="mono">supabase/loja.sql</span> no SQL Editor do Supabase e recarregue a página.</span>
    </div>
  );

  const botaoAdicionar = (
    <label className="btn btn-preto" style={{ cursor: subindo ? 'wait' : 'pointer' }}>
      {subindo ? <Upload /> : <Plus />}{subindo ? 'Enviando…' : 'Adicionar fotos'}
      <input type="file" accept="image/*" multiple hidden onChange={anexar} disabled={subindo} />
    </label>
  );

  return (
    <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <p className="t2" style={{ margin: 0, maxWidth: '60ch', fontSize: 14 }}>
          Fotos de aquecedores que a equipe instalou. Aparecem no site em carrossel, no bloco “Quem vende é quem instala”, na ordem abaixo. Fotos na horizontal ficam melhores.
        </p>
        {lista.length > 0 && botaoAdicionar}
      </div>
      {carregando ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {[0, 1, 2].map(i => <Esqueleto key={i} h={200} r={16} />)}
        </div>
      ) : lista.length === 0 ? (
        <Vazio icone={Camera} titulo="Nenhuma foto de instalação ainda" texto="Enquanto não houver fotos, o site mostra só o título no bloco.">{botaoAdicionar}</Vazio>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {lista.map((i, idx) => (
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: i.ativo ? 1 : .55 }}>
              <div style={{ position: 'relative' }}>
                <img src={i.foto} alt={i.legenda || `Instalação ${idx + 1}`} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 14, display: 'block', background: 'var(--tile)' }} />
                <span className="selo selo-neutro" style={{ position: 'absolute', top: 8, left: 8 }}>{idx + 1}º</span>
                {!i.ativo && <span className="selo selo-aviso" style={{ position: 'absolute', top: 8, right: 8 }}>Oculta</span>}
              </div>
              <input className="campo" value={legendas[i.id] ?? ''} placeholder="Legenda (opcional): ex. Rinnai 21 L no Glória"
                aria-label={`Legenda da foto ${idx + 1}`}
                onChange={e => setLegendas(l => ({ ...l, [i.id]: e.target.value }))}
                onBlur={() => salvarLegenda(i)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn-icone" disabled={idx === 0} aria-label="Mover para antes" title="Mover para antes" onClick={() => mover(idx, -1)}><ChevronLeft /></button>
                  <button className="btn-icone" disabled={idx === lista.length - 1} aria-label="Mover para depois" title="Mover para depois" onClick={() => mover(idx, 1)}><ChevronRight /></button>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn-icone" onClick={() => alternar(i)} title={i.ativo ? 'Ocultar do site' : 'Mostrar no site'} aria-label={i.ativo ? 'Ocultar do site' : 'Mostrar no site'}>{i.ativo ? <EyeOff /> : <Eye />}</button>
                  <button className="btn-icone perigo" onClick={() => remover(i)} title="Remover" aria-label={`Remover foto ${idx + 1}`}><Trash2 /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Loja;
