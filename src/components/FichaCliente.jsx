// ============================================================================
// Ficha do cliente — contato, números e todo o histórico num lugar só
// ============================================================================
import { useState } from 'react';
import { X, Phone, MapPin, FileText, MessageCircle, Navigation, Plus, Edit2, StickyNote, CalendarDays, Wrench, Receipt, ShoppingCart } from 'lucide-react';
import { useData, useNav } from '../contexto';
import { fmtBRL, fmtDate, fmtDataHora, hojeISO, linkWhats, linkTelefone, linkMapa, normalizar } from '../lib/format';
import { STATUS_OS, STATUS_ORC, statusOrc, doCliente, rotuloPagamento } from '../lib/dominio';
import { Gaveta, Avatar, Segmentado, Selo, Vazio } from './ui';

const FichaCliente = ({ clienteId, onClose }) => {
  const { data } = useData();
  const { ir } = useNav();
  const [aba, setAba] = useState('servicos');
  const c = data.clientes.find(x => x.id === clienteId);
  if (!c) return null;

  const hoje = hojeISO();
  const f = doCliente(c, normalizar);
  const servicos = data.servicos.filter(f).sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  const orcamentos = data.orcamentos.filter(f).map(o => ({ ...o, st: statusOrc(o, hoje) })).sort((a, b) => b.data.localeCompare(a.data));
  const vendas = data.vendas.filter(f).sort((a, b) => b.data.localeCompare(a.data));
  const totalAprovado = orcamentos.filter(o => o.st === 'aprovado').reduce((s, o) => s + o.total, 0);
  const totalVendas = vendas.filter(v => v.status !== 'cancelada').reduce((s, v) => s + v.total, 0);
  const wa = linkWhats(c.telefone);
  const tel = linkTelefone(c.telefone);
  const mapa = linkMapa(c.endereco);

  const novaOS = () => ir('servicos', { acao: 'nova', dados: { clienteId: c.id, cliente: c.nome, telefone: c.telefone || '', endereco: c.endereco || '' } });
  const novoOrc = () => ir('orcamentos', { acao: 'nova', dados: { clienteId: c.id, cliente: c.nome, clienteDocumento: c.documento || '', clienteEndereco: c.endereco || '', local: c.endereco || '' } });

  return (
    <Gaveta open onClose={onClose} titulo={`Ficha de ${c.nome}`}
      rodape={<>
        <button className="btn btn-preto" onClick={novaOS}><Plus /> Nova OS</button>
        <button className="btn btn-contorno" onClick={novoOrc}><Plus /> Novo orçamento</button>
        <button className="btn-icone" style={{ marginLeft: 'auto' }} onClick={() => ir('clientes', { acao: 'abrir', id: c.id })} title="Editar cadastro" aria-label="Editar cadastro"><Edit2 /></button>
      </>}>
      <div className="ficha-topo">
        <Avatar nome={c.nome} grande />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.01em' }}>{c.nome}</h2>
          <div className="t2" style={{ fontSize: 13 }}>{c.criadoEm ? `Cliente desde ${fmtDate(c.criadoEm)}` : 'Cliente'}</div>
        </div>
        <button className="btn-icone" onClick={onClose} aria-label="Fechar ficha"><X /></button>
      </div>

      <div className="gaveta-corpo">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {wa && <a className="btn btn-whats btn-sm" href={wa} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}
          {tel && <a className="btn btn-contorno btn-sm" href={tel}><Phone /> Ligar</a>}
          {mapa && <a className="btn btn-contorno btn-sm" href={mapa} target="_blank" rel="noreferrer"><Navigation /> Ver no mapa</a>}
        </div>

        <div className="ficha-contatos">
          <div><Phone /><span>{c.telefone || <span className="t3">Sem telefone</span>}</span></div>
          <div><MapPin /><span>{c.endereco || <span className="t3">Sem endereço</span>}</span></div>
          <div><FileText /><span className="mono">{c.documento || <span className="t3" style={{ fontFamily: 'var(--f-texto)' }}>Sem CPF/CNPJ</span>}</span></div>
          {c.obs && <div><StickyNote /><span style={{ whiteSpace: 'pre-line' }}>{c.obs}</span></div>}
        </div>

        <div className="ficha-numeros">
          <div><b>{servicos.length}</b><small>{servicos.length === 1 ? 'serviço' : 'serviços'}</small></div>
          <div><b title={fmtBRL(totalAprovado)}>{fmtBRL(totalAprovado)}</b><small>em orçamentos aprovados</small></div>
          <div><b title={fmtBRL(totalVendas)}>{fmtBRL(totalVendas)}</b><small>em vendas</small></div>
        </div>

        <Segmentado rotulo="Histórico" valor={aba} onChange={setAba} opcoes={[
          { id: 'servicos', label: `Serviços (${servicos.length})` },
          { id: 'orcamentos', label: `Orçamentos (${orcamentos.length})` },
          { id: 'vendas', label: `Vendas (${vendas.length})` }
        ]} />

        <div className="lista-mini" style={{ marginTop: 8 }}>
          {aba === 'servicos' && (servicos.length === 0
            ? <Vazio icone={Wrench} titulo="Nenhum serviço ainda" />
            : servicos.map(s => (
              <button key={s.id} className="item-mini" onClick={() => ir('servicos', { acao: 'abrir', id: s.id })}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="item-mini-titulo" style={{ display: 'block' }}>{s.tipo}</span>
                  <span className="item-mini-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={13} />{fmtDate(s.data)} às {s.hora}{s.tecnico ? ` · ${s.tecnico}` : ''}</span>
                </span>
                <Selo tom={STATUS_OS[s.status]?.tom}>{STATUS_OS[s.status]?.label}</Selo>
              </button>
            )))}
          {aba === 'orcamentos' && (orcamentos.length === 0
            ? <Vazio icone={Receipt} titulo="Nenhum orçamento ainda" />
            : orcamentos.map(o => (
              <button key={o.id} className="item-mini" onClick={() => ir('orcamentos', { acao: 'abrir', id: o.id })}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="item-mini-titulo num" style={{ display: 'block' }}>{fmtBRL(o.total)}</span>
                  <span className="item-mini-sub" style={{ display: 'block' }}>{fmtDate(o.data)}{o.local ? ` · ${o.local}` : ''}</span>
                </span>
                <Selo tom={STATUS_ORC[o.st].tom}>{STATUS_ORC[o.st].label}</Selo>
              </button>
            )))}
          {aba === 'vendas' && (vendas.length === 0
            ? <Vazio icone={ShoppingCart} titulo="Nenhuma venda ainda" />
            : vendas.map(v => (
              <button key={v.id} className="item-mini" onClick={() => ir('vendas', { busca: String(v.numero) })}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="item-mini-titulo num" style={{ display: 'block' }}>Venda #{v.numero} · {fmtBRL(v.total)}</span>
                  <span className="item-mini-sub" style={{ display: 'block' }}>{fmtDataHora(v.data)} · {rotuloPagamento(v.forma_pagamento)}</span>
                </span>
                {v.status === 'cancelada' ? <Selo tom="neutro">Cancelada</Selo> : v.nfNumero ? <Selo tom="ok">NF {v.nfNumero}</Selo> : null}
              </button>
            )))}
        </div>
      </div>
    </Gaveta>
  );
};

export default FichaCliente;
