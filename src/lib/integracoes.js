/* ────────────────────────────────────────────────────────────────────
   MÓDULOS DE INTEGRAÇÃO
   ─────────────────────────────────────────────────────────────────────
   Cada integração é uma função que recebe config + payload e retorna
   { ok, data, error }. Em produção essas funções fazem fetch real.
   No protótipo, simulam sucesso após um pequeno atraso.

   IMPORTANTE: para "ativar" no deploy real, basta trocar o bloco MOCK
   pelo bloco REAL (comentado) em cada função.
   ──────────────────────────────────────────────────────────────────── */
import { uid, fmtBRL, fmtDate, esc } from './format';

export const IS_PROTOTIPO = true; // troque para false no deploy real

// Envia mensagem de texto para grupo de WhatsApp via Z-API
export const enviarWhatsAppGrupo = async (config, mensagem) => {
  if (!config.zapi_url || !config.zapi_token || !config.whatsapp_grupo_id) {
    return { ok: false, error: 'Z-API não configurada (vá em Configurações → Integrações)' };
  }

  if (IS_PROTOTIPO) {
    // MOCK: simula envio bem-sucedido
    await new Promise(r => setTimeout(r, 800));
    console.log('[MOCK Z-API] Mensagem que seria enviada:', mensagem);
    return { ok: true, data: { simulado: true } };
  }

  // REAL: descomentar em produção
  /*
  try {
    const res = await fetch(`${config.zapi_url}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': config.zapi_token },
      body: JSON.stringify({ phone: config.whatsapp_grupo_id, message: mensagem })
    });
    if (!res.ok) return { ok: false, error: `Z-API retornou ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
  */
};

// Emite NF via Plugnotas — aceita tipo 'nfse' (serviço) ou 'nfce' (produto)
export const emitirNotaFiscal = async (config, dados) => {
  if (!config.plugnotas_token || !config.emitente_cnpj) {
    return { ok: false, error: 'Plugnotas não configurada (vá em Configurações → Integrações)' };
  }

  if (IS_PROTOTIPO) {
    await new Promise(r => setTimeout(r, 1200));
    const fakeNumero = String(Math.floor(Math.random() * 90000) + 10000);
    console.log(`[MOCK Plugnotas/${dados.tipo}] Dados:`, dados);
    return {
      ok: true,
      data: {
        numero: fakeNumero,
        codigo_verificacao: uid().toUpperCase().slice(0, 8),
        chave_acesso: '35' + new Date().getFullYear().toString().slice(2) + '06' + Math.random().toString().slice(2, 32),
        tipo: dados.tipo,
        simulado: true
      }
    };
  }

  // REAL: descomentar em produção
  /*
  const endpoint = dados.tipo === 'nfse' ? '/nfse' : '/nfce';
  try {
    const res = await fetch(`${config.plugnotas_url}${endpoint}`, {
      method: 'POST',
      headers: { 'x-api-key': config.plugnotas_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadPlugnotas(config, dados))
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || 'Erro na emissão' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
  */
};

/* ─────────────────────────────────────────────────────────────────
   Cartões de identificação para colar nas caixas dos aquecedores
   Layout: 4 cartões por folha A4 (grid 2x2), ~99mm x 140mm cada.
   Serve para o técnico saber de quem é cada caixa no depósito.
   ───────────────────────────────────────────────────────────────── */
