// ============================================================================
// format.js — formatação e pequenos utilitários usados em todo o sistema
// ============================================================================

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Versão curta para números grandes: R$ 12,4 mil · R$ 1,2 mi
export const fmtBRLCurto = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (Math.abs(v) >= 1e4) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return fmtBRL(v);
};

export const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

// Datas do banco: "2026-09-25" (dia) ou timestamp completo
export const fmtDate = (d) => d ? new Date(d + (d.length === 10 ? 'T00:00' : '')).toLocaleDateString('pt-BR') : '—';
export const fmtDataHora = (d) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Data local no formato AAAA-MM-DD. (toISOString() usa UTC: depois das
// 21h no Brasil ele já devolve o dia seguinte — por isso esta função.)
export const isoLocal = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const hojeISO = () => isoLocal();
export const paraData = (iso) => new Date(iso + 'T00:00');
export const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return isoLocal(d); };
export const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
// Dia (local) de um timestamp do banco, ex.: criado_em das vendas
export const diaDe = (ts) => ts ? (ts.length === 10 ? ts : isoLocal(new Date(ts))) : '';

export const fmtDiaCurto = (iso) => paraData(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
export const fmtDiaLongo = (iso) => paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

// Busca sem acento e sem diferenciar maiúsculas
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const contem = (texto, busca) => !busca || normalizar(texto).includes(normalizar(busca));

export const iniciais = (nome) => {
  const partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return ((partes[0][0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// Link do WhatsApp para um telefone brasileiro (acrescenta o 55 quando falta)
export const linkWhats = (telefone, texto) => {
  const d = String(telefone || '').replace(/\D/g, '');
  const msg = texto ? `?text=${encodeURIComponent(texto)}` : '';
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}${msg}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `https://wa.me/${d}${msg}`;
  return null;
};
export const linkTelefone = (telefone) => {
  const d = String(telefone || '').replace(/\D/g, '');
  return d.length >= 8 ? `tel:${d}` : null;
};
export const linkMapa = (endereco) => endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : null;

// Escapa texto antes de montar HTML (impressões de cartões e DANFE)
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const downloadBlob = (data, filename, mime = 'application/json') => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export const copiarTexto = async (texto) => {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Navegadores/contextos sem Clipboard API
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
};

// Preferências simples do navegador (tema, menu recolhido, período do painel)
export const pref = {
  ler(chave, padrao) { try { const v = localStorage.getItem(chave); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo privado: ignora */ } }
};
