// ============================================================================
// dominio.js — nomes, estados e textos do negócio (usados por várias telas)
// ============================================================================
import { fmtBRL, fmtDate, hojeISO } from './format';

// Ordens de serviço
export const STATUS_OS = {
  pendente: { label: 'Pendente', tom: 'aviso' },
  em_andamento: { label: 'Em andamento', tom: 'info' },
  concluido: { label: 'Concluído', tom: 'ok' },
  cancelado: { label: 'Cancelado', tom: 'neutro' }
};
export const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS_OS).map(([k, v]) => [k, v.label]));
export const TIPOS_OS = ['Instalação', 'Manutenção', 'Desinstalação'];

// Orçamentos. "Vencido" é calculado: aberto + validade já passou.
export const STATUS_ORC = {
  aberto: { label: 'Aberto', tom: 'info', cor: 'var(--info)' },
  vencido: { label: 'Vencido', tom: 'erro', cor: 'var(--erro)' },
  aprovado: { label: 'Aprovado', tom: 'ok', cor: 'var(--ok)' },
  recusado: { label: 'Recusado', tom: 'neutro', cor: 'var(--linha-forte)' }
};
export const statusOrc = (o, hoje = hojeISO()) => {
  const s = o.status || 'aberto';
  if (s === 'aberto' && o.validade && o.validade < hoje) return 'vencido';
  return s;
};

export const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Boleto', 'A combinar'];
// O banco guarda 'pix', 'debito'…; na tela aparece 'PIX', 'Débito'…
const ROTULO_PAGAMENTO = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto', a_combinar: 'A combinar' };
export const rotuloPagamento = (f) => ROTULO_PAGAMENTO[f] || f || '—';

// Mensagem padrão da OS para o WhatsApp
export const montarMensagemOS = (s) => {
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

// Orçamento formatado (para WhatsApp, email, etc)
export const montarTextoOrcamento = (orc, emitenteRazao) => {
  const emitente = emitenteRazao || 'Assistência Técnica';
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

// Catálogo do site público
export const URL_LOJA = 'https://servigas-loja.vercel.app';
export const CATS_LOJA = [
  { id: 'aquecedores', nome: 'Aquecedores a gás', sub: ['Rheem', 'Rinnai', 'Komeco', 'Lorenzetti'] },
  { id: 'bombas', nome: 'Bombas pressurizadoras', sub: ['Komeco', 'Rinnai'] },
  { id: 'mangueiras', nome: 'Mangueiras', sub: ['Gás', 'Água'] },
  { id: 'registros', nome: 'Registros de gás', sub: [] },
  { id: 'acabamentos', nome: 'Acabamentos', sub: [] },
  { id: 'dutos', nome: 'Duto de exaustão', sub: [] },
];

// Cliente de um registro: pelo vínculo (clienteId) ou, sem vínculo, pelo nome
export const doCliente = (c, normalizar) => (r) =>
  r.clienteId ? r.clienteId === c.id : normalizar(r.cliente) === normalizar(c.nome);
