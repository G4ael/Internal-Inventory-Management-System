// ============================================================================
// PAINEL — visão geral do negócio no período escolhido
// ============================================================================
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ShoppingCart, Receipt, Wrench, Users, CalendarDays, Plus, Download, Package,
  CheckCircle2, ChevronRight, HardHat, CalendarClock
} from 'lucide-react';
import { useData, useNav } from '../contexto';
import {
  fmtBRL, fmtBRLCurto, fmtNum, hojeISO, somarDias, paraData, isoLocal, diaDe,
  fmtDiaCurto, fmtDiaLongo, fmtDate, diasEntre, pref
} from '../lib/format';
import { STATUS_OS, STATUS_ORC, STATUS_LABEL, statusOrc } from '../lib/dominio';
import { PageHeader, Segmentado, Delta, Selo, Vazio, Esqueleto } from '../components/ui';
import { GraficoArea, BarrasSemana, Medidor } from '../components/graficos';

const PERIODOS = [
  { id: 7, label: '7 dias' },
  { id: 30, label: '30 dias' },
  { id: 90, label: '90 dias' },
  { id: 365, label: '12 meses' }
];
const DIAS = [['Dom', 'Domingo'], ['Seg', 'Segunda-feira'], ['Ter', 'Terça-feira'], ['Qua', 'Quarta-feira'], ['Qui', 'Quinta-feira'], ['Sex', 'Sexta-feira'], ['Sáb', 'Sábado']];

// Divide o período em "baldes" (dias, semanas ou meses) e acha o período anterior equivalente
const montarJanelas = (periodo, hoje) => {
  if (periodo === 365) {
    const d = paraData(hoje);
    const baldes = [];
    for (let k = 11; k >= 0; k--) {
      const ini = new Date(d.getFullYear(), d.getMonth() - k, 1);
      const fim = new Date(d.getFullYear(), d.getMonth() - k + 1, 0);
      baldes.push({
        ini: isoLocal(ini), fim: isoLocal(fim) > hoje ? hoje : isoLocal(fim),
        iniA: isoLocal(new Date(ini.getFullYear() - 1, ini.getMonth(), 1)),
        fimA: isoLocal(new Date(ini.getFullYear() - 1, ini.getMonth() + 1, 0)),
        rotulo: ini.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        rotuloLongo: ini.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      });
    }
    return { ini: baldes[0].ini, fim: hoje, iniA: baldes[0].iniA, fimA: somarDias(baldes[0].ini, -1), baldes, nomeAnterior: '12 meses anteriores' };
  }
  const ini = somarDias(hoje, -(periodo - 1));
  const tam = periodo <= 31 ? 1 : 7;
  const baldes = [];
  for (let fim = hoje; fim >= ini; fim = somarDias(fim, -tam)) {
    const bIni = somarDias(fim, -(tam - 1)) < ini ? ini : somarDias(fim, -(tam - 1));
    baldes.unshift({
      ini: bIni, fim, iniA: somarDias(bIni, -periodo), fimA: somarDias(fim, -periodo),
      rotulo: fmtDiaCurto(tam === 1 ? fim : bIni),
      rotuloLongo: tam === 1 ? fmtDiaLongo(fim) : `${fmtDiaCurto(bIni)} a ${fmtDiaCurto(fim)}`
    });
  }
  return { ini, fim: hoje, iniA: somarDias(ini, -periodo), fimA: somarDias(ini, -1), baldes, nomeAnterior: `${periodo} dias anteriores` };
};

const noIntervalo = (d, ini, fim) => d && d >= ini && d <= fim;
const somar = (lista, dia, valor, ini, fim) => lista.reduce((s, r) => (noIntervalo(dia(r), ini, fim) ? s + valor(r) : s), 0);

