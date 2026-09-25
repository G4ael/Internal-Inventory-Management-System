// ============================================================================
// CONFIGURAÇÕES — integrações, backup e relatórios
// ============================================================================
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MessageCircle, Receipt, Download, Upload, FileDown, Package, Wrench, ArrowDownUp, Users, ShieldCheck, Info } from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast } from '../contexto';
import { downloadBlob, hojeISO } from '../lib/format';
import { STATUS_LABEL, STATUS_ORC, statusOrc } from '../lib/dominio';
import { enviarWhatsAppGrupo, IS_PROTOTIPO } from '../lib/integracoes';
import { PageHeader, Field } from '../components/ui';

const Configuracoes = () => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const importRef = useRef(null);
  const [cfg, setCfg] = useState(data.config);
  const [base, setBase] = useState(data.config);
  const [testando, setTestando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Quando os dados do banco mudam, o formulário acompanha
  if (base !== data.config) { setBase(data.config); setCfg(data.config); }

  const salvarConfig = async () => {
    const { error } = await db.salvarConfig(cfg);
    if (error) { toast('Não foi possível salvar: ' + error.message, 'error'); return; }
    await recarregar();
    toast('Configurações salvas', 'success');
  };

  const testarZapi = async () => {
    setTestando(true);
    const res = await enviarWhatsAppGrupo(cfg, '🧪 Teste de integração — sistema Servigás');
    setTestando(false);
    toast(res.ok ? (res.data?.simulado ? 'Simulado: mensagem montada com sucesso' : 'Mensagem enviada') : res.error, res.ok ? 'success' : 'error');
  };

  /* ------- Backup completo (inclui o catálogo da loja) ------- */
  const exportarBackup = async () => {
    setExportando(true);
    const { data: loja } = await db.listarLojaProdutos();
    const payload = { versao: 3, exportadoEm: new Date().toISOString(), dados: { ...data, lojaProdutos: loja } };
    downloadBlob(JSON.stringify(payload, null, 2), `backup-servigas-${hojeISO()}.json`);
    setExportando(false);
  };
  const importarBackup = (e) => {
    if (!e.target.files[0]) return;
    toast('A restauração de backup é feita pelo painel do Supabase (Database → Backups)', 'info');
    e.target.value = '';
  };

  /* ------- Relatórios (xlsx) ------- */
  const exportarExcel = (tipo) => {
    const wb = XLSX.utils.book_new();
    if (tipo === 'estoque') {
      const ws = XLSX.utils.json_to_sheet(data.produtos.map(p => ({ Nome: p.nome, SKU: p.sku, Quantidade: p.qtd, Mínimo: p.minimo, Preço: p.preco, 'Valor total': p.qtd * p.preco })));
      XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    }
    if (tipo === 'servicos') {
      const ws = XLSX.utils.json_to_sheet(data.servicos.map(s => ({
        Data: s.data, Hora: s.hora, Tipo: s.tipo, Status: STATUS_LABEL[s.status],
        Técnico: s.tecnico || '—',
        Cliente: s.cliente, Telefone: s.telefone, Endereço: s.endereco,
        Itens: (s.itens || []).map(i => `${i.qtd}x ${i.nome}`).join('; '), Observações: s.obs
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Serviços');
    }
    if (tipo === 'mov') {
      const ws = XLSX.utils.json_to_sheet(data.movimentacoes.map(m => {
        const p = data.produtos.find(x => x.id === m.produtoId);
        return { Data: new Date(m.data).toLocaleString('pt-BR'), Produto: p?.nome || '—', Tipo: m.tipo, Quantidade: m.qtd, Motivo: m.motivo };
      }));
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
    }
    if (tipo === 'clientes') {
      const ws = XLSX.utils.json_to_sheet(data.clientes.map(c => ({ Nome: c.nome, Telefone: c.telefone, 'CPF/CNPJ': c.documento, Endereço: c.endereco, Observações: c.obs })));
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    }
    if (tipo === 'orcamentos') {
      const hoje = hojeISO();
      const ws = XLSX.utils.json_to_sheet(data.orcamentos.map(o => ({ Data: o.data, Cliente: o.cliente, 'CPF/CNPJ': o.clienteDocumento, Local: o.local, Situação: STATUS_ORC[statusOrc(o, hoje)]?.label, Validade: o.validade, Total: o.total, NF: o.nfNumero || '', Descrição: o.itens })));
      XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos');
    }
    if (tipo === 'completo') {
      ['produtos', 'clientes', 'vendas', 'servicos', 'orcamentos', 'notas', 'movimentacoes'].forEach(t => {
        const ws = XLSX.utils.json_to_sheet(data[t] || []);
        XLSX.utils.book_append_sheet(wb, ws, t);
      });
    }
    XLSX.writeFile(wb, `relatorio-${tipo}-${hojeISO()}.xlsx`);
  };

  const relatorios = [
    { id: 'clientes', label: 'Clientes', icone: Users },
    { id: 'orcamentos', label: 'Orçamentos', icone: Receipt },
    { id: 'servicos', label: 'Serviços', icone: Wrench },
    { id: 'estoque', label: 'Estoque', icone: Package },
    { id: 'mov', label: 'Movimentações', icone: ArrowDownUp },
    { id: 'completo', label: 'Tudo', icone: FileDown }
  ];

  return (
    <>
      <PageHeader titulo="Configurações" sub="Integrações, cópias de segurança e relatórios" />

      <div className="grade-painel" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', marginTop: 0 }}>
        {/* === INTEGRAÇÃO: WhatsApp via Z-API === */}
        <section className="cartao">
          <div className="cartao-cab" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="titulo-cartao">WhatsApp (Z-API)</h2><p>Envio automático das OS para o grupo dos técnicos.</p></div>
            <span className="kpi-ic" style={{ background: 'var(--ok-fundo)', color: 'var(--verde-whats)' }}><MessageCircle /></span>
          </div>
          <p className="t2" style={{ fontSize: 13, margin: '0 0 16px' }}>
            Crie uma instância em z-api.io, conecte pelo QR code e copie a URL e o token abaixo.
            O ID do grupo é obtido lendo as mensagens do grupo pela API (endpoint <span className="mono">/chats</span>).
          </p>
          <div className="grade-form">
            <Field label="URL da instância Z-API" span={12}>
              <input className="campo mono" placeholder="https://api.z-api.io/instances/XXXX/token/YYYY" value={cfg.zapi_url} onChange={e => setCfg({ ...cfg, zapi_url: e.target.value })} />
            </Field>
            <Field label="Client-Token" span={6}>
              <input className="campo mono" type="password" value={cfg.zapi_token} onChange={e => setCfg({ ...cfg, zapi_token: e.target.value })} />
            </Field>
            <Field label="ID do grupo dos técnicos" span={6}>
              <input className="campo mono" placeholder="120363xxxxxxxxxxx@g.us" value={cfg.whatsapp_grupo_id} onChange={e => setCfg({ ...cfg, whatsapp_grupo_id: e.target.value })} />
            </Field>
            <Field span={12}>
              <label className="marcar"><input type="checkbox" checked={!!cfg.auto_enviar_whatsapp} onChange={e => setCfg({ ...cfg, auto_enviar_whatsapp: e.target.checked })} /> Enviar a OS para o grupo automaticamente ao criar</label>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-preto" onClick={salvarConfig}>Salvar</button>
            <button className="btn btn-contorno" onClick={testarZapi} disabled={testando}>{testando ? 'Testando…' : 'Testar conexão'}</button>
          </div>
        </section>

        {/* === INTEGRAÇÃO: NFe via Plugnotas === */}
        <section className="cartao">
          <div className="cartao-cab" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="titulo-cartao">Nota fiscal (Plugnotas)</h2><p>Emissão de NFS-e e NFC-e a partir de orçamentos e vendas.</p></div>
            <span className="kpi-ic"><Receipt /></span>
          </div>
          <p className="t2" style={{ fontSize: 13, margin: '0 0 16px' }}>
            Você precisa de: (1) certificado digital A1 cadastrado na Plugnotas, (2) inscrição municipal ativa do emitente e (3) chave de API gerada no painel da Plugnotas.
          </p>
          <div className="grade-form">
            <Field label="API Token Plugnotas" span={12}>
              <input className="campo mono" type="password" value={cfg.plugnotas_token} onChange={e => setCfg({ ...cfg, plugnotas_token: e.target.value })} />
            </Field>
            <Field label="Razão social" span={12}>
              <input className="campo" value={cfg.emitente_razao} onChange={e => setCfg({ ...cfg, emitente_razao: e.target.value })} />
            </Field>
            <Field label="CNPJ do emitente" span={6}>
              <input className="campo mono" value={cfg.emitente_cnpj} onChange={e => setCfg({ ...cfg, emitente_cnpj: e.target.value })} />
            </Field>
            <Field label="Inscrição municipal" span={6}>
              <input className="campo mono" value={cfg.emitente_inscricao} onChange={e => setCfg({ ...cfg, emitente_inscricao: e.target.value })} />
            </Field>
            <Field span={12}>
              <label className="marcar"><input type="checkbox" checked={!!cfg.auto_gerar_nf} onChange={e => setCfg({ ...cfg, auto_gerar_nf: e.target.checked })} /> Gerar NF automaticamente ao aprovar orçamento</label>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-preto" onClick={salvarConfig}>Salvar</button>
          </div>
        </section>

        {/* === BACKUP === */}
        <section className="cartao">
          <div className="cartao-cab" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="titulo-cartao">Cópia de segurança</h2><p>Um arquivo com clientes, orçamentos, serviços, vendas, estoque e o catálogo da loja.</p></div>
            <span className="kpi-ic"><ShieldCheck /></span>
          </div>
          <p className="t2" style={{ fontSize: 13, margin: '0 0 16px' }}>Recomendado baixar uma vez por semana e guardar fora do computador (pen drive, Google Drive).</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-preto" onClick={exportarBackup} disabled={exportando}><Download /> {exportando ? 'Preparando…' : 'Baixar cópia de segurança'}</button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={importarBackup} />
            <button className="btn btn-contorno" onClick={() => importRef.current?.click()}><Upload /> Importar</button>
          </div>
        </section>

        {/* === RELATÓRIOS === */}
        <section className="cartao">
          <div className="cartao-cab" style={{ alignItems: 'flex-start' }}>
            <div><h2 className="titulo-cartao">Relatórios em Excel</h2><p>Planilhas .xlsx com os dados de agora.</p></div>
            <span className="kpi-ic"><FileDown /></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {relatorios.map(r => { const I = r.icone; return <button key={r.id} className="btn btn-suave" style={{ justifyContent: 'flex-start' }} onClick={() => exportarExcel(r.id)}><I /> {r.label}</button>; })}
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-cab" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
            <div><h2 className="titulo-cartao">Sobre</h2></div>
            <span className="kpi-ic"><Info /></span>
          </div>
          <p className="t2" style={{ fontSize: 13.5, margin: 0 }}>
            Servigás Gestão v0.4<br />
            Modo: {IS_PROTOTIPO ? 'protótipo (WhatsApp e nota fiscal simulados)' : 'produção'}
          </p>
        </section>
      </div>
    </>
  );
};

export default Configuracoes;