export const imprimirCartoesOS = (os, quantidade = 4) => {
  const cartao = `
    <div class="cartao">
      <div class="cartao-header">
        <div class="cartao-tipo">${esc(os.tipo)}</div>
        <div class="cartao-data">${fmtDate(os.data)} · ${esc(os.hora)}</div>
      </div>
      <div class="cartao-tecnico">
        <div class="cartao-label">Técnico</div>
        <div class="cartao-tecnico-nome">${esc(os.tecnico) || '— não atribuído —'}</div>
      </div>
      <div class="cartao-bloco">
        <div class="cartao-label">Cliente</div>
        <div class="cartao-cliente">${esc(os.cliente)}</div>
      </div>
      <div class="cartao-bloco">
        <div class="cartao-label">Endereço</div>
        <div class="cartao-endereco">${esc(os.endereco) || '—'}</div>
      </div>
      ${os.telefone ? `<div class="cartao-bloco"><div class="cartao-label">Telefone</div><div class="cartao-tel">${esc(os.telefone)}</div></div>` : ''}
      ${os.itens?.length ? `<div class="cartao-itens">${os.itens.map(i => `${i.qtd}x ${esc(i.nome)}`).join(' · ')}</div>` : ''}
    </div>`;

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Cartões — OS ${esc(os.cliente)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; }
  .folha { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6mm; width: 194mm; height: 281mm; }
  .cartao { border: 2px dashed #999; border-radius: 4mm; padding: 6mm; display: flex; flex-direction: column; gap: 3mm; page-break-inside: avoid; background: #fff; }
  .cartao-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 2mm; }
  .cartao-tipo { font-size: 14pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .cartao-data { font-size: 9pt; color: #555; font-weight: 600; }
  .cartao-tecnico { background: #000; color: #fff; padding: 3mm; border-radius: 2mm; text-align: center; }
  .cartao-tecnico .cartao-label { color: #bbb; }
  .cartao-tecnico-nome { font-size: 18pt; font-weight: 800; line-height: 1.1; text-transform: uppercase; }
  .cartao-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; margin-bottom: 0.5mm; }
  .cartao-cliente { font-size: 13pt; font-weight: 700; line-height: 1.2; }
  .cartao-endereco { font-size: 10pt; line-height: 1.3; }
  .cartao-tel { font-size: 11pt; font-weight: 600; }
  .cartao-itens { margin-top: auto; font-size: 8pt; color: #555; border-top: 1px solid #ddd; padding-top: 2mm; }
  .no-print { margin-bottom: 10px; text-align: right; }
  .btn-print { background: #111; color: #fff; border: none; padding: 12px 24px; border-radius: 999px; cursor: pointer; font-size: 14px; font-weight: 600; }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">Imprimir cartões</button>
</div>
<div class="folha">
  ${cartao.repeat(quantidade)}
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
};

/* ─────────────────────────────────────────────────────────────────
   Geração de DANFE para impressão (MOCK)
   Em produção, basta pegar o PDF retornado pela Plugnotas e abrir.
   No protótipo, geramos um HTML formatado que abre numa nova janela
   pronto para impressão (Ctrl+P).
   ───────────────────────────────────────────────────────────────── */
export const imprimirDanfe = (venda, nfData, emitente) => {
  const itensHtml = venda.itens.map(it => `
    <tr>
      <td>${esc(it.nome)}</td>
      <td style="text-align:center">${it.qtd}</td>
      <td style="text-align:right">${fmtBRL(it.preco)}</td>
      <td style="text-align:right">${fmtBRL(it.qtd * it.preco)}</td>
    </tr>`).join('');

  const tipoNotaLabel = nfData.tipo === 'nfse' ? 'NOTA FISCAL DE SERVIÇO ELETRÔNICA — NFS-e' : 'NOTA FISCAL DE CONSUMIDOR ELETRÔNICA — NFC-e';

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>NF ${esc(nfData.numero)} — ${esc(venda.cliente)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; max-width: 800px; margin: 20px auto; padding: 20px; color: #000; font-size: 12px; }
  .danfe-header { border: 2px solid #000; padding: 10px; text-align: center; margin-bottom: 10px; }
  .danfe-header h1 { font-size: 14px; margin: 0; }
  .danfe-header .subtitle { font-size: 11px; margin-top: 4px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .box { border: 1px solid #000; padding: 8px; }
  .box .label { font-size: 9px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
  .box .value { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
  th { background: #eee; text-align: left; }
  .totais { text-align: right; padding: 10px; border: 1px solid #000; }
  .totais .total { font-size: 16px; font-weight: bold; }
  .footer { font-size: 10px; text-align: center; margin-top: 20px; color: #666; }
  .chave { font-family: monospace; word-break: break-all; padding: 8px; background: #f5f5f5; font-size: 10px; }
  .qrcode-placeholder { width: 100px; height: 100px; border: 2px dashed #999; display: flex; align-items: center; justify-content: center; margin: 10px auto; font-size: 9px; color: #999; }
  .simulado-marca { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 80px; color: rgba(220, 53, 69, 0.15); font-weight: bold; transform: rotate(-25deg); pointer-events: none; }
  @media print { .no-print { display: none; } }
  .btn-print { background: #111; color: white; border: none; padding: 12px 24px; border-radius: 999px; cursor: pointer; font-size: 14px; font-weight: 600; font-family: system-ui, sans-serif; }
</style></head><body>
${nfData.simulado ? '<div class="simulado-marca">SIMULADO</div>' : ''}
<div class="no-print" style="text-align:right; margin-bottom: 10px;">
  <button class="btn-print" onclick="window.print()">Imprimir</button>
</div>

<div class="danfe-header">
  <h1>${tipoNotaLabel}</h1>
  <div class="subtitle">Nº ${esc(nfData.numero)}  •  Série 1  •  Emissão ${new Date().toLocaleString('pt-BR')}</div>
</div>

<div class="grid-2">
  <div class="box">
    <div class="label">Emitente</div>
    <div class="value">${esc(emitente.razao) || '—'}</div>
    <div>CNPJ: ${esc(emitente.cnpj) || '—'}</div>
    <div>Inscrição: ${esc(emitente.inscricao) || '—'}</div>
  </div>
  <div class="box">
    <div class="label">Destinatário</div>
    <div class="value">${esc(venda.cliente)}</div>
    <div>${esc(venda.clienteDocumento) || 'CPF/CNPJ não informado'}</div>
    <div>${esc(venda.clienteEndereco) || '—'}</div>
  </div>
</div>

<table>
  <thead><tr><th>Descrição</th><th style="width: 60px">Qtd</th><th style="width: 100px">Unit.</th><th style="width: 100px">Total</th></tr></thead>
  <tbody>${itensHtml}</tbody>
</table>

<div class="grid-2">
  <div class="box">
    <div class="label">Forma de pagamento</div>
    <div class="value">${esc(venda.forma_pagamento)}</div>
    <div class="label" style="margin-top: 8px">Código de verificação</div>
    <div class="value">${esc(nfData.codigo_verificacao)}</div>
  </div>
  <div class="totais">
    <div class="label">VALOR TOTAL</div>
    <div class="total">${fmtBRL(venda.total)}</div>
  </div>
</div>

<div class="box">
  <div class="label">Chave de acesso</div>
  <div class="chave">${esc(nfData.chave_acesso)}</div>
  <div class="qrcode-placeholder">QR Code<br/>SEFAZ</div>
  <div style="font-size: 10px; text-align: center;">Consulte autenticidade em www.nfe.fazenda.gov.br</div>
</div>

<div class="footer">
  Documento gerado pelo sistema Servigás · ${new Date().toLocaleString('pt-BR')}
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};