const Kpi = ({ icone: I, rotulo, valor, atual, anterior, anteriorFmt, onClick }) => (
  <button className="cartao clicavel" onClick={onClick}>
    <div className="kpi-cab"><span>{rotulo}</span><span className="kpi-ic"><I /></span></div>
    <div className="kpi-valor" title={valor}>{valor}</div>
    <div className="kpi-rodape"><Delta atual={atual} anterior={anterior} /><span>vs. {anteriorFmt} no período anterior</span></div>
  </button>
);

const Carregando = () => (
  <>
    <div className="grade-kpi">{[0, 1, 2, 3].map(i => <div key={i} className="cartao"><Esqueleto h={14} w="50%" /><Esqueleto h={30} w="70%" style={{ margin: '16px 0 10px' }} /><Esqueleto h={12} w="80%" /></div>)}</div>
    <div className="grade-painel">
      <div className="cartao"><Esqueleto h={18} w="30%" /><Esqueleto h={240} style={{ marginTop: 20 }} /></div>
      <div className="cartao"><Esqueleto h={18} w="60%" /><Esqueleto h={200} style={{ marginTop: 20 }} /></div>
    </div>
  </>
);

const Painel = () => {
  const { data, loaded } = useData();
  const { ir } = useNav();
  const [periodo, setPeriodoEstado] = useState(() => pref.ler('servigas-periodo', 90));
  const [metrica, setMetrica] = useState('orcamentos');
  const [agenda, setAgenda] = useState(null); // 'proximos' | 'recentes' (null = automático)
  const setPeriodo = (p) => { setPeriodoEstado(p); pref.gravar('servigas-periodo', p); };
  const hoje = hojeISO();

  const J = useMemo(() => montarJanelas(periodo, hoje), [periodo, hoje]);

  const r = useMemo(() => {
    const vendasOk = data.vendas.filter(v => v.status !== 'cancelada');
    const osOk = data.servicos.filter(s => s.status !== 'cancelado');
    const dVenda = v => diaDe(v.data);
    const orc = { lista: data.orcamentos, dia: o => o.data, valor: o => o.total };
    const ven = { lista: vendasOk, dia: dVenda, valor: v => v.total };
    const serie = (m) => J.baldes.map(b => ({
      rotulo: b.rotulo, rotuloLongo: b.rotuloLongo,
      valor: somar(m.lista, m.dia, m.valor, b.ini, b.fim),
      anterior: somar(m.lista, m.dia, m.valor, b.iniA, b.fimA)
    }));
    const orcPeriodo = data.orcamentos.filter(o => noIntervalo(o.data, J.ini, J.fim));
    const porStatus = Object.keys(STATUS_ORC).map(k => {
      const l = orcPeriodo.filter(o => statusOrc(o, hoje) === k);
      return { id: k, qtd: l.length, valor: l.reduce((s, o) => s + o.total, 0) };
    });
    const vendasPeriodo = vendasOk.filter(v => noIntervalo(dVenda(v), J.ini, J.fim));
    const osPeriodo = osOk.filter(s => noIntervalo(s.data, J.ini, J.fim));
    const semana = DIAS.map(([rotulo, longo], i) => ({ rotulo, longo, valor: osPeriodo.filter(s => paraData(s.data).getDay() === i).length }));
    return {
      kpi: {
        vendas: [somar(vendasOk, dVenda, v => v.total, J.ini, J.fim), somar(vendasOk, dVenda, v => v.total, J.iniA, J.fimA)],
        orc: [somar(data.orcamentos, o => o.data, o => o.total, J.ini, J.fim), somar(data.orcamentos, o => o.data, o => o.total, J.iniA, J.fimA)],
        os: [osPeriodo.length, osOk.filter(s => noIntervalo(s.data, J.iniA, J.fimA)).length],
        cli: [data.clientes.filter(c => noIntervalo(diaDe(c.criadoEm), J.ini, J.fim)).length, data.clientes.filter(c => noIntervalo(diaDe(c.criadoEm), J.iniA, J.fimA)).length]
      },
      series: { orcamentos: serie(orc), vendas: serie(ven) },
      orcPeriodo, porStatus, vendasPeriodo, semana,
      vendasCanceladas: data.vendas.filter(v => v.status === 'cancelada' && noIntervalo(dVenda(v), J.ini, J.fim)).length
    };
  }, [data, J, hoje]);

  // Listas que não dependem do período
  const proximos = data.servicos
    .filter(s => s.data >= hoje && (s.status === 'pendente' || s.status === 'em_andamento'))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).slice(0, 6);
  const recentes = data.servicos
    .filter(s => s.data <= hoje && s.status !== 'cancelado')
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora)).slice(0, 6);
  const abaAgenda = agenda || (proximos.length ? 'proximos' : 'recentes');
  const listaAgenda = abaAgenda === 'proximos' ? proximos : recentes;
  const emAberto = data.orcamentos
    .map(o => ({ ...o, st: statusOrc(o, hoje) }))
    .filter(o => o.st === 'aberto' || o.st === 'vencido')
    .sort((a, b) => (a.st === b.st ? (a.validade || '9').localeCompare(b.validade || '9') : a.st === 'vencido' ? -1 : 1));
  const alertaEstoque = data.produtos.filter(p => p.qtd <= p.minimo);
  const aprovados = r.porStatus.find(s => s.id === 'aprovado').qtd;
  const taxa = r.orcPeriodo.length ? aprovados / r.orcPeriodo.length : 0;
  const diaTop = r.semana.reduce((a, d) => (d.valor > a.valor ? d : a), r.semana[0]);

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    const orcs = r.orcPeriodo.map(o => ({ Data: o.data, Cliente: o.cliente, Local: o.local, Situação: STATUS_ORC[statusOrc(o, hoje)].label, Validade: o.validade, Total: o.total, Descrição: o.itens }));
    const os = data.servicos.filter(s => noIntervalo(s.data, J.ini, J.fim)).map(s => ({ Data: s.data, Hora: s.hora, Tipo: s.tipo, Status: STATUS_LABEL[s.status], Técnico: s.tecnico || '—', Cliente: s.cliente, Endereço: s.endereco }));
    const vendas = r.vendasPeriodo.map(v => ({ Número: v.numero, Data: diaDe(v.data), Cliente: v.cliente, Pagamento: v.forma_pagamento, NF: v.nfNumero || '', Total: v.total }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orcs.length ? orcs : [{ Aviso: 'Nenhum orçamento no período' }]), 'Orçamentos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(os.length ? os : [{ Aviso: 'Nenhum serviço no período' }]), 'Serviços');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendas.length ? vendas : [{ Aviso: 'Nenhuma venda no período' }]), 'Vendas');
    XLSX.writeFile(wb, `painel-${J.ini}-a-${J.fim}.xlsx`);
  };

  const cabecalho = (
    <PageHeader titulo="Painel" sub={fmtDiaLongo(hoje).replace(/^./, c => c.toUpperCase())}>
      <span className="selo selo-contorno so-desktop" style={{ height: 42, padding: '0 16px', fontWeight: 500, fontSize: 13.5 }}>
        <CalendarDays />{fmtDiaCurto(J.ini)} {paraData(J.ini).getFullYear() !== paraData(J.fim).getFullYear() ? paraData(J.ini).getFullYear() : ''} – {fmtDiaCurto(J.fim)} {paraData(J.fim).getFullYear()}
      </span>
      <Segmentado rotulo="Período" opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} />
      <button className="btn btn-contorno" onClick={exportar} disabled={!loaded}><Download /> Exportar</button>
      <button className="btn btn-preto" onClick={() => ir('servicos', { acao: 'nova' })}><Plus /> Nova OS</button>
    </PageHeader>
  );

  if (!loaded) return <>{cabecalho}<Carregando /></>;

  const m = metrica === 'orcamentos'
    ? { total: r.kpi.orc[0], anterior: r.kpi.orc[1], contagem: `${r.orcPeriodo.length} ${r.orcPeriodo.length === 1 ? 'orçamento' : 'orçamentos'}`, nome: 'Orçamentos' }
    : { total: r.kpi.vendas[0], anterior: r.kpi.vendas[1], contagem: `${r.vendasPeriodo.length} ${r.vendasPeriodo.length === 1 ? 'venda' : 'vendas'}`, nome: 'Vendas' };
  const nomeAtual = periodo === 365 ? 'Últimos 12 meses' : `Últimos ${periodo} dias`;
  const semMovimento = r.series[metrica].every(p => !p.valor && !p.anterior);

  return (
    <>
      {cabecalho}

      <div className="grade-kpi">
        <Kpi icone={ShoppingCart} rotulo="Faturamento" valor={fmtBRLCurto(r.kpi.vendas[0])} atual={r.kpi.vendas[0]} anterior={r.kpi.vendas[1]} anteriorFmt={fmtBRLCurto(r.kpi.vendas[1])} onClick={() => ir('vendas')} />
        <Kpi icone={Receipt} rotulo="Orçamentos" valor={fmtBRLCurto(r.kpi.orc[0])} atual={r.kpi.orc[0]} anterior={r.kpi.orc[1]} anteriorFmt={fmtBRLCurto(r.kpi.orc[1])} onClick={() => ir('orcamentos')} />
        <Kpi icone={Wrench} rotulo="Serviços" valor={fmtNum(r.kpi.os[0])} atual={r.kpi.os[0]} anterior={r.kpi.os[1]} anteriorFmt={fmtNum(r.kpi.os[1])} onClick={() => ir('servicos')} />
        <Kpi icone={Users} rotulo="Clientes novos" valor={fmtNum(r.kpi.cli[0])} atual={r.kpi.cli[0]} anterior={r.kpi.cli[1]} anteriorFmt={fmtNum(r.kpi.cli[1])} onClick={() => ir('clientes')} />
      </div>

      <div className="grade-painel">
        <div className="coluna">
          {/* Movimento: valor no período, com o período anterior tracejado */}
          <section className="cartao">
            <div className="cartao-cab">
              <h2 className="titulo-cartao">Movimento</h2>
              <Segmentado rotulo="O que mostrar" valor={metrica} onChange={setMetrica}
                opcoes={[{ id: 'orcamentos', label: 'Orçamentos' }, { id: 'vendas', label: 'Vendas' }]} />
            </div>
            <div className="movimento">
              <div>
                <div className="heroi-num" title={fmtBRL(m.total)}>{fmtBRLCurto(m.total)}</div>
                <div className="kpi-rodape">{m.anterior ? <><Delta atual={m.total} anterior={m.anterior} /><span>vs. período anterior</span></> : <span>Nada no período anterior para comparar</span>}</div>
                <p className="t2" style={{ fontSize: 13.5, margin: '14px 0 0' }}>{m.contagem} · {nomeAtual.toLowerCase()}</p>
              </div>
              {semMovimento
                ? <Vazio icone={metrica === 'orcamentos' ? Receipt : ShoppingCart} titulo={`Nenhum registro de ${m.nome.toLowerCase()} neste período`} texto="Escolha um período maior no topo da página para ver o histórico." />
                : <GraficoArea pontos={r.series[metrica]} nomeAtual={nomeAtual} nomeAnterior={J.nomeAnterior} formatarEixo={v => fmtBRLCurto(v).replace(',00', '')} formatarValor={fmtBRL} />}
            </div>
            {metrica === 'orcamentos' ? (
              <div className="divisao" aria-label="Orçamentos do período por situação">
                {r.porStatus.map(s => (
                  <button key={s.id} className="divisao-item" style={{ '--cor': STATUS_ORC[s.id].cor }} onClick={() => ir('orcamentos', { filtro: s.id })}>
                    <span>{STATUS_ORC[s.id].label}s</span>
                    <b>{fmtNum(s.qtd)}</b>
                    <small>{fmtBRL(s.valor)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="divisao" aria-label="Resumo das vendas do período">
                <div className="divisao-item" style={{ '--cor': 'var(--acento)' }}><span>Vendas</span><b>{fmtNum(r.vendasPeriodo.length)}</b><small>{fmtBRL(r.kpi.vendas[0])}</small></div>
                <div className="divisao-item" style={{ '--cor': 'var(--acento)' }}><span>Ticket médio</span><b>{fmtBRLCurto(r.vendasPeriodo.length ? r.kpi.vendas[0] / r.vendasPeriodo.length : 0)}</b><small>por venda</small></div>
                <div className="divisao-item" style={{ '--cor': 'var(--ok)' }}><span>Com nota fiscal</span><b>{fmtNum(r.vendasPeriodo.filter(v => v.nfNumero).length)}</b><small>emitidas</small></div>
                <div className="divisao-item" style={{ '--cor': 'var(--linha-forte)' }}><span>Canceladas</span><b>{fmtNum(r.vendasCanceladas)}</b><small>no período</small></div>
              </div>
            )}
          </section>

          {/* Agenda */}
          <section className="cartao">
            <div className="cartao-cab">
              <div><h2 className="titulo-cartao">Agenda de serviços</h2><p>{abaAgenda === 'proximos' ? 'Pendentes e em andamento, a partir de hoje' : 'Os últimos atendimentos'}</p></div>
              <Segmentado rotulo="Agenda" valor={abaAgenda} onChange={setAgenda} opcoes={[{ id: 'proximos', label: `Próximos${proximos.length ? ` (${proximos.length})` : ''}` }, { id: 'recentes', label: 'Recentes' }]} />
            </div>
            {listaAgenda.length === 0 ? (
              <Vazio icone={CalendarClock} titulo={abaAgenda === 'proximos' ? 'Nenhum serviço agendado' : 'Nenhum serviço ainda'} texto="Crie uma OS e ela aparece aqui com data, técnico e situação.">
                <button className="btn btn-preto btn-sm" onClick={() => ir('servicos', { acao: 'nova' })}><Plus /> Nova OS</button>
              </Vazio>
            ) : (
              <div className="lista-mini">
                {listaAgenda.map(s => {
                  const d = paraData(s.data);
                  return (
                    <button key={s.id} className="item-mini" onClick={() => ir('servicos', { acao: 'abrir', id: s.id })}>
                      <span className={`data-bloco ${s.data === hoje ? 'hoje' : ''}`}><b>{d.getDate()}</b><small>{s.data === hoje ? 'hoje' : d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="item-mini-titulo" style={{ display: 'block' }}>{s.cliente}</span>
                        <span className="item-mini-sub" style={{ display: 'block' }}>{s.tipo} · {s.hora}{s.tecnico && <span className="so-mobile"> · {s.tecnico}</span>}{s.endereco ? ` · ${s.endereco}` : ''}</span>
                      </span>
                      <span className="so-desktop t2" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>{s.tecnico && <><HardHat size={15} />{s.tecnico.split(' ')[0]}</>}</span>
                      <Selo tom={STATUS_OS[s.status]?.tom}>{STATUS_OS[s.status]?.label}</Selo>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Orçamentos esperando resposta */}
          <section className="cartao">
            <div className="cartao-cab">
              <div><h2 className="titulo-cartao">Orçamentos esperando resposta</h2><p>{emAberto.length ? `${emAberto.filter(o => o.st === 'vencido').length} vencidos · ${emAberto.filter(o => o.st === 'aberto').length} dentro da validade` : 'Todos respondidos'}</p></div>
              <button className="btn-texto" onClick={() => ir('orcamentos', { filtro: 'pendentes' })}>Ver todos <ChevronRight size={15} /></button>
            </div>
            {emAberto.length === 0 ? (
              <Vazio icone={CheckCircle2} titulo="Nenhum orçamento pendente" texto="Quando um orçamento ficar aberto ou vencer, ele aparece aqui para você cobrar o cliente." />
            ) : (
              <div className="lista-mini">
                {emAberto.slice(0, 5).map(o => (
                  <button key={o.id} className="item-mini" onClick={() => ir('orcamentos', { acao: 'abrir', id: o.id })}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="item-mini-titulo" style={{ display: 'block' }}>{o.cliente}</span>
                      <span className="item-mini-sub" style={{ display: 'block' }}>
                        {fmtDate(o.data)}{o.validade ? ` · ${o.st === 'vencido' ? `venceu há ${diasEntre(o.validade, hoje)} ${diasEntre(o.validade, hoje) === 1 ? 'dia' : 'dias'}` : `vale até ${fmtDate(o.validade)}`}` : ''}{o.local ? ` · ${o.local}` : ''}
                      </span>
                    </span>
                    <b className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(o.total)}</b>
                    <Selo tom={STATUS_ORC[o.st].tom}>{STATUS_ORC[o.st].label}</Selo>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="coluna">
          <section className="cartao">
            <div className="cartao-cab"><div><h2 className="titulo-cartao">Serviços por dia da semana</h2><p>{nomeAtual}</p></div></div>
            {r.semana.every(d => !d.valor)
              ? <Vazio icone={Wrench} titulo="Sem serviços no período" />
              : <>
                <BarrasSemana dados={r.semana} />
                <p className="t2" style={{ fontSize: 13, margin: '12px 0 0' }}>Dia mais movimentado: <b style={{ color: 'var(--tinta)' }}>{diaTop.longo.toLowerCase()}</b></p>
              </>}
          </section>

          <section className="cartao">
            <div className="cartao-cab"><div><h2 className="titulo-cartao">Aprovação de orçamentos</h2><p>{nomeAtual}</p></div></div>
            {r.orcPeriodo.length === 0 ? (
              <Vazio icone={Receipt} titulo="Nenhum orçamento no período" />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 260, maxWidth: '100%', margin: '0 auto' }}>
                  <Medidor pct={taxa} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 2, fontSize: 36, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1 }}>{Math.round(taxa * 100)}%</div>
                </div>
                <div className="t2" style={{ fontSize: 13, marginTop: 10 }}>{aprovados} de {r.orcPeriodo.length} {r.orcPeriodo.length === 1 ? 'orçamento aprovado' : 'orçamentos aprovados'}</div>
                <button className="btn btn-suave btn-sm" style={{ marginTop: 14 }} onClick={() => ir('orcamentos')}>Ver orçamentos</button>
              </div>
            )}
          </section>

          <section className="cartao">
            <div className="cartao-cab">
              <div><h2 className="titulo-cartao">Estoque em alerta</h2><p>{alertaEstoque.length ? 'No mínimo ou abaixo dele' : `${data.produtos.length} produtos acima do mínimo`}</p></div>
              <button className="btn-texto" onClick={() => ir('estoque')}>Estoque <ChevronRight size={15} /></button>
            </div>
            {alertaEstoque.length === 0 ? (
              <Vazio icone={Package} titulo="Tudo em ordem" texto="Nenhum produto chegou no estoque mínimo." />
            ) : (
              <div className="lista-mini">
                {alertaEstoque.slice(0, 6).map(p => (
                  <button key={p.id} className="item-mini" onClick={() => ir('estoque', { acao: 'abrir', id: p.id })}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="item-mini-titulo" style={{ display: 'block' }}>{p.nome}</span>
                      <span className="medidor baixo" style={{ display: 'block', marginTop: 8 }}><i style={{ width: `${Math.min(100, (p.qtd / Math.max(1, p.minimo)) * 100)}%` }} /></span>
                    </span>
                    <span className="num t2" style={{ fontSize: 13, whiteSpace: 'nowrap' }}><b style={{ color: 'var(--erro)' }}>{p.qtd}</b> / mín. {p.minimo}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default Painel;
