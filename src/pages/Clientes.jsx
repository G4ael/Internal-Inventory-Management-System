// ============================================================================
// CLIENTES — cadastro; a ficha completa abre ao clicar na linha
// ============================================================================
import { useState } from 'react';
import { Plus, Edit2, Trash2, MessageCircle, Users } from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast, useNav } from '../contexto';
import { contem, fmtDate, linkWhats, normalizar } from '../lib/format';
import { doCliente } from '../lib/dominio';
import { PageHeader, BuscaPagina, Modal, Field, Avatar, Vazio } from '../components/ui';

const FORM_VAZIO = { nome: '', telefone: '', endereco: '', documento: '', obs: '' };

const Clientes = ({ search, setSearch, intent }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const { abrirCliente } = useNav();

  const [inicio] = useState(() => {
    if (intent?.acao === 'nova') return { modal: 'new', form: FORM_VAZIO };
    if (intent?.acao === 'abrir') { const c = data.clientes.find(x => x.id === intent.id); if (c) return { modal: 'edit', form: c }; }
    return { modal: null, form: FORM_VAZIO };
  });
  const [modal, setModal] = useState(inicio.modal);
  const [form, setForm] = useState(inicio.form);

  const abrir = (c) => { setForm(c || FORM_VAZIO); setModal(c ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.nome.trim()) { toast('Informe o nome do cliente', 'error'); return; }
    const { error } = modal === 'edit' ? await db.atualizarCliente(form.id, form) : await db.inserirCliente(form);
    if (error) { toast('Não foi possível salvar: ' + error.message, 'error'); return; }
    await recarregar(); setModal(null);
    toast(modal === 'edit' ? 'Cadastro atualizado' : 'Cliente cadastrado', 'success');
  };
  const remover = async (c) => {
    if (!confirm(`Remover ${c.nome} da lista de clientes? O histórico de serviços e orçamentos continua guardado.`)) return;
    await db.removerCliente(c.id); await recarregar();
  };

  const filtrados = data.clientes.filter(c => contem(`${c.nome} ${c.telefone} ${c.documento} ${c.endereco}`, search));
  const resumo = (c) => {
    const f = doCliente(c, normalizar);
    const os = data.servicos.filter(f);
    const ultimo = os.map(s => s.data).sort().pop();
    return { os: os.length, orc: data.orcamentos.filter(f).length, ultimo };
  };

  return (
    <>
      <PageHeader titulo="Clientes" sub={`${data.clientes.length} cadastrados`}>
        <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Novo cliente</button>
      </PageHeader>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar nome, telefone, documento ou endereço" />
      </div>

      {filtrados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={Users} titulo={data.clientes.length ? 'Ninguém encontrado' : 'Nenhum cliente ainda'}
            texto={data.clientes.length ? 'Tente outro nome ou parte do telefone.' : 'Cadastre clientes para puxar os dados deles direto nas OS, orçamentos e vendas.'}>
            {!data.clientes.length && <button className="btn btn-preto btn-sm" onClick={() => abrir(null)}><Plus /> Novo cliente</button>}
          </Vazio>
        </div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead>
              <tr><th>Cliente</th><th>Telefone</th><th>Endereço</th><th className="dir">Serviços</th><th className="dir">Orçamentos</th><th>Último serviço</th><th><span className="oculto-visual">Ações</span></th></tr>
            </thead>
            <tbody>
              {filtrados.map(c => {
                const r = resumo(c);
                const wa = linkWhats(c.telefone);
                return (
                  <tr key={c.id} className="linha-clicavel" onClick={() => abrirCliente(c.id)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar nome={c.nome} neutro />
                        <div style={{ minWidth: 0 }}>
                          <button className="btn-texto" style={{ color: 'var(--tinta)', fontWeight: 600, fontSize: 14.5, textAlign: 'left' }} onClick={(e) => { e.stopPropagation(); abrirCliente(c.id); }}>{c.nome}</button>
                          {c.documento && <div className="t3 mono" style={{ fontSize: 12.5 }}>{c.documento}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{c.telefone || <span className="t3">—</span>}</td>
                    <td className="t2" style={{ maxWidth: 280 }}><span className="limite-2">{c.endereco || '—'}</span></td>
                    <td className="dir num">{r.os}</td>
                    <td className="dir num">{r.orc}</td>
                    <td className="t2 num" style={{ whiteSpace: 'nowrap' }}>{r.ultimo ? fmtDate(r.ultimo) : '—'}</td>
                    <td className="acoes-linha" onClick={e => e.stopPropagation()}>
                      {wa && <a className="btn-icone" href={wa} target="_blank" rel="noreferrer" title="Conversar no WhatsApp" aria-label={`WhatsApp de ${c.nome}`} style={{ color: 'var(--verde-whats)' }}><MessageCircle /></a>}
                      <button className="btn-icone" onClick={() => abrir(c)} title="Editar" aria-label={`Editar ${c.nome}`}><Edit2 /></button>
                      <button className="btn-icone perigo" onClick={() => remover(c)} title="Remover" aria-label={`Remover ${c.nome}`}><Trash2 /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar cliente' : 'Novo cliente'}
        rodape={<><button className="btn btn-contorno" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvar}>Salvar</button></>}>
        <div className="grade-form">
          <Field label="Nome" span={12}><input className="campo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Telefone" span={6}><input className="campo" value={form.telefone || ''} onChange={e => setForm({ ...form, telefone: e.target.value })} inputMode="tel" placeholder="47 99999-0000" /></Field>
          <Field label="CPF/CNPJ" span={6}><input className="campo mono" value={form.documento || ''} onChange={e => setForm({ ...form, documento: e.target.value })} /></Field>
          <Field label="Endereço" span={12}><input className="campo" value={form.endereco || ''} onChange={e => setForm({ ...form, endereco: e.target.value })} /></Field>
          <Field label="Observações" span={12}><textarea className="campo" rows="2" value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
};

export default Clientes;
