import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import {
  Flame, Package, Wrench, FileText, Receipt, Users, Search, Sun, Moon, Plus,
  Edit2, Trash2, Send, Calendar, MapPin, Phone, User, X, ChevronRight, ChevronLeft,
  LayoutDashboard, AlertCircle, Clock, CheckCircle2, DollarSign,
  MessageCircle, Lock, LogOut, Settings, Download, Upload, Image as ImageIcon,
  Paperclip, ArrowDownUp, FileDown, List, Grid3x3, Eye, ShoppingCart, Printer, Copy,
  Store, ExternalLink, EyeOff
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   ARQUITETURA DO PROTÓTIPO
   ─────────────────────────────────────────────────────────────────────────────
   - Estado global em React (sem Redux) via contexto + useReducer-ish com setData
   - Persistência client-side via window.storage (futuramente: Supabase)
   - Dados particionados em múltiplas chaves para respeitar limite de 5MB/chave:
       * caldeira-data       → dados estruturados (produtos, clientes, OS...)
       * caldeira-foto-{id}  → blobs base64 de fotos de OS
       * caldeira-pdf-{id}   → blobs base64 de PDFs de notas fiscais
       * caldeira-theme      → preferência de tema
       * caldeira-user       → sessão (mock — em prod virá do Supabase Auth)
   - Movimentação de estoque é eventual: ao salvar/deletar OS, gera registros
     na tabela `movimentacoes` e ajusta `produtos[].qtd` (transação simulada).
   ──────────────────────────────────────────────────────────────────────────── */

// ============= Estilos globais =============
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    :root { --font-display: 'Bricolage Grotesque', system-ui, sans-serif; --font-body: 'DM Sans', system-ui, sans-serif; --font-mono: 'JetBrains Mono', monospace; }
    .theme-light {
      --bg:#faf8f5; --bg-elevated:#fff; --bg-subtle:#f3efe9;
      --text-primary:#1a1614; --text-secondary:#6b6661; --text-tertiary:#9a948c;
      --border:#e8e4de; --border-strong:#d4ccc0;
      --accent:#ea580c; --accent-hover:#c2410c; --accent-subtle:#fff0e6;
      --success:#16a34a; --warning:#ca8a04; --danger:#dc2626; --info:#0284c7;
    }
    .theme-dark {
      --bg:#0f0e0d; --bg-elevated:#1a1816; --bg-subtle:#232020;
      --text-primary:#f5f2ed; --text-secondary:#a8a39c; --text-tertiary:#6b6661;
      --border:#2a2724; --border-strong:#3a3633;
      --accent:#fb923c; --accent-hover:#f97316; --accent-subtle:#2a1810;
      --success:#4ade80; --warning:#facc15; --danger:#f87171; --info:#38bdf8;
    }
    body { font-family: var(--font-body); }
    .font-display { font-family: var(--font-display); letter-spacing:-0.02em; }
    .font-mono { font-family: var(--font-mono); }
    .app-root { background: var(--bg); color: var(--text-primary); min-height:100vh; transition: background-color 0.2s ease, color 0.2s ease; }
    .card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; }
    .input { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary); border-radius: 8px; padding: 8px 12px; font-family: var(--font-body); font-size: 14px; transition: border-color 0.15s ease, box-shadow 0.15s ease; width: 100%; }
    .input:focus { outline:none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-subtle); }
    .btn-primary { background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s ease; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
    .btn-ghost:hover { background: var(--bg-subtle); color: var(--text-primary); }
    .btn-icon { background: transparent; border: none; color: var(--text-secondary); padding: 6px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; justify-content: center; }
    .btn-icon:hover { background: var(--bg-subtle); color: var(--text-primary); }
    .nav-item { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; color: var(--text-secondary); cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.15s ease; white-space: nowrap; border: none; background: transparent; }
    .nav-item:hover { background: var(--bg-subtle); color: var(--text-primary); }
    .nav-item.active { background: var(--accent-subtle); color: var(--accent); }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
    .badge-orange { background: var(--accent-subtle); color: var(--accent); }
    .badge-green { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
    .badge-yellow { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
    .badge-red { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
    .badge-blue { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
    .badge-neutral { background: var(--bg-subtle); color: var(--text-secondary); }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; animation: fadeIn 0.15s ease; }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    .table-row { border-bottom: 1px solid var(--border); transition: background 0.1s ease; }
    .table-row:hover { background: var(--bg-subtle); }
    .table-row:last-child { border-bottom: none; }
    .logo-flame { color: var(--accent); }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
    @keyframes slideUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
    .anim-in { animation: slideUp 0.25s ease; }
    .cal-cell { aspect-ratio: 1.1; border: 1px solid var(--border); padding: 6px; border-radius: 6px; background: var(--bg-elevated); display: flex; flex-direction: column; gap: 2px; min-height: 70px; cursor: pointer; transition: all 0.15s ease; overflow: hidden; }
    .cal-cell:hover { border-color: var(--accent); }
    .cal-cell.today { border-color: var(--accent); border-width: 2px; }
    .cal-cell.outside { opacity: 0.35; }
    .photo-thumb { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border); }
  `}</style>
);

/* ────────────── Helpers ────────────── */
const store = {
  async get(k, fallback) { try { const r = await window.storage?.get(k); return r?.value ? JSON.parse(r.value) : fallback; } catch { return fallback; } },
  async set(k, v) { try { await window.storage?.set(k, JSON.stringify(v)); } catch (e) { console.warn('Storage:', e); } },
  async del(k) { try { await window.storage?.delete(k); } catch {} },
  async list(prefix) { try { const r = await window.storage?.list(prefix); return r?.keys || []; } catch { return []; } }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => d ? new Date(d + (d.length === 10 ? 'T00:00' : '')).toLocaleDateString('pt-BR') : '—';
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});
const downloadBlob = (data, filename, mime = 'application/json') => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ────────────── Seed ────────────── */
const SEED = {
  produtos: [
    { id: uid(), nome: 'Aquecedor Rinnai 15L', sku: 'RN-15L', qtd: 4, minimo: 2, preco: 1890 },
    { id: uid(), nome: 'Aquecedor Bosch 23L', sku: 'BS-23L', qtd: 2, minimo: 2, preco: 3450 },
    { id: uid(), nome: 'Regulador de pressão', sku: 'REG-001', qtd: 12, minimo: 5, preco: 85 },
    { id: uid(), nome: 'Mangueira inox 1,2m', sku: 'MNG-12', qtd: 1, minimo: 4, preco: 65 }
  ],
  clientes: [
    { id: uid(), nome: 'Carlos Silva', telefone: '47 99999-1234', endereco: 'Rua das Palmeiras, 230 — Itapema/SC', documento: '123.456.789-00', obs: '' },
    { id: uid(), nome: 'Ana Beatriz', telefone: '47 98888-5566', endereco: 'Av. Atlântica, 1500 ap 302 — BC/SC', documento: '987.654.321-00', obs: '' }
  ],
  // Tabela de preços de VENDA (independente do estoque/custo)
  tabelaPrecos: [
    { id: uid(), nome: 'Aquecedor Rinnai 15L - instalado', categoria: 'Aquecedor', descricao: 'Inclui instalação básica', preco: 2400 },
    { id: uid(), nome: 'Aquecedor Bosch 23L - instalado', categoria: 'Aquecedor', descricao: 'Inclui instalação básica', preco: 4200 },
    { id: uid(), nome: 'Instalação avulsa', categoria: 'Serviço', descricao: 'Mão de obra para instalação (cliente fornece equipamento)', preco: 350 },
    { id: uid(), nome: 'Manutenção preventiva', categoria: 'Serviço', descricao: 'Limpeza, verificação de pressão e troca de juntas', preco: 180 },
    { id: uid(), nome: 'Desinstalação', categoria: 'Serviço', descricao: 'Retirada do equipamento', preco: 120 }
  ],
  servicos: [],
  orcamentos: [],
  notas: [],
  movimentacoes: [],
  vendas: [],
  // Sequenciador de números de venda (em prod: SEQUENCE no Postgres)
  contadores: { venda: 1000 },
  // Configurações de integração (em prod, vai pra tabela `configuracoes` no Supabase)
  config: {
    // Z-API (WhatsApp grupo)
    zapi_url: '',          // ex: https://api.z-api.io/instances/XXXX/token/YYYY
    zapi_token: '',        // Client-Token da Z-API
    whatsapp_grupo_id: '', // ID do grupo, formato: 120363xxxxxxxxxxx@g.us
    auto_enviar_whatsapp: false,
    // Plugnotas (NFe/NFSe)
    plugnotas_url: 'https://api.plugnotas.com.br',
    plugnotas_token: '',
    auto_gerar_nf: false,
    // Emitente (sua loja)
    emitente_razao: '',
    emitente_cnpj: '',
    emitente_inscricao: ''
  }
};

/* ────────────────────────────────────────────────────────────────────
   MÓDULOS DE INTEGRAÇÃO
   ─────────────────────────────────────────────────────────────────────
   Cada integração é uma função pura que recebe config + payload e
   retorna { ok, data, error }. Em produção essas funções fazem fetch
   real. No protótipo aqui no Claude, simulam sucesso após delay.

   IMPORTANTE: para "ativar" no deploy real, basta trocar o bloco MOCK
   pelo bloco REAL (comentado) em cada função.
   ──────────────────────────────────────────────────────────────────── */

const IS_PROTOTIPO = true; // troque para false no deploy real

// Envia mensagem de texto para grupo de WhatsApp via Z-API
const enviarWhatsAppGrupo = async (config, mensagem) => {
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
const emitirNotaFiscal = async (config, dados) => {
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
const imprimirCartoesOS = (os, quantidade = 4) => {
  const cartao = `
    <div class="cartao">
      <div class="cartao-header">
        <div class="cartao-tipo">${os.tipo}</div>
        <div class="cartao-data">${fmtDate(os.data)} · ${os.hora}</div>
      </div>
      <div class="cartao-tecnico">
        <div class="cartao-label">Técnico</div>
        <div class="cartao-tecnico-nome">${os.tecnico || '— não atribuído —'}</div>
      </div>
      <div class="cartao-bloco">
        <div class="cartao-label">Cliente</div>
        <div class="cartao-cliente">${os.cliente}</div>
      </div>
      <div class="cartao-bloco">
        <div class="cartao-label">Endereço</div>
        <div class="cartao-endereco">${os.endereco || '—'}</div>
      </div>
      ${os.telefone ? `<div class="cartao-bloco"><div class="cartao-label">Telefone</div><div class="cartao-tel">${os.telefone}</div></div>` : ''}
      ${os.itens?.length ? `<div class="cartao-itens">${os.itens.map(i => `${i.qtd}x ${i.nome}`).join(' · ')}</div>` : ''}
    </div>`;

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Cartões — OS ${os.cliente}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; }

  .folha {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 6mm;
    width: 194mm;
    height: 281mm;
  }

  .cartao {
    border: 2px dashed #999;
    border-radius: 4mm;
    padding: 6mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
    page-break-inside: avoid;
    background: #fff;
  }

  .cartao-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 2mm;
  }
  .cartao-tipo {
    font-size: 14pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .cartao-data { font-size: 9pt; color: #555; font-weight: 600; }

  .cartao-tecnico {
    background: #000;
    color: #fff;
    padding: 3mm;
    border-radius: 2mm;
    text-align: center;
  }
  .cartao-tecnico .cartao-label { color: #bbb; }
  .cartao-tecnico-nome {
    font-size: 18pt;
    font-weight: 800;
    line-height: 1.1;
    text-transform: uppercase;
  }

  .cartao-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    font-weight: 700;
    margin-bottom: 0.5mm;
  }

  .cartao-cliente { font-size: 13pt; font-weight: 700; line-height: 1.2; }
  .cartao-endereco { font-size: 10pt; line-height: 1.3; }
  .cartao-tel { font-size: 11pt; font-weight: 600; }

  .cartao-itens {
    margin-top: auto;
    font-size: 8pt;
    color: #555;
    border-top: 1px solid #ddd;
    padding-top: 2mm;
  }

  .no-print { margin-bottom: 10px; text-align: right; }
  .btn-print {
    background: #ea580c; color: #fff; border: none;
    padding: 10px 20px; border-radius: 4px; cursor: pointer;
    font-size: 14px; font-weight: 600;
  }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ Imprimir cartões</button>
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
const imprimirDanfe = (venda, nfData, emitente) => {
  const itensHtml = venda.itens.map(it => `
    <tr>
      <td>${it.nome}</td>
      <td style="text-align:center">${it.qtd}</td>
      <td style="text-align:right">${fmtBRL(it.preco)}</td>
      <td style="text-align:right">${fmtBRL(it.qtd * it.preco)}</td>
    </tr>`).join('');

  const tipoNotaLabel = nfData.tipo === 'nfse' ? 'NOTA FISCAL DE SERVIÇO ELETRÔNICA — NFS-e' : 'NOTA FISCAL DE CONSUMIDOR ELETRÔNICA — NFC-e';

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>NF ${nfData.numero} — ${venda.cliente}</title>
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
  .btn-print { background: #ea580c; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
</style></head><body>
${nfData.simulado ? '<div class="simulado-marca">SIMULADO</div>' : ''}
<div class="no-print" style="text-align:right; margin-bottom: 10px;">
  <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
</div>

<div class="danfe-header">
  <h1>${tipoNotaLabel}</h1>
  <div class="subtitle">Nº ${nfData.numero}  •  Série 1  •  Emissão ${new Date().toLocaleString('pt-BR')}</div>
</div>

<div class="grid-2">
  <div class="box">
    <div class="label">Emitente</div>
    <div class="value">${emitente.razao || '—'}</div>
    <div>CNPJ: ${emitente.cnpj || '—'}</div>
    <div>Inscrição: ${emitente.inscricao || '—'}</div>
  </div>
  <div class="box">
    <div class="label">Destinatário</div>
    <div class="value">${venda.cliente}</div>
    <div>${venda.clienteDocumento || 'CPF/CNPJ não informado'}</div>
    <div>${venda.clienteEndereco || '—'}</div>
  </div>
</div>

<table>
  <thead><tr><th>Descrição</th><th style="width: 60px">Qtd</th><th style="width: 100px">Unit.</th><th style="width: 100px">Total</th></tr></thead>
  <tbody>${itensHtml}</tbody>
</table>

<div class="grid-2">
  <div class="box">
    <div class="label">Forma de pagamento</div>
    <div class="value">${venda.forma_pagamento}</div>
    <div class="label" style="margin-top: 8px">Código de verificação</div>
    <div class="value">${nfData.codigo_verificacao}</div>
  </div>
  <div class="totais">
    <div class="label">VALOR TOTAL</div>
    <div class="total">${fmtBRL(venda.total)}</div>
  </div>
</div>

<div class="box">
  <div class="label">Chave de acesso</div>
  <div class="chave">${nfData.chave_acesso}</div>
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


/* ────────────── Toast (notificações) ────────────── */
const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tipo = 'info') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className="card anim-in p-3 text-sm" style={{
            minWidth: 240, maxWidth: 360,
            borderLeft: `3px solid ${t.tipo === 'success' ? 'var(--success)' : t.tipo === 'error' ? 'var(--danger)' : 'var(--info)'}`
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
const DataCtx = createContext(null);
const useData = () => useContext(DataCtx);

/* CONTEXT GLOBAL: dados + ações de negócio
   Centralizo aqui toda lógica que muta estado, evitando lógica espalhada
   nos componentes. Em produção, isto vira chamadas para Supabase. */
const DataProvider = ({ children }) => {
  const [data, setData] = useState(SEED);
  const [loaded, setLoaded] = useState(false);

  // Recarrega tudo do banco. Chamado no boot e após cada mutação.
  const recarregar = useCallback(async () => {
    const fresh = await db.carregarTudo();
    setData(fresh);
    setLoaded(true);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  /* ===== Ações de domínio =====
     Cada ação chama o banco e depois recarrega o estado.
     O estoque é movimentado pelos TRIGGERS do banco, não aqui. */

  // Movimentação manual de estoque (ajuste de entrada/saída)
  const registrarMovimentacao = useCallback(async (produtoId, tipo, qtd, motivo) => {
    await db.lancarMovimentacao(produtoId, tipo, qtd, motivo);
    await recarregar();
  }, [recarregar]);

  // Salva OS (insert ou update). Trigger do banco move o estoque.
  const salvarOS = useCallback(async (os, isEdit) => {
    if (isEdit) await db.atualizarOS(os);
    else await db.inserirOS(os);
    await recarregar();
  }, [recarregar]);

  const removerOS = useCallback(async (id) => {
    await db.removerOS(id);
    await recarregar();
  }, [recarregar]);

  return (
    <DataCtx.Provider value={{ data, setData, loaded, recarregar, registrarMovimentacao, salvarOS, removerOS }}>
      {children}
    </DataCtx.Provider>
  );
};

/* ────────────── Componentes utilitários ────────────── */
const Logo = () => (
  <div className="flex items-center gap-2">
    <div className="logo-flame"><Flame size={22} strokeWidth={2.2} fill="currentColor" fillOpacity={0.15} /></div>
    <div>
      <div className="font-display font-semibold text-base leading-none">Servigás</div>
      <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--text-tertiary)' }}>gestão interna</div>
    </div>
  </div>
);

const Modal = ({ open, onClose, title, children, maxWidth = '520px' }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card anim-in" style={{ maxWidth, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, span = 12 }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
    {children}
  </div>
);

/* ════════════════════════════════════════════════════════════════
                          LOGIN (mock)
   Em produção: substituir por supabase.auth.signInWithPassword()
   ════════════════════════════════════════════════════════════════ */
// Ícone oficial do Google (SVG inline — evita dependência extra)
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Login = ({ onLogin }) => {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarBackup, setMostrarBackup] = useState(false);

  // Login com Google (OAuth). O Supabase redireciona para o Google e volta.
  // A allowlist no banco bloqueia emails não autorizados no momento da criação.
  const entrarComGoogle = async () => {
    setErr(''); setCarregando(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      setCarregando(false);
      setErr('Falha ao conectar com o Google');
    }
    // Se der certo, o navegador redireciona — não precisa fazer mais nada aqui
  };

  // Login por email/senha — mantido como acesso de emergência
  const submit = async () => {
    setErr(''); setCarregando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: u, password: p });
    setCarregando(false);
    if (error) setErr('Email ou senha inválidos');
    else onLogin(data.user);
  };
  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="app-root theme-light flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <GlobalStyles />
      <div className="card p-8 anim-in" style={{ width: '100%', maxWidth: 380 }}>
        <div className="flex justify-center mb-6"><Logo /></div>
        <h1 className="font-display text-xl font-semibold text-center mb-1">Entrar no sistema</h1>
        <p className="text-xs text-center mb-6" style={{ color: 'var(--text-secondary)' }}>Acesso restrito · uso interno</p>

        {/* Login principal: Google */}
        <button
          type="button"
          className="btn-ghost w-full justify-center"
          style={{ padding: '10px 16px', fontWeight: 600 }}
          onClick={entrarComGoogle}
          disabled={carregando}
        >
          <GoogleIcon /> {carregando ? 'Conectando...' : 'Entrar com Google'}
        </button>

        {err && <div className="badge badge-red w-full justify-center mt-3">{err}</div>}

        {/* Divisor */}
        <div className="flex items-center gap-3 my-5">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Backup: email/senha (colapsado por padrão) */}
        {!mostrarBackup ? (
          <button
            type="button"
            className="w-full text-xs text-center"
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setMostrarBackup(true)}
          >
            Entrar com email e senha
          </button>
        ) : (
          <div className="space-y-3 anim-in">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input type="email" className="input" value={u} onChange={e => setU(e.target.value)} onKeyDown={onKey} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Senha</label>
              <input type="password" className="input" value={p} onChange={e => setP(e.target.value)} onKeyDown={onKey} />
            </div>
            <button type="button" className="btn-primary w-full justify-center" onClick={submit} disabled={carregando}>
              <Lock size={14} /> {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          DASHBOARD
   ════════════════════════════════════════════════════════════════ */
const Dashboard = ({ onNavigate }) => {
  const { data } = useData();
  const hoje = new Date().toISOString().slice(0, 10);
  const servicosHoje = data.servicos.filter(s => s.data === hoje && s.status !== 'cancelado');
  const estoqueAlerta = data.produtos.filter(p => p.qtd <= p.minimo);
  const servicosPendentes = data.servicos.filter(s => s.status === 'pendente' || s.status === 'em_andamento').length;
  const vendasHoje = (data.vendas || []).filter(v => v.data?.startsWith(hoje) && v.status !== 'cancelada');
  const faturamentoHoje = vendasHoje.reduce((s, v) => s + v.total, 0);

  const StatCard = ({ icon: Icon, label, value, hint, tone, onClick }) => (
    <button onClick={onClick} className="card text-left w-full" style={{ padding: 20, cursor: onClick ? 'pointer' : 'default' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="badge" style={{ background: 'var(--bg-subtle)', color: tone || 'var(--text-secondary)' }}><Icon size={14} /></div>
        {onClick && <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />}
      </div>
      <div className="font-display text-2xl font-semibold mb-1">{value}</div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      {hint && <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{hint}</div>}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold mb-1">Visão geral</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Faturamento hoje" value={fmtBRL(faturamentoHoje)} hint={`${vendasHoje.length} ${vendasHoje.length === 1 ? 'venda' : 'vendas'}`} tone="var(--success)" onClick={() => onNavigate('vendas')} />
        <StatCard icon={Wrench} label="Serviços hoje" value={servicosHoje.length} hint={servicosHoje.length ? 'agendados' : 'agenda livre'} tone="var(--accent)" onClick={() => onNavigate('servicos')} />
        <StatCard icon={Clock} label="OS em aberto" value={servicosPendentes} hint="pendentes + em andamento" tone="var(--info)" onClick={() => onNavigate('servicos')} />
        <StatCard icon={AlertCircle} label="Estoque em alerta" value={estoqueAlerta.length} hint={estoqueAlerta.length ? 'abaixo do mínimo' : 'tudo em ordem'} tone={estoqueAlerta.length ? 'var(--danger)' : 'var(--success)'} onClick={() => onNavigate('estoque')} />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          ESTOQUE + MOVIMENTAÇÕES
   ════════════════════════════════════════════════════════════════ */
const Estoque = ({ search }) => {
  const { data, recarregar, registrarMovimentacao } = useData();
  const [aba, setAba] = useState('produtos');
  const [modal, setModal] = useState(null);
  const [movModal, setMovModal] = useState(null);
  const [form, setForm] = useState({ nome: '', sku: '', qtd: 0, minimo: 1, preco: 0 });
  const [movForm, setMovForm] = useState({ produtoId: '', tipo: 'entrada', qtd: 1, motivo: '' });

  const abrir = (p) => { setForm(p || { nome: '', sku: '', qtd: 0, minimo: 1, preco: 0 }); setModal(p ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.nome.trim()) return;
    if (modal === 'edit') await db.atualizarProduto(form.id, form);
    else await db.inserirProduto(form);
    await recarregar();
    setModal(null);
  };
  const remover = async (id) => { if (confirm('Remover este produto?')) { await db.removerProduto(id); await recarregar(); } };

  const registrarMov = () => {
    if (!movForm.produtoId || !movForm.qtd) return;
    registrarMovimentacao(movForm.produtoId, movForm.tipo, movForm.qtd, movForm.motivo || 'Ajuste manual');
    setMovModal(null);
  };

  const filtrados = data.produtos.filter(p =>
    !search || p.nome.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const movFiltradas = data.movimentacoes.filter(m => {
    if (!search) return true;
    const p = data.produtos.find(x => x.id === m.produtoId);
    return p?.nome.toLowerCase().includes(search.toLowerCase()) || (m.motivo || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Estoque</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.produtos.length} produtos · {data.movimentacoes.length} movimentações</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setMovModal(true)}><ArrowDownUp size={14} /> Lançar movimentação</button>
          <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Novo produto</button>
        </div>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        <button className={`nav-item ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')}><Package size={14} /> Produtos</button>
        <button className={`nav-item ${aba === 'mov' ? 'active' : ''}`} onClick={() => setAba('mov')}><ArrowDownUp size={14} /> Movimentações</button>
      </div>

      {aba === 'produtos' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Produto</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>SKU</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Qtd</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Mín</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Preço</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="p-3 font-medium">{p.nome}</td>
                  <td className="p-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.sku}</td>
                  <td className="p-3 text-right"><span className={p.qtd <= p.minimo ? 'badge badge-red' : 'badge badge-green'}>{p.qtd}</span></td>
                  <td className="p-3 text-right" style={{ color: 'var(--text-secondary)' }}>{p.minimo}</td>
                  <td className="p-3 text-right font-mono">{fmtBRL(p.preco)}</td>
                  <td className="p-3 text-right">
                    <button className="btn-icon" onClick={() => abrir(p)}><Edit2 size={14} /></button>
                    <button className="btn-icon" onClick={() => remover(p.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhum produto</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'mov' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Data</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Produto</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Tipo</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Qtd</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movFiltradas.slice(0, 100).map(m => {
                const prod = data.produtos.find(p => p.id === m.produtoId);
                return (
                  <tr key={m.id} className="table-row">
                    <td className="p-3 font-mono text-xs">{new Date(m.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="p-3">{prod?.nome || <span style={{ color: 'var(--text-tertiary)' }}>removido</span>}</td>
                    <td className="p-3"><span className={`badge ${m.tipo === 'entrada' ? 'badge-green' : m.tipo === 'saida' ? 'badge-red' : 'badge-neutral'}`}>{m.tipo}</span></td>
                    <td className="p-3 text-right font-mono">{m.tipo === 'saida' ? '−' : '+'}{m.qtd}</td>
                    <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.motivo}</td>
                  </tr>
                );
              })}
              {movFiltradas.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhuma movimentação</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar produto' : 'Novo produto'}>
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome" span={12}><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="SKU" span={6}><input className="input font-mono" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Preço (R$)" span={6}><input type="number" className="input" value={form.preco} onChange={e => setForm({ ...form, preco: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Quantidade" span={6}><input type="number" className="input" value={form.qtd} onChange={e => setForm({ ...form, qtd: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Mínimo" span={6}><input type="number" className="input" value={form.minimo} onChange={e => setForm({ ...form, minimo: parseInt(e.target.value) || 0 })} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>Salvar</button>
        </div>
      </Modal>

      <Modal open={!!movModal} onClose={() => setMovModal(null)} title="Lançar movimentação manual">
        <div className="grid grid-cols-12 gap-3">
          <Field label="Produto" span={12}>
            <select className="input" value={movForm.produtoId} onChange={e => setMovForm({ ...movForm, produtoId: e.target.value })}>
              <option value="">— Selecione —</option>
              {data.produtos.map(p => <option key={p.id} value={p.id}>{p.nome} (estoque: {p.qtd})</option>)}
            </select>
          </Field>
          <Field label="Tipo" span={6}>
            <select className="input" value={movForm.tipo} onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </Field>
          <Field label="Quantidade" span={6}><input type="number" className="input" value={movForm.qtd} onChange={e => setMovForm({ ...movForm, qtd: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Motivo" span={12}><input className="input" value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} placeholder="Ex: Compra do fornecedor X" /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={() => setMovModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={registrarMov}>Registrar</button>
        </div>
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          CALENDÁRIO
   Componente reutilizável: recebe array de serviços e callback
   ════════════════════════════════════════════════════════════════ */
const CalendarView = ({ servicos, onDayClick }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay()); // domingo da semana
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [cursor]);

  const hoje = new Date().toISOString().slice(0, 10);
  const tipoCor = { 'Instalação': 'var(--success)', 'Manutenção': 'var(--warning)', 'Desinstalação': 'var(--text-tertiary)' };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <button className="btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <div className="font-display font-semibold capitalize">{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
        <button className="btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--text-tertiary)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const fora = d.getMonth() !== cursor.getMonth();
          const ehHoje = iso === hoje;
          const sDoDia = servicos.filter(s => s.data === iso && s.status !== 'cancelado');
          return (
            <div key={i} className={`cal-cell ${fora ? 'outside' : ''} ${ehHoje ? 'today' : ''}`} onClick={() => onDayClick?.(iso, sDoDia)}>
              <div className="text-xs font-medium" style={{ color: ehHoje ? 'var(--accent)' : 'var(--text-secondary)' }}>{d.getDate()}</div>
              <div className="space-y-0.5 overflow-hidden">
                {sDoDia.slice(0, 3).map(s => (
                  <div key={s.id} className="text-[10px] truncate px-1 py-0.5 rounded" style={{ background: tipoCor[s.tipo] + '22', color: tipoCor[s.tipo] }} title={`${s.hora} ${s.cliente}`}>
                    {s.hora} {s.cliente}
                  </div>
                ))}
                {sDoDia.length > 3 && <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>+{sDoDia.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          SERVIÇOS (com tudo)
   ════════════════════════════════════════════════════════════════ */
const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
const STATUS_COR = { pendente: 'badge-yellow', em_andamento: 'badge-blue', concluido: 'badge-green', cancelado: 'badge-neutral' };

const Servicos = ({ search }) => {
  const { data, salvarOS, removerOS } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(null);
  const [filtroData, setFiltroData] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [view, setView] = useState('lista');
  const [fotos, setFotos] = useState({});
  const [enviando, setEnviando] = useState(null);
  const fileInputRef = useRef(null);

  const novoForm = () => ({
    cliente: '', clienteId: '', telefone: '', endereco: '',
    tipo: 'Instalação', status: 'pendente', tecnico: '',
    data: new Date().toISOString().slice(0, 10), hora: '09:00',
    itens: [], equipamentos: '', obs: ''
  });

  const abrir = async (s) => {
    const f = s ? { ...s, itens: s.itens || [] } : novoForm();
    setForm(f);
    setModal(s ? 'edit' : 'new');
    setFotos({}); // fotos carregadas sob demanda do Storage (simplificado)
  };

  // Monta a mensagem padrão da OS para o WhatsApp
  const montarMensagem = (s) => {
    const itensTxt = (s.itens || []).map(it => `• ${it.qtd}x ${it.nome}`).join('\n') || '—';
    return `🔧 *NOVA ORDEM DE SERVIÇO*

📋 *Tipo:* ${s.tipo}
🏷️ *Status:* ${STATUS_LABEL[s.status]}
📅 *Data:* ${fmtDate(s.data)} às ${s.hora}
👷 *Técnico:* ${s.tecnico || '— a definir —'}

👤 *Cliente:* ${s.cliente}
📞 *Telefone:* ${s.telefone || '—'}
📍 *Endereço:* ${s.endereco || '—'}

🔩 *Equipamentos / itens:*
${itensTxt}${s.equipamentos ? '\n' + s.equipamentos : ''}

📝 *Observações:*
${s.obs || '—'}`;
  };

  // Envia OS para o grupo do WhatsApp via Z-API (ou wa.me como fallback)
  const enviarGrupo = async (s) => {
    setEnviando(s.id);
    const mensagem = montarMensagem(s);
    const res = await enviarWhatsAppGrupo(data.config, mensagem);
    setEnviando(null);
    if (res.ok) {
      toast(res.data?.simulado ? '✓ [Modo protótipo] Mensagem simulada — em produção iria pro grupo' : '✓ OS enviada para o grupo', 'success');
    } else {
      toast(`✗ ${res.error}`, 'error');
    }
  };

  // Fallback manual: abre WhatsApp Web/App para o usuário escolher destino
  const enviarManual = (s) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(montarMensagem(s))}`, '_blank');
  };

  const salvar = async () => {
    if (!form.cliente.trim()) return;
    const isEdit = modal === 'edit';
    await salvarOS(form, isEdit); // o banco gera o id quando é novo
    setModal(null);

    // Envio automático para grupo, se configurado
    if (!isEdit && data.config.auto_enviar_whatsapp) {
      setTimeout(() => enviarGrupo(form), 300);
    } else if (!isEdit) {
      toast('OS criada', 'success');
    }
  };

  const remover = (id) => { if (confirm('Remover esta OS? Os itens voltarão ao estoque.')) removerOS(id); };

  const onUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    const novas = await Promise.all(files.filter(f => f.size < 1024 * 1024).map(fileToBase64));
    if (files.some(f => f.size >= 1024 * 1024)) alert('Algumas fotos foram ignoradas por excederem 1MB');
    const id = form.id || 'nova';
    setFotos({ ...fotos, [id]: [...(fotos[id] || []), ...novas] });
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

  const filtrados = data.servicos.filter(s => {
    const ms = !search || s.cliente.toLowerCase().includes(search.toLowerCase()) ||
      (s.endereco || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.tecnico || '').toLowerCase().includes(search.toLowerCase());
    const md = !filtroData || s.data === filtroData;
    const mst = !filtroStatus || s.status === filtroStatus;
    return ms && md && mst;
  });

  const grupos = useMemo(() => {
    const g = {}; filtrados.forEach(s => { (g[s.data] = g[s.data] || []).push(s); });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const tipoCor = { 'Instalação': 'badge-green', 'Manutenção': 'badge-yellow', 'Desinstalação': 'badge-neutral' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Serviços</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.servicos.length} OS no total</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
            <button className={`nav-item ${view === 'lista' ? 'active' : ''}`} style={{ padding: '4px 10px' }} onClick={() => setView('lista')}><List size={13} /> Lista</button>
            <button className={`nav-item ${view === 'cal' ? 'active' : ''}`} style={{ padding: '4px 10px' }} onClick={() => setView('cal')}><Grid3x3 size={13} /> Calendário</button>
          </div>
          <select className="input" style={{ width: 'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 'auto' }} value={filtroData} onChange={e => setFiltroData(e.target.value)} />
          <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Nova OS</button>
        </div>
      </div>

      {view === 'cal' ? (
        <CalendarView servicos={filtrados} onDayClick={(iso) => { setFiltroData(iso); setView('lista'); }} />
      ) : grupos.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <Calendar size={32} className="mx-auto mb-3" />
          <p className="text-sm">Nenhuma OS encontrada</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(([dataKey, lista]) => (
            <div key={dataKey}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Calendar size={14} style={{ color: 'var(--accent)' }} />
                <span className="font-display font-semibold text-sm">
                  {new Date(dataKey + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                <span className="badge badge-neutral">{lista.length}</span>
              </div>
              <div className="space-y-2">
                {lista.map(s => (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge ${tipoCor[s.tipo] || 'badge-neutral'}`}>{s.tipo}</span>
                          <span className={`badge ${STATUS_COR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                          <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.hora}</span>
                          {s.tecnico && <span className="badge badge-orange">👷 {s.tecnico}</span>}
                        </div>
                        <div className="font-semibold mb-1">{s.cliente}</div>
                        <div className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {s.telefone && <div className="flex items-center gap-1"><Phone size={11} /> {s.telefone}</div>}
                          {s.endereco && <div className="flex items-center gap-1"><MapPin size={11} /> {s.endereco}</div>}
                          {s.itens?.length > 0 && (
                            <div className="mt-1.5 p-2 rounded text-xs" style={{ background: 'var(--bg-subtle)' }}>
                              🔩 {s.itens.map(it => `${it.qtd}x ${it.nome}`).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <button
                          className="btn-ghost"
                          style={{ background: '#25D366', color: 'white', borderColor: '#25D366', opacity: enviando === s.id ? 0.6 : 1 }}
                          onClick={() => enviarGrupo(s)}
                          disabled={enviando === s.id}
                          title="Enviar para o grupo configurado (Z-API)"
                        >
                          <MessageCircle size={14} /> {enviando === s.id ? 'Enviando...' : 'Grupo'}
                        </button>
                        <button className="btn-ghost text-xs" onClick={() => enviarManual(s)} title="Abrir WhatsApp para escolher destino">
                          <Send size={11} /> Manual
                        </button>
                        <button className="btn-ghost text-xs" onClick={() => imprimirCartoesOS(s)} title="Imprimir cartões para colar nas caixas">
                          <Printer size={11} /> Cartões
                        </button>
                        <div className="flex">
                          <button className="btn-icon" onClick={() => abrir(s)}><Edit2 size={14} /></button>
                          <button className="btn-icon" onClick={() => remover(s.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL OS */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar OS' : 'Nova Ordem de Serviço'} maxWidth="720px">
        {form && (
          <>
            <div className="grid grid-cols-12 gap-3">
              <Field label="Cliente cadastrado" span={12}>
                <select className="input" value={form.clienteId} onChange={(e) => {
                  const c = data.clientes.find(x => x.id === e.target.value);
                  if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, telefone: c.telefone, endereco: c.endereco });
                  else setForm({ ...form, clienteId: '' });
                }}>
                  <option value="">— Cliente avulso (digite abaixo) —</option>
                  {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Nome do cliente" span={6}><input className="input" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
              <Field label="Telefone" span={6}><input className="input" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Field>
              <Field label="Endereço" span={12}><input className="input" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></Field>

              <Field label="Tipo" span={3}>
                <select className="input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  <option>Instalação</option><option>Manutenção</option><option>Desinstalação</option>
                </select>
              </Field>
              <Field label="Status" span={3}>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Técnico responsável" span={6}>
                <input className="input" value={form.tecnico || ''} onChange={e => setForm({ ...form, tecnico: e.target.value })} placeholder="Nome do técnico" />
              </Field>
              <Field label="Data" span={6}><input type="date" className="input" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></Field>
              <Field label="Hora" span={6}><input type="time" className="input" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} /></Field>

              {/* ITENS — movimentação automática de estoque */}
              <Field label="Itens / equipamentos (descontam do estoque)" span={12}>
                <div className="space-y-2">
                  {form.itens.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-2 rounded" style={{ background: 'var(--bg-subtle)' }}>
                      <span className="flex-1 text-sm">{it.nome}</span>
                      <input type="number" min="1" className="input" style={{ width: 80 }} value={it.qtd} onChange={e => updItem(idx, parseInt(e.target.value) || 1)} />
                      <button className="btn-icon" onClick={() => rmItem(idx)}><X size={14} /></button>
                    </div>
                  ))}
                  <select className="input" value="" onChange={e => { if (e.target.value) { addItem(e.target.value); e.target.value = ''; } }}>
                    <option value="">+ Adicionar item do estoque...</option>
                    {data.produtos.filter(p => p.qtd > 0).map(p => <option key={p.id} value={p.id}>{p.nome} (estoque: {p.qtd})</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Notas adicionais (texto livre)" span={12}><textarea className="input" rows="2" value={form.equipamentos} onChange={e => setForm({ ...form, equipamentos: e.target.value })} /></Field>
              <Field label="Observações" span={12}><textarea className="input" rows="2" value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>

              {/* FOTOS */}
              <Field label="Fotos do serviço (máx 1MB cada)" span={12}>
                <div className="flex flex-wrap gap-2 items-center">
                  {(fotos[form.id || 'nova'] || []).map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="photo-thumb" />
                      <button className="btn-icon" style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: 'white' }} onClick={() => removerFoto(i)}><X size={12} /></button>
                    </div>
                  ))}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onUpload} />
                  <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()}><ImageIcon size={14} /> Adicionar</button>
                </div>
              </Field>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>Salvar OS</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          ORÇAMENTOS
   ════════════════════════════════════════════════════════════════ */
const Orcamentos = ({ search }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [form, setForm] = useState({ cliente: '', clienteId: '', clienteDocumento: '', clienteEndereco: '', local: '', itens: '', total: 0, validade: '', data: new Date().toISOString().slice(0, 10), status: 'aberto' });
  const [tabForm, setTabForm] = useState({ nome: '', categoria: '', descricao: '', preco: 0 });
  const [gerandoNF, setGerandoNF] = useState(null);

  /* === Orçamentos === */
  const abrir = (o) => { setForm(o || { cliente: '', clienteId: '', clienteDocumento: '', clienteEndereco: '', local: '', itens: '', total: 0, validade: '', data: new Date().toISOString().slice(0, 10), status: 'aberto' }); setModal(o ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.cliente.trim()) return;
    if (modal === 'edit') await db.atualizarOrcamento(form.id, form);
    else await db.inserirOrcamento(form);
    await recarregar(); setModal(null);
  };
  const remover = async (id) => { if (confirm('Remover?')) { await db.removerOrcamento(id); await recarregar(); } };

  /* === Tabela de preços (CRUD independente) === */
  const abrirTab = (t) => { setTabForm(t || { nome: '', categoria: '', descricao: '', preco: 0 }); setTabModal(t ? 'edit' : 'new'); };
  const salvarTab = async () => {
    if (!tabForm.nome.trim()) return;
    if (tabModal === 'edit') await db.atualizarTabelaPreco(tabForm.id, tabForm);
    else await db.inserirTabelaPreco(tabForm);
    await recarregar();
    setTabModal(null);
  };
  const removerTab = async (id) => {
    if (confirm('Remover este item da tabela?')) { await db.removerTabelaPreco(id); await recarregar(); }
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
        data: new Date().toISOString().slice(0, 10),
        obs: `Gerada do orçamento. Chave: ${res.data.chave_acesso || '—'}${res.data.simulado ? ' (SIMULADA)' : ''}`,
        pdfRef: null
      });
      await db.atualizarOrcamento(orc.id, { ...orc, status: 'aprovado', nfNumero: res.data.numero });
      await recarregar();
      toast(res.data.simulado ? `✓ [Simulada] NF nº ${res.data.numero}` : `✓ NF nº ${res.data.numero} emitida`, 'success');
    } else {
      toast(`✗ ${res.error}`, 'error');
    }
  };

  /* === Copiar orçamento formatado (para WhatsApp, email, etc) === */
  const montarTextoOrcamento = (orc) => {
    const emitente = data.config.emitente_razao || 'Assistência Técnica';
    const validadeTxt = orc.validade ? `\n⏳ *Válido até:* ${fmtDate(orc.validade)}` : '';
    return `*ORÇAMENTO*
${emitente}

👤 *Cliente:* ${orc.cliente}
📍 *Local:* ${orc.local || '—'}
📅 *Data:* ${fmtDate(orc.data)}${validadeTxt}

━━━━━━━━━━━━━━━
📋 *Descrição dos serviços/produtos:*

${orc.itens || '—'}

━━━━━━━━━━━━━━━
💰 *VALOR TOTAL: ${fmtBRL(orc.total)}*
━━━━━━━━━━━━━━━

Qualquer dúvida, estamos à disposição!`;
  };

  const copiarOrcamento = async (orc) => {
    const texto = montarTextoOrcamento(orc);
    try {
      await navigator.clipboard.writeText(texto);
      toast('✓ Orçamento copiado — cole no WhatsApp ou email', 'success');
    } catch {
      // Fallback para navegadores/contextos sem Clipboard API
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('✓ Orçamento copiado', 'success');
    }
  };

  const enviarOrcamentoWhats = (orc) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(montarTextoOrcamento(orc))}`, '_blank');
  };

  const filtrados = data.orcamentos.filter(o => !search || o.cliente.toLowerCase().includes(search.toLowerCase()) || (o.local || '').toLowerCase().includes(search.toLowerCase()));
  const tabFiltrada = data.tabelaPrecos.filter(t => !search || t.nome.toLowerCase().includes(search.toLowerCase()) || (t.categoria || '').toLowerCase().includes(search.toLowerCase()));

  // Agrupa tabela por categoria
  const tabPorCategoria = useMemo(() => {
    const g = {}; tabFiltrada.forEach(t => { (g[t.categoria || 'Outros'] = g[t.categoria || 'Outros'] || []).push(t); });
    return Object.entries(g);
  }, [tabFiltrada]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl font-semibold mb-1">Orçamentos</h1></div>
        <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Novo orçamento</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Tabela de preços EDITÁVEL */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold flex items-center gap-2"><DollarSign size={16} style={{ color: 'var(--accent)' }} /> Tabela de preços</h3>
            <button className="btn-ghost text-xs" onClick={() => abrirTab(null)}><Plus size={12} /> Item</button>
          </div>
          {tabPorCategoria.length === 0 ? (
            <div className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Nenhum item</div>
          ) : tabPorCategoria.map(([cat, itens]) => (
            <div key={cat} className="mb-3">
              <div className="text-[11px] uppercase tracking-wider font-mono mb-1" style={{ color: 'var(--text-tertiary)' }}>{cat}</div>
              <div className="space-y-1">
                {itens.map(t => (
                  <div key={t.id} className="flex justify-between items-center gap-2 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.nome}</div>
                      {t.descricao && <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{t.descricao}</div>}
                    </div>
                    <div className="text-right flex items-center gap-1">
                      <div className="font-mono text-sm font-semibold whitespace-nowrap">{fmtBRL(t.preco)}</div>
                      <button className="btn-icon" onClick={() => abrirTab(t)}><Edit2 size={12} /></button>
                      <button className="btn-icon" onClick={() => removerTab(t.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Orçamentos */}
        <div className="lg:col-span-3 space-y-2">
          {filtrados.length === 0
            ? <div className="card p-10 text-center" style={{ color: 'var(--text-tertiary)' }}><Receipt size={32} className="mx-auto mb-3" /><p className="text-sm">Nenhum orçamento</p></div>
            : filtrados.map(o => (
              <div key={o.id} className="card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold">{o.cliente}</span>
                      <span className={`badge ${o.status === 'aprovado' ? 'badge-green' : o.status === 'recusado' ? 'badge-red' : 'badge-yellow'}`}>{o.status || 'aberto'}</span>
                      {o.nfNumero && <span className="badge badge-blue">NF {o.nfNumero}</span>}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{o.local} • {fmtDate(o.data)}</div>
                    {o.itens && <div className="text-xs mt-2 p-2 rounded whitespace-pre-line" style={{ background: 'var(--bg-subtle)' }}>{o.itens}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-display font-semibold text-lg">{fmtBRL(o.total)}</div>
                    {o.validade && <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>val. {fmtDate(o.validade)}</div>}
                    <div className="mt-2 flex gap-1 justify-end flex-wrap">
                      <button className="btn-ghost text-xs" onClick={() => copiarOrcamento(o)} title="Copiar orçamento formatado">
                        <Copy size={12} /> Copiar
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        style={{ background: '#25D366', color: 'white', borderColor: '#25D366' }}
                        onClick={() => enviarOrcamentoWhats(o)}
                        title="Enviar por WhatsApp"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </button>
                      {!o.nfNumero && (
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => gerarNF(o)}
                          disabled={gerandoNF === o.id}
                          title="Emitir NF pela Plugnotas"
                        >
                          <Receipt size={12} /> {gerandoNF === o.id ? '...' : 'Gerar NF'}
                        </button>
                      )}
                      <button className="btn-icon" onClick={() => abrir(o)}><Edit2 size={14} /></button>
                      <button className="btn-icon" onClick={() => remover(o.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Modal Orçamento */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar orçamento' : 'Novo orçamento'} maxWidth="640px">
        <div className="grid grid-cols-12 gap-3">
          <Field label="Cliente cadastrado" span={12}>
            <select className="input" value={form.clienteId || ''} onChange={(e) => {
              const c = data.clientes.find(x => x.id === e.target.value);
              if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, clienteDocumento: c.documento, clienteEndereco: c.endereco });
              else setForm({ ...form, clienteId: '' });
            }}>
              <option value="">— Cliente avulso —</option>
              {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Nome do cliente" span={6}><input className="input" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="CPF/CNPJ" span={6}><input className="input font-mono" value={form.clienteDocumento || ''} onChange={e => setForm({ ...form, clienteDocumento: e.target.value })} /></Field>
          <Field label="Local / endereço" span={12}><input className="input" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} /></Field>
          <Field label="Itens / descrição (pode colar da tabela)" span={12}><textarea className="input" rows="4" value={form.itens} onChange={e => setForm({ ...form, itens: e.target.value })} /></Field>
          <Field label="Total (R$)" span={4}><input type="number" className="input" value={form.total} onChange={e => setForm({ ...form, total: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Validade" span={4}><input type="date" className="input" value={form.validade} onChange={e => setForm({ ...form, validade: e.target.value })} /></Field>
          <Field label="Status" span={4}>
            <select className="input" value={form.status || 'aberto'} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="aberto">Aberto</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </Modal>

      {/* Modal Tabela de preços */}
      <Modal open={!!tabModal} onClose={() => setTabModal(null)} title={tabModal === 'edit' ? 'Editar item da tabela' : 'Novo item na tabela'}>
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome" span={12}><input className="input" value={tabForm.nome} onChange={e => setTabForm({ ...tabForm, nome: e.target.value })} /></Field>
          <Field label="Categoria" span={6}><input className="input" value={tabForm.categoria} onChange={e => setTabForm({ ...tabForm, categoria: e.target.value })} placeholder="Ex: Aquecedor, Serviço, Acessório" /></Field>
          <Field label="Preço (R$)" span={6}><input type="number" className="input" value={tabForm.preco} onChange={e => setTabForm({ ...tabForm, preco: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Descrição" span={12}><textarea className="input" rows="2" value={tabForm.descricao} onChange={e => setTabForm({ ...tabForm, descricao: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button className="btn-ghost" onClick={() => setTabModal(null)}>Cancelar</button><button className="btn-primary" onClick={salvarTab}>Salvar</button></div>
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          NOTAS FISCAIS (com upload PDF)
   ════════════════════════════════════════════════════════════════ */
const Notas = ({ search }) => {
  const { data, recarregar } = useData();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ numero: '', fornecedor: '', valor: 0, data: new Date().toISOString().slice(0, 10), obs: '', pdfRef: null });
  const [pdfFile, setPdfFile] = useState(null);
  const fileRef = useRef(null);

  const abrir = (n) => {
    setForm(n || { numero: '', fornecedor: '', valor: 0, data: new Date().toISOString().slice(0, 10), obs: '', pdfRef: null });
    setPdfFile(null);
    setModal(n ? 'edit' : 'new');
  };

  const salvar = async () => {
    if (!form.numero.trim()) return;
    let nota;
    if (modal === 'edit') { await db.atualizarNota(form.id, form); nota = form; }
    else { const { data: nova } = await db.inserirNota(form); nota = nova; }
    // Upload do PDF para o Storage, se houver
    if (pdfFile && nota?.id) {
      const { path } = await db.uploadPdfNota(pdfFile, nota.id);
      if (path) await db.atualizarNota(nota.id, { ...form, pdfRef: path });
    }
    await recarregar();
    setModal(null);
  };

  const remover = async (n) => {
    if (!confirm('Remover esta nota?')) return;
    await db.removerNota(n.id);
    await recarregar();
  };

  const verPdf = async (pdfRef) => {
    const url = await db.urlAssinada('notas-pdf', pdfRef);
    if (url) window.open(url, '_blank');
  };

  const onPdfChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { alert('PDF deve ter no máximo 4MB'); return; }
    setPdfFile(f);
  };

  const filtrados = data.notas.filter(n => !search || n.numero.includes(search) || n.fornecedor.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl font-semibold mb-1">Notas fiscais</h1></div>
        <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Nova nota</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Nº</th>
              <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Fornecedor</th>
              <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Data</th>
              <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Valor</th>
              <th className="text-center p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>PDF</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(n => (
              <tr key={n.id} className="table-row">
                <td className="p-3 font-mono">{n.numero}</td>
                <td className="p-3 font-medium">{n.fornecedor}</td>
                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(n.data)}</td>
                <td className="p-3 text-right font-mono">{fmtBRL(n.valor)}</td>
                <td className="p-3 text-center">
                  {n.pdfRef
                    ? <button className="btn-icon" onClick={() => verPdf(n.pdfRef)} title="Abrir PDF"><Eye size={14} /></button>
                    : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td className="p-3 text-right">
                  <button className="btn-icon" onClick={() => abrir(n)}><Edit2 size={14} /></button>
                  <button className="btn-icon" onClick={() => remover(n)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhuma nota</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar nota' : 'Nova nota'}>
        <div className="grid grid-cols-12 gap-3">
          <Field label="Número" span={6}><input className="input font-mono" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /></Field>
          <Field label="Data" span={6}><input type="date" className="input" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label="Fornecedor" span={12}><input className="input" value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></Field>
          <Field label="Valor" span={12}><input type="number" className="input" value={form.valor} onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Observações" span={12}><textarea className="input" rows="2" value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>
          <Field label="Anexar PDF (máx 4MB)" span={12}>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={onPdfChange} />
            <div className="flex gap-2 items-center">
              <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}><Paperclip size={14} /> {form.pdfRef || pdfFile ? 'Substituir PDF' : 'Selecionar PDF'}</button>
              {pdfFile && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{pdfFile.name}</span>}
              {form.pdfRef && !pdfFile && <button type="button" className="btn-ghost" onClick={() => verPdf(form.pdfRef)}><Eye size={14} /> Visualizar atual</button>}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          CLIENTES
   ════════════════════════════════════════════════════════════════ */
const Clientes = ({ search }) => {
  const { data, recarregar } = useData();
  const [modal, setModal] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '', documento: '', obs: '' });
  const abrir = (c) => { setForm(c || { nome: '', telefone: '', endereco: '', documento: '', obs: '' }); setModal(c ? 'edit' : 'new'); };
  const salvar = async () => {
    if (!form.nome.trim()) return;
    if (modal === 'edit') await db.atualizarCliente(form.id, form);
    else await db.inserirCliente(form);
    await recarregar(); setModal(null);
  };
  const remover = async (id) => { if (confirm('Remover?')) { await db.removerCliente(id); await recarregar(); } };
  const filtrados = data.clientes.filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || (c.telefone || '').includes(search));
  const histServ = historico ? data.servicos.filter(s => s.clienteId === historico.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl font-semibold mb-1">Clientes</h1><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.clientes.length} cadastrados</p></div>
        <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Novo</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtrados.map(c => (
          <div key={c.id} className="card p-4 flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold mb-1">{c.nome}</div>
              <div className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                {c.telefone && <div className="flex items-center gap-1"><Phone size={11} /> {c.telefone}</div>}
                {c.endereco && <div className="flex items-center gap-1"><MapPin size={11} /> {c.endereco}</div>}
                {c.documento && <div className="flex items-center gap-1 font-mono"><User size={11} /> {c.documento}</div>}
              </div>
              {c.obs && <div className="text-xs mt-2 p-2 rounded" style={{ background: 'var(--bg-subtle)' }}>{c.obs}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <button className="btn-ghost text-xs" onClick={() => setHistorico(c)}>Histórico</button>
              <div><button className="btn-icon" onClick={() => abrir(c)}><Edit2 size={14} /></button><button className="btn-icon" onClick={() => remover(c.id)}><Trash2 size={14} /></button></div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar' : 'Novo cliente'}>
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome" span={12}><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Telefone" span={6}><input className="input" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Field>
          <Field label="CPF/CNPJ" span={6}><input className="input font-mono" value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></Field>
          <Field label="Endereço" span={12}><input className="input" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></Field>
          <Field label="Observações" span={12}><textarea className="input" rows="2" value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </Modal>
      <Modal open={!!historico} onClose={() => setHistorico(null)} title={`Histórico — ${historico?.nome || ''}`}>
        {histServ.length === 0
          ? <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhum serviço ainda</div>
          : <div className="space-y-2">{histServ.map(s => (
            <div key={s.id} className="p-3 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex justify-between items-center mb-1">
                <span className="badge badge-orange">{s.tipo}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{fmtDate(s.data)} {s.hora}</span>
              </div>
              <span className={`badge ${STATUS_COR[s.status]} mt-1`}>{STATUS_LABEL[s.status]}</span>
            </div>
          ))}</div>}
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          VENDAS (PDV)
   Fluxo: nova venda → seleciona cliente → adiciona itens (estoque
   ou tabela de preços) → escolhe forma de pagamento → finaliza →
   emite NF → imprime DANFE.
   ════════════════════════════════════════════════════════════════ */
const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Boleto', 'A combinar'];

const Vendas = ({ search }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [resultModal, setResultModal] = useState(null); // { venda, nf }
  const [emitindo, setEmitindo] = useState(false);
  const [filtroData, setFiltroData] = useState('');
  const [form, setForm] = useState(null);

  const novoForm = () => ({
    cliente: '', clienteId: '', clienteDocumento: '', clienteEndereco: '',
    itens: [], // [{ origem: 'estoque'|'tabela', refId, nome, qtd, preco }]
    desconto: 0,
    forma_pagamento: 'Dinheiro',
    tipo_nota: 'nfse', // 'nfse' | 'nfce' | 'sem_nota'
    observacoes: ''
  });

  const abrir = (v) => { setForm(v ? { ...v } : novoForm()); setModal(v ? 'edit' : 'new'); };

  /* === Cálculos === */
  const subtotal = useMemo(() => (form?.itens || []).reduce((s, it) => s + it.qtd * it.preco, 0), [form]);
  const total = subtotal - (form?.desconto || 0);

  /* === Manipulação de itens === */
  const addProduto = (produtoId) => {
    const p = data.produtos.find(x => x.id === produtoId);
    if (!p) return;
    if (p.qtd <= 0) { toast(`${p.nome} sem estoque`, 'error'); return; }
    // Se já existe no carrinho, incrementa
    const existe = form.itens.find(i => i.origem === 'estoque' && i.refId === produtoId);
    if (existe) {
      setForm({ ...form, itens: form.itens.map(i => i === existe ? { ...i, qtd: i.qtd + 1 } : i) });
    } else {
      setForm({ ...form, itens: [...form.itens, { origem: 'estoque', refId: p.id, nome: p.nome, qtd: 1, preco: p.preco }] });
    }
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
    if (error) {
      setEmitindo(false);
      toast(`Erro ao registrar venda: ${error.message}`, 'error');
      return;
    }
    const venda = { ...form, ...vendaCriada, total };
    const numero = vendaCriada.numero;

    let nfDataFinal = null;

    // 2. Se for emitir nota, chama a API (mock por enquanto)
    if (form.tipo_nota !== 'sem_nota') {
      const descricao = form.itens.map(i => `${i.qtd}x ${i.nome}`).join(' + ');
      const res = await emitirNotaFiscal(data.config, {
        tipo: form.tipo_nota,
        cliente_nome: form.cliente,
        cliente_documento: form.clienteDocumento,
        cliente_endereco: form.clienteEndereco,
        descricao,
        valor: total,
        itens: form.itens
      });

      if (!res.ok) {
        setEmitindo(false);
        toast(`✗ Falha ao emitir NF: ${res.error}`, 'error');
        await recarregar();
        setModal(null);
        setResultModal({ venda, nf: null });
        return;
      } else {
        nfDataFinal = res.data;
        venda.nfNumero = res.data.numero;
        venda.nfChave = res.data.chave_acesso;
        venda.tipo_nota_emitida = res.data.tipo;

        // Atualiza a venda com dados da NF e cria registro em Notas
        await db.inserirNota({
          numero: res.data.numero,
          fornecedor: form.cliente,
          valor: total,
          data: new Date().toISOString().slice(0, 10),
          obs: `${form.tipo_nota.toUpperCase()} de venda #${numero}${res.data.simulado ? ' (SIMULADA)' : ''}. Chave: ${res.data.chave_acesso}`,
          pdfRef: null
        });
      }
    }

    // 3. Recarrega tudo do banco (estoque já foi movido pelo trigger)
    await recarregar();

    setEmitindo(false);
    setModal(null);
    setResultModal({ venda, nf: nfDataFinal });
  };

  const cancelarVenda = async (v) => {
    if (!confirm(`Cancelar venda #${v.numero}? Isso restaurará o estoque mas NÃO cancela a NF (cancelamento de NF deve ser feito separadamente).`)) return;
    // O trigger do banco estorna o estoque automaticamente ao mudar status
    await db.cancelarVenda(v.id);
    await recarregar();
    toast('Venda cancelada', 'info');
  };

  const reimprimirNF = (v) => {
    if (!v.nfNumero) { toast('Venda sem NF emitida', 'error'); return; }
    imprimirDanfe(v, {
      numero: v.nfNumero,
      chave_acesso: v.nfChave,
      codigo_verificacao: '—',
      tipo: v.tipo_nota_emitida || v.tipo_nota,
      simulado: IS_PROTOTIPO
    }, { razao: data.config.emitente_razao, cnpj: data.config.emitente_cnpj, inscricao: data.config.emitente_inscricao });
  };

  /* === Filtros === */
  const filtradas = data.vendas.filter(v => {
    const ms = !search || v.cliente.toLowerCase().includes(search.toLowerCase()) || String(v.numero).includes(search);
    const md = !filtroData || v.data.startsWith(filtroData);
    return ms && md;
  });

  const vendasHoje = data.vendas.filter(v => v.data.startsWith(new Date().toISOString().slice(0, 10)) && v.status !== 'cancelada');
  const totalHoje = vendasHoje.reduce((s, v) => s + v.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Vendas</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Hoje: <strong>{vendasHoje.length}</strong> {vendasHoje.length === 1 ? 'venda' : 'vendas'} · <strong>{fmtBRL(totalHoje)}</strong>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" className="input" style={{ width: 'auto' }} value={filtroData} onChange={e => setFiltroData(e.target.value)} />
          {filtroData && <button className="btn-icon" onClick={() => setFiltroData('')}><X size={14} /></button>}
          <button className="btn-primary" onClick={() => abrir(null)}><ShoppingCart size={16} /> Nova venda</button>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <ShoppingCart size={32} className="mx-auto mb-3" />
          <p className="text-sm">Nenhuma venda registrada</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Nº</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Data</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Cliente</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Itens</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Pagamento</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>NF</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(v => (
                <tr key={v.id} className="table-row" style={{ opacity: v.status === 'cancelada' ? 0.5 : 1 }}>
                  <td className="p-3 font-mono">#{v.numero}</td>
                  <td className="p-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(v.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-3 font-medium">{v.cliente}{v.status === 'cancelada' && <span className="badge badge-red ml-2">cancelada</span>}</td>
                  <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{v.itens.length} {v.itens.length === 1 ? 'item' : 'itens'}</td>
                  <td className="p-3 text-xs">{v.forma_pagamento}</td>
                  <td className="p-3">{v.nfNumero ? <span className="badge badge-green">{v.tipo_nota_emitida?.toUpperCase()} {v.nfNumero}</span> : <span className="badge badge-neutral">sem nota</span>}</td>
                  <td className="p-3 text-right font-mono font-semibold">{fmtBRL(v.total)}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {v.nfNumero && <button className="btn-icon" onClick={() => reimprimirNF(v)} title="Reimprimir DANFE"><Printer size={14} /></button>}
                    {v.status !== 'cancelada' && <button className="btn-icon" onClick={() => cancelarVenda(v)} title="Cancelar venda"><X size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL NOVA VENDA */}
      <Modal open={!!modal} onClose={() => !emitindo && setModal(null)} title="Nova venda" maxWidth="780px">
        {form && (
          <>
            <div className="grid grid-cols-12 gap-3">
              {/* CLIENTE */}
              <Field label="Cliente" span={12}>
                <select className="input" value={form.clienteId} onChange={e => {
                  const c = data.clientes.find(x => x.id === e.target.value);
                  if (c) setForm({ ...form, clienteId: c.id, cliente: c.nome, clienteDocumento: c.documento, clienteEndereco: c.endereco });
                  else setForm({ ...form, clienteId: '' });
                }}>
                  <option value="">— Consumidor avulso —</option>
                  {data.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Nome" span={6}><input className="input" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></Field>
              <Field label="CPF/CNPJ" span={6}><input className="input font-mono" value={form.clienteDocumento} onChange={e => setForm({ ...form, clienteDocumento: e.target.value })} placeholder="(necessário para NF)" /></Field>
              <Field label="Endereço" span={12}><input className="input" value={form.clienteEndereco} onChange={e => setForm({ ...form, clienteEndereco: e.target.value })} /></Field>
            </div>

            {/* CARRINHO */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-semibold">Itens</h4>
                <div className="flex gap-2">
                  <select className="input" style={{ width: 220 }} value="" onChange={e => { if (e.target.value) { addProduto(e.target.value); e.target.value = ''; } }}>
                    <option value="">+ Produto do estoque...</option>
                    {data.produtos.filter(p => p.qtd > 0).map(p => <option key={p.id} value={p.id}>{p.nome} (est: {p.qtd}) — {fmtBRL(p.preco)}</option>)}
                  </select>
                  <select className="input" style={{ width: 220 }} value="" onChange={e => { if (e.target.value) { addServico(e.target.value); e.target.value = ''; } }}>
                    <option value="">+ Item da tabela...</option>
                    {data.tabelaPrecos.map(t => <option key={t.id} value={t.id}>{t.nome} — {fmtBRL(t.preco)}</option>)}
                  </select>
                </div>
              </div>

              {form.itens.length === 0 ? (
                <div className="card p-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Carrinho vazio — adicione itens acima
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th className="text-left p-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Item</th>
                        <th className="text-left p-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Origem</th>
                        <th className="text-right p-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }} width="80">Qtd</th>
                        <th className="text-right p-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }} width="120">Preço</th>
                        <th className="text-right p-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Subtotal</th>
                        <th width="40"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.itens.map((it, i) => (
                        <tr key={i} className="table-row">
                          <td className="p-2">{it.nome}</td>
                          <td className="p-2"><span className={`badge ${it.origem === 'estoque' ? 'badge-blue' : 'badge-orange'}`}>{it.origem === 'estoque' ? 'produto' : 'serviço'}</span></td>
                          <td className="p-2 text-right"><input type="number" min="1" className="input font-mono" style={{ textAlign: 'right' }} value={it.qtd} onChange={e => updItem(i, parseInt(e.target.value) || 1)} /></td>
                          <td className="p-2 text-right"><input type="number" step="0.01" className="input font-mono" style={{ textAlign: 'right' }} value={it.preco} onChange={e => updPreco(i, parseFloat(e.target.value) || 0)} /></td>
                          <td className="p-2 text-right font-mono font-semibold">{fmtBRL(it.qtd * it.preco)}</td>
                          <td className="p-2"><button className="btn-icon" onClick={() => rmItem(i)}><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TOTAIS E PAGAMENTO */}
            <div className="grid grid-cols-12 gap-3 mt-4">
              <Field label="Forma de pagamento" span={4}>
                <select className="input" value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Tipo de nota" span={4}>
                <select className="input" value={form.tipo_nota} onChange={e => setForm({ ...form, tipo_nota: e.target.value })}>
                  <option value="nfce">NFC-e (produto)</option>
                  <option value="nfse">NFS-e (serviço)</option>
                  <option value="sem_nota">Sem nota fiscal</option>
                </select>
              </Field>
              <Field label="Desconto (R$)" span={4}><input type="number" step="0.01" className="input" value={form.desconto} onChange={e => setForm({ ...form, desconto: parseFloat(e.target.value) || 0 })} /></Field>
              <Field label="Observações" span={12}><input className="input" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></Field>
            </div>

            <div className="mt-5 p-4 rounded" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span className="font-mono">{fmtBRL(subtotal)}</span></div>
              {form.desconto > 0 && <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-secondary)' }}>Desconto</span><span className="font-mono">− {fmtBRL(form.desconto)}</span></div>}
              <div className="flex justify-between items-baseline mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-display font-semibold">Total</span>
                <span className="font-display text-2xl font-semibold" style={{ color: 'var(--accent)' }}>{fmtBRL(total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setModal(null)} disabled={emitindo}>Cancelar</button>
              <button className="btn-primary" onClick={finalizar} disabled={emitindo}>
                {emitindo
                  ? '⏳ Emitindo NF...'
                  : form.tipo_nota === 'sem_nota'
                    ? <>Finalizar venda</>
                    : <>Finalizar e emitir NF</>}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* MODAL RESULTADO DA VENDA */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title="Venda finalizada" maxWidth="480px">
        {resultModal && (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center rounded-full mb-3" style={{ width: 56, height: 56, background: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
                <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
              </div>
              <div className="font-display text-xl font-semibold">Venda #{resultModal.venda.numero}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtBRL(resultModal.venda.total)} · {resultModal.venda.forma_pagamento}</div>
            </div>

            {resultModal.nf ? (
              <div className="card p-4 mb-4" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Nota emitida</div>
                <div className="font-mono font-semibold mb-1">{resultModal.nf.tipo.toUpperCase()} nº {resultModal.nf.numero}</div>
                <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>Chave: {resultModal.nf.chave_acesso}</div>
                {resultModal.nf.simulado && <div className="badge badge-yellow mt-2">⚠️ Modo protótipo — NF simulada</div>}
              </div>
            ) : (
              <div className="card p-4 mb-4 text-sm text-center" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                Venda registrada sem emissão de nota fiscal
              </div>
            )}

            <div className="flex flex-col gap-2">
              {resultModal.nf && (
                <button className="btn-primary justify-center" onClick={() => imprimirDanfe(resultModal.venda, resultModal.nf, { razao: data.config.emitente_razao, cnpj: data.config.emitente_cnpj, inscricao: data.config.emitente_inscricao })}>
                  <Printer size={16} /> Imprimir DANFE
                </button>
              )}
              <button className="btn-ghost justify-center" onClick={() => setResultModal(null)}>Fechar</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                  CONFIGURAÇÕES (backup + relatórios)
   ════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
                 LOJA VIRTUAL — catálogo do site público
   O que você salva aqui aparece na hora em servigas-loja.vercel.app.
   ════════════════════════════════════════════════════════════════ */
const CATS_LOJA = [
  { id: 'aquecedores', nome: 'Aquecedores a gás', sub: ['Rheem', 'Rinnai', 'Komeco', 'Lorenzetti'] },
  { id: 'bombas', nome: 'Bombas pressurizadoras', sub: ['Komeco', 'Rinnai'] },
  { id: 'mangueiras', nome: 'Mangueiras', sub: ['Gás', 'Água'] },
  { id: 'registros', nome: 'Registros de gás', sub: [] },
  { id: 'acabamentos', nome: 'Acabamentos', sub: [] },
  { id: 'dutos', nome: 'Duto de exaustão', sub: [] },
];
const FORM_LOJA_VAZIO = { nome: '', marca: '', categoria: 'aquecedores', sub: '', preco: '', precoAntigo: '', destaque: false, ativo: true, descricao: '', specsTexto: '', fotos: [] };

const Loja = ({ search }) => {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(FORM_LOJA_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [subindoFoto, setSubindoFoto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await db.listarLojaProdutos();
    if (error) setErro(error.message); else { setErro(null); setLista(data); }
    setCarregando(false);
  }, []);
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
    const payload = { ...form, specs: form.specsTexto.split('\n').map(s => s.trim()).filter(Boolean) };
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
  const filtrados = lista.filter(p =>
    !search || (p.nome + ' ' + p.marca).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Loja virtual</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {lista.length} produtos · {lista.filter(p => p.ativo).length} no ar — o que você salva aqui aparece na hora no site
          </p>
        </div>
        <div className="flex gap-2">
          <a className="btn-ghost" href="https://servigas-loja.vercel.app" target="_blank" rel="noreferrer"><ExternalLink size={14} /> Ver site</a>
          <button className="btn-primary" onClick={() => abrir(null)}><Plus size={16} /> Novo produto</button>
        </div>
      </div>

      {erro && (
        <div className="card p-5 text-sm" style={{ borderColor: 'var(--danger)' }}>
          <b>Não consegui acessar o catálogo.</b> ({erro})<br />
          Se a tabela ainda não existe, rode o script <span className="font-mono">supabase/loja.sql</span> no
          SQL Editor do painel do Supabase e recarregue esta página.
        </div>
      )}

      {!erro && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Produto</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Categoria</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Preço</th>
                <th className="text-center p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>No site</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} className="table-row" style={{ opacity: p.ativo ? 1 : 0.55 }}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div style={{ width: 52, height: 52, borderRadius: 9, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative', border: '1px solid var(--border)' }}>
                        {p.fotos[0]
                          ? <img src={p.fotos[0]} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <ImageIcon size={18} style={{ color: 'var(--text-tertiary)' }} />}
                        {p.fotos.length > 1 && (
                          <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 999 }}>
                            {p.fotos.length}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                          {p.marca}
                          {p.destaque && <span className="badge badge-orange">Destaque</span>}
                          {p.fotos.length === 0 && <span className="badge badge-yellow">sem foto</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="badge badge-neutral">{CATS_LOJA.find(c => c.id === p.categoria)?.nome || p.categoria}</span>
                    {p.sub && <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>{p.sub}</span>}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {p.preco == null
                      ? <span style={{ color: 'var(--text-tertiary)' }}>Sob consulta</span>
                      : <>
                          {p.precoAntigo != null && <span className="text-xs line-through mr-1" style={{ color: 'var(--text-tertiary)' }}>{fmtBRL(p.precoAntigo)}</span>}
                          {fmtBRL(p.preco)}
                        </>}
                  </td>
                  <td className="p-3 text-center">
                    <button className={`badge ${p.ativo ? 'badge-green' : 'badge-neutral'}`} style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => alternarAtivo(p)} title={p.ativo ? 'Clique para ocultar do site' : 'Clique para publicar no site'}>
                      {p.ativo ? <><Eye size={11} /> No ar</> : <><EyeOff size={11} /> Oculto</>}
                    </button>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button className="btn-icon" onClick={() => abrir(p)}><Edit2 size={14} /></button>
                    <button className="btn-icon" onClick={() => remover(p)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!carregando && filtrados.length === 0 && (
                <tr><td colSpan="5" className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhum produto na loja ainda — clique em “Novo produto”.</td></tr>
              )}
              {carregando && (
                <tr><td colSpan="5" className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>Carregando catálogo...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar produto da loja' : 'Novo produto da loja'} maxWidth="640px">
        <div className="grid grid-cols-12 gap-3">
          <Field label="Nome do produto" span={12}>
            <input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aquecedor a gás Rinnai 15 litros" />
          </Field>
          <Field label="Marca" span={6}>
            <input className="input" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Rinnai, Komeco..." />
          </Field>
          <Field label="Categoria" span={6}>
            <select className="input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value, sub: '' })}>
              {CATS_LOJA.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          {catAtual?.sub.length > 0 && (
            <Field label="Sub-categoria (filtro da barra lateral do site)" span={6}>
              <select className="input" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })}>
                <option value="">— Selecione —</option>
                {catAtual.sub.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <Field label="Preço (R$) — vazio = “Sob consulta”" span={catAtual?.sub.length ? 3 : 6}>
            <input type="number" className="input" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} placeholder="1990" />
          </Field>
          <Field label="Preço antigo (promoção)" span={catAtual?.sub.length ? 3 : 6}>
            <input type="number" className="input" value={form.precoAntigo} onChange={e => setForm({ ...form, precoAntigo: e.target.value })} placeholder="vazio = sem" />
          </Field>
          <Field label="Descrição (aparece nos detalhes do produto)" span={12}>
            <textarea className="input" rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          </Field>
          <Field label="Características — uma por linha" span={12}>
            <textarea className="input font-mono" rows={4} value={form.specsTexto} onChange={e => setForm({ ...form, specsTexto: e.target.value })} placeholder={'Vazão: 15 L/min\nGás: GN ou GLP\nGarantia de 5 anos'} />
          </Field>
          <Field label={`Fotos do produto — até ${db.MAX_FOTOS_LOJA} (${form.fotos.length} enviada${form.fotos.length === 1 ? '' : 's'})`} span={12}>
            <div className="flex flex-wrap gap-3 items-start">
              {form.fotos.map((f, i) => (
                <div key={f} style={{ position: 'relative', width: 92 }}>
                  <img src={f} alt={`Foto ${i + 1}`} style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: `2px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`, display: 'block' }} />
                  {i === 0 && (
                    <span className="badge badge-orange" style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, padding: '1px 6px' }}>Capa</span>
                  )}
                  <button title="Remover esta foto"
                    style={{ position: 'absolute', top: -7, right: -7, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 999, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    onClick={() => setForm(fm => ({ ...fm, fotos: fm.fotos.filter((_, j) => j !== i) }))}>
                    <X size={12} />
                  </button>
                  <div className="flex justify-center gap-1 mt-1">
                    <button className="btn-icon" style={{ padding: 3 }} disabled={i === 0} title="Mover para a esquerda"
                      onClick={() => moverFoto(i, -1)}><ChevronLeft size={13} /></button>
                    <button className="btn-icon" style={{ padding: 3 }} disabled={i === form.fotos.length - 1} title="Mover para a direita"
                      onClick={() => moverFoto(i, 1)}><ChevronRight size={13} /></button>
                  </div>
                </div>
              ))}
              {form.fotos.length < db.MAX_FOTOS_LOJA && (
                <label className="btn-ghost" style={{ cursor: subindoFoto ? 'wait' : 'pointer', height: 92, width: 92, flexDirection: 'column', gap: 4, fontSize: 12, textAlign: 'center' }}>
                  {subindoFoto ? <Upload size={16} /> : <Plus size={16} />}
                  {subindoFoto ? 'Enviando...' : 'Adicionar'}
                  <input type="file" accept="image/*" multiple hidden onChange={anexarFotos} disabled={subindoFoto} />
                </label>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              A primeira foto (Capa) é a que aparece na lista da loja; as demais viram o carrossel na página do produto.
              Use as setas para trocar a ordem.
            </p>
          </Field>
          <Field label="" span={6}>
            <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={form.destaque} onChange={e => setForm({ ...form, destaque: e.target.checked })} />
              Selo “Destaque” (aparece primeiro no site)
            </label>
          </Field>
          <Field label="" span={6}>
            <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
              Visível no site
            </label>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando || subindoFoto}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </Modal>
    </div>
  );
};

const Configuracoes = () => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const importRef = useRef(null);
  const [cfg, setCfg] = useState(data.config);
  const [testando, setTestando] = useState(false);

  // Sincroniza form local com data quando muda
  useEffect(() => { setCfg(data.config); }, [data.config]);

  const salvarConfig = async () => {
    await db.salvarConfig(cfg);
    await recarregar();
    toast('Configurações salvas', 'success');
  };

  const testarZapi = async () => {
    setTestando(true);
    const res = await enviarWhatsAppGrupo(cfg, '🧪 Teste de integração — sistema Servigás');
    setTestando(false);
    toast(res.ok ? (res.data?.simulado ? '✓ [Simulado] Mensagem montada com sucesso' : '✓ Mensagem enviada') : `✗ ${res.error}`, res.ok ? 'success' : 'error');
  };

  /* ------- Backup completo ------- */
  const exportarBackup = () => {
    const payload = { versao: 2, exportadoEm: new Date().toISOString(), dados: data };
    downloadBlob(JSON.stringify(payload, null, 2), `backup-servigas-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importarBackup = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    toast('Restauração de backup agora é feita pelo painel do Supabase (Database → Backups)', 'info');
    e.target.value = '';
  };

  /* ------- Exportar relatórios (xlsx) ------- */
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
    if (tipo === 'completo') {
      ['produtos', 'clientes', 'vendas', 'servicos', 'orcamentos', 'notas', 'movimentacoes'].forEach(t => {
        const ws = XLSX.utils.json_to_sheet(data[t] || []);
        XLSX.utils.book_append_sheet(wb, ws, t);
      });
    }
    XLSX.writeFile(wb, `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-3xl font-semibold mb-1">Configurações</h1></div>

      {/* === INTEGRAÇÃO: WhatsApp via Z-API === */}
      <div className="card p-5">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><MessageCircle size={16} style={{ color: '#25D366' }} /> Integração WhatsApp (Z-API)</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Para envio automático de OS para o grupo dos técnicos. Crie uma instância em z-api.io, conecte via QR code, e copie URL/Token abaixo.
          ID do grupo é obtido lendo as mensagens do grupo via API (endpoint <span className="font-mono">/chats</span>).
        </p>
        <div className="grid grid-cols-12 gap-3">
          <Field label="URL da instância Z-API" span={12}>
            <input className="input font-mono" placeholder="https://api.z-api.io/instances/XXXX/token/YYYY" value={cfg.zapi_url} onChange={e => setCfg({ ...cfg, zapi_url: e.target.value })} />
          </Field>
          <Field label="Client-Token" span={6}>
            <input className="input font-mono" type="password" value={cfg.zapi_token} onChange={e => setCfg({ ...cfg, zapi_token: e.target.value })} />
          </Field>
          <Field label="ID do grupo dos técnicos" span={6}>
            <input className="input font-mono" placeholder="120363xxxxxxxxxxx@g.us" value={cfg.whatsapp_grupo_id} onChange={e => setCfg({ ...cfg, whatsapp_grupo_id: e.target.value })} />
          </Field>
          <Field label="" span={12}>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cfg.auto_enviar_whatsapp} onChange={e => setCfg({ ...cfg, auto_enviar_whatsapp: e.target.checked })} />
              Enviar OS automaticamente para o grupo ao criar
            </label>
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={salvarConfig}>Salvar</button>
          <button className="btn-ghost" onClick={testarZapi} disabled={testando}>
            {testando ? 'Testando...' : 'Testar conexão'}
          </button>
        </div>
      </div>

      {/* === INTEGRAÇÃO: NFe via Plugnotas === */}
      <div className="card p-5">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><Receipt size={16} style={{ color: 'var(--accent)' }} /> Integração Nota Fiscal (Plugnotas)</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Para emitir NFSe a partir dos orçamentos. Você precisa de:
          (1) certificado digital A1 cadastrado na Plugnotas,
          (2) inscrição municipal ativa do emitente,
          (3) chave de API gerada no painel da Plugnotas.
        </p>
        <div className="grid grid-cols-12 gap-3">
          <Field label="API Token Plugnotas" span={12}>
            <input className="input font-mono" type="password" value={cfg.plugnotas_token} onChange={e => setCfg({ ...cfg, plugnotas_token: e.target.value })} />
          </Field>
          <Field label="Razão social" span={6}>
            <input className="input" value={cfg.emitente_razao} onChange={e => setCfg({ ...cfg, emitente_razao: e.target.value })} />
          </Field>
          <Field label="CNPJ do emitente" span={3}>
            <input className="input font-mono" value={cfg.emitente_cnpj} onChange={e => setCfg({ ...cfg, emitente_cnpj: e.target.value })} />
          </Field>
          <Field label="Inscrição municipal" span={3}>
            <input className="input font-mono" value={cfg.emitente_inscricao} onChange={e => setCfg({ ...cfg, emitente_inscricao: e.target.value })} />
          </Field>
          <Field label="" span={12}>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cfg.auto_gerar_nf} onChange={e => setCfg({ ...cfg, auto_gerar_nf: e.target.checked })} />
              Gerar NF automaticamente ao aprovar orçamento
            </label>
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={salvarConfig}>Salvar</button>
        </div>
      </div>

      {/* === BACKUP === */}
      <div className="card p-5">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><Download size={16} style={{ color: 'var(--accent)' }} /> Backup dos dados</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Exporte um arquivo JSON com todos os dados. Recomendado fazer semanalmente.</p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={exportarBackup}><Download size={14} /> Exportar backup</button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importarBackup} />
          <button className="btn-ghost" onClick={() => importRef.current?.click()}><Upload size={14} /> Importar backup</button>
        </div>
      </div>

      {/* === RELATÓRIOS === */}
      <div className="card p-5">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><FileDown size={16} style={{ color: 'var(--accent)' }} /> Relatórios Excel</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Gera planilhas .xlsx com os dados atuais.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button className="btn-ghost" onClick={() => exportarExcel('estoque')}><Package size={14} /> Estoque</button>
          <button className="btn-ghost" onClick={() => exportarExcel('servicos')}><Wrench size={14} /> Serviços</button>
          <button className="btn-ghost" onClick={() => exportarExcel('mov')}><ArrowDownUp size={14} /> Movimentações</button>
          <button className="btn-ghost" onClick={() => exportarExcel('completo')}><FileDown size={14} /> Tudo</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold mb-1">Sobre</h3>
        <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>Servigás v0.3 · protótipo client-side<br />Modo: {IS_PROTOTIPO ? 'PROTÓTIPO (mocks)' : 'PRODUÇÃO'}</p>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
                          APP RAIZ
   ════════════════════════════════════════════════════════════════ */
const Shell = () => {
  const [theme, setTheme] = useState('light');
  const [page, setPage] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await store.get('servigas-theme', 'light');
      setTheme(t);
      // Verifica sessão ativa no Supabase
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setBootChecked(true);
    })();
    // Listener: reage a login/logout e renova token automaticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user || null)
    );
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { if (bootChecked) store.set('servigas-theme', theme); }, [theme, bootChecked]);
  useEffect(() => { setSearch(''); }, [page]);

  const sair = async () => { await supabase.auth.signOut(); setUser(null); };

  if (!bootChecked) return null;
  if (!user) return <Login onLogin={setUser} />;

  const nav = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    { id: 'loja', label: 'Loja', icon: Store },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'servicos', label: 'Serviços', icon: Wrench },
    { id: 'orcamentos', label: 'Orçamentos', icon: Receipt },
    { id: 'notas', label: 'Notas', icon: FileText },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'config', label: 'Config', icon: Settings }
  ];

  const placeholders = {
    dashboard: '', vendas: 'Buscar venda ou cliente...', loja: 'Buscar produto da loja...', estoque: 'Buscar produto, SKU ou motivo...', servicos: 'Buscar cliente ou endereço...',
    orcamentos: 'Buscar cliente ou local...', notas: 'Buscar número ou fornecedor...',
    clientes: 'Buscar nome ou telefone...', config: ''
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'vendas': return <Vendas search={search} />;
      case 'loja': return <Loja search={search} />;
      case 'estoque': return <Estoque search={search} />;
      case 'servicos': return <Servicos search={search} />;
      case 'orcamentos': return <Orcamentos search={search} />;
      case 'notas': return <Notas search={search} />;
      case 'clientes': return <Clientes search={search} />;
      case 'config': return <Configuracoes />;
      default: return null;
    }
  };

  return (
    <>
      <GlobalStyles />
      <div className={`app-root theme-${theme}`}>
        <header className="sticky top-0 z-30" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Logo />
            <nav className="hidden md:flex items-center gap-1 ml-4 flex-1 overflow-x-auto">
              {nav.map(n => {
                const Icon = n.icon;
                return <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}><Icon size={15} />{n.label}</button>;
              })}
            </nav>
            <div className="flex items-center gap-2 ml-auto">
              {placeholders[page] && (
                <div className="relative hidden sm:block">
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input className="input" style={{ paddingLeft: 32, width: 260 }} placeholder={placeholders[page]} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              )}
              <button className="btn-icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
              <button className="btn-icon" onClick={sair} title="Sair"><LogOut size={18} /></button>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
            {nav.map(n => { const Icon = n.icon; return <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}><Icon size={14} />{n.label}</button>; })}
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{renderPage()}</main>
        <footer className="max-w-7xl mx-auto px-4 py-6 text-xs flex items-center justify-between" style={{ color: 'var(--text-tertiary)' }}>
          <span className="font-mono">Servigás v0.2</span>
          <span>Logado como {user.email}</span>
        </footer>
      </div>
    </>
  );
};

const App = () => <ToastProvider><DataProvider><Shell /></DataProvider></ToastProvider>;

export default App;
