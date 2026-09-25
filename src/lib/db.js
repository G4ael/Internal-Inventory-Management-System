// ============================================================================
// db.js — Camada de acesso a dados (Repository)
// ============================================================================
// Esta camada é a PONTE entre a UI (que fala o "dialeto do protótipo":
// p.qtd, s.cliente, etc) e o banco Supabase (que usa nomes de colunas como
// quantidade, cliente_nome, etc).
//
// Por que existe? Para não reescrever 2000 linhas de UI. A UI continua
// usando o mesmo formato de antes; aqui a gente traduz na entrada e na saída.
//
// Cada função "fromDB" converte uma linha do banco → formato da UI.
// Cada função "toDB" converte formato da UI → linha do banco.
// ============================================================================

import { supabase } from './supabase';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ───────────────────────── TRADUTORES ───────────────────────── */
// Produtos
const produtoFromDB = (r) => ({ id: r.id, nome: r.nome, sku: r.sku, qtd: r.quantidade, minimo: r.estoque_minimo, preco: Number(r.preco) });
const produtoToDB = (p) => ({ nome: p.nome, sku: p.sku || null, quantidade: p.qtd, estoque_minimo: p.minimo, preco: p.preco });

// Clientes
const clienteFromDB = (r) => ({ id: r.id, nome: r.nome, telefone: r.telefone, endereco: r.endereco, documento: r.documento, obs: r.observacoes, criadoEm: r.criado_em });
const clienteToDB = (c) => ({ nome: c.nome, telefone: c.telefone || null, endereco: c.endereco || null, documento: c.documento || null, observacoes: c.obs || null });

// Tabela de preços
const tabelaFromDB = (r) => ({ id: r.id, nome: r.nome, categoria: r.categoria, descricao: r.descricao, preco: Number(r.preco) });
const tabelaToDB = (t) => ({ nome: t.nome, categoria: t.categoria || null, descricao: t.descricao || null, preco: t.preco });

// Serviços / OS (com itens aninhados)
const osFromDB = (r) => ({
  id: r.id, clienteId: r.cliente_id, cliente: r.cliente_nome, telefone: r.cliente_telefone,
  endereco: r.cliente_endereco, tipo: cap(r.tipo), status: r.status, tecnico: r.tecnico || '',
  data: r.data_servico, hora: (r.hora_servico || '09:00').slice(0, 5),
  equipamentos: r.notas, obs: r.observacoes,
  itens: (r.os_itens || []).map(i => ({ produtoId: i.produto_id, nome: i.nome_snapshot || '', qtd: i.quantidade }))
});
// tipo no banco é enum minúsculo (instalacao); na UI é "Instalação"
const cap = (t) => ({ instalacao: 'Instalação', manutencao: 'Manutenção', desinstalacao: 'Desinstalação' }[t] || t);
const uncap = (t) => ({ 'Instalação': 'instalacao', 'Manutenção': 'manutencao', 'Desinstalação': 'desinstalacao' }[t] || t);

// Orçamentos
const orcFromDB = (r) => ({ id: r.id, cliente: r.cliente_nome, clienteId: r.cliente_id, clienteDocumento: r.cliente_documento, clienteEndereco: r.cliente_endereco, local: r.local, itens: r.descricao, total: Number(r.valor_total), validade: r.validade, data: r.data_orcamento, status: r.status, nfNumero: r.nf_numero });
const orcToDB = (o) => ({ cliente_id: o.clienteId || null, cliente_nome: o.cliente, cliente_documento: o.clienteDocumento || null, cliente_endereco: o.clienteEndereco || null, local: o.local || null, descricao: o.itens || null, valor_total: o.total, validade: o.validade || null, data_orcamento: o.data, status: o.status || 'aberto', nf_numero: o.nfNumero || null });

// Notas
const notaFromDB = (r) => ({ id: r.id, numero: r.numero, fornecedor: r.fornecedor, valor: Number(r.valor), data: r.data_emissao, obs: r.observacoes, pdfRef: r.pdf_path });
const notaToDB = (n) => ({ numero: n.numero, fornecedor: n.fornecedor, valor: n.valor, data_emissao: n.data, observacoes: n.obs || null, pdf_path: n.pdfRef || null });

// Movimentações
const movFromDB = (r) => ({ id: r.id, produtoId: r.produto_id, tipo: r.tipo, qtd: r.quantidade, motivo: r.motivo, data: r.criado_em });

// Vendas (com itens aninhados)
const vendaFromDB = (r) => ({
  id: r.id, numero: r.numero, cliente: r.cliente_nome, clienteId: r.cliente_id,
  clienteDocumento: r.cliente_documento, clienteEndereco: r.cliente_endereco,
  desconto: Number(r.desconto), total: Number(r.total), forma_pagamento: r.forma_pagamento,
  tipo_nota: r.tipo_nota, status: r.status, observacoes: r.observacoes,
  nfNumero: r.nf_numero, nfChave: r.nf_chave_acesso, tipo_nota_emitida: r.tipo_nota,
  data: r.criado_em,
  itens: (r.vendas_itens || []).map(i => ({ origem: i.origem, refId: i.ref_id, nome: i.nome, qtd: i.quantidade, preco: Number(i.preco_unitario) }))
});

// Config
const configFromDB = (r) => ({
  zapi_url: r.zapi_url || '', zapi_token: r.zapi_token || '', whatsapp_grupo_id: r.whatsapp_grupo_id || '',
  auto_enviar_whatsapp: r.auto_enviar_whatsapp || false,
  plugnotas_url: r.plugnotas_url || 'https://api.plugnotas.com.br', plugnotas_token: r.plugnotas_token || '',
  auto_gerar_nf: r.auto_gerar_nf || false,
  emitente_razao: r.emitente_razao || '', emitente_cnpj: r.emitente_cnpj || '', emitente_inscricao: r.emitente_inscricao || ''
});

/* ───────────────────────── CARGA INICIAL ───────────────────────── */
// Busca tudo do banco em paralelo e devolve no formato que a UI espera.
export const carregarTudo = async () => {
  const [prod, cli, tab, os, orc, notas, mov, vendas, config] = await Promise.all([
    supabase.from('produtos').select('*').is('deletado_em', null).order('nome'),
    supabase.from('clientes').select('*').is('deletado_em', null).order('nome'),
    supabase.from('tabela_precos').select('*').eq('ativo', true).order('categoria'),
    supabase.from('ordens_servico').select('*, os_itens(*)').order('data_servico'),
    supabase.from('orcamentos').select('*').order('data_orcamento', { ascending: false }),
    supabase.from('notas_fiscais').select('*').order('data_emissao', { ascending: false }),
    supabase.from('movimentacoes').select('*').order('criado_em', { ascending: false }).limit(200),
    supabase.from('vendas').select('*, vendas_itens(*)').order('criado_em', { ascending: false }),
    supabase.from('configuracoes').select('*').eq('id', 1).single()
  ]);

  // Loga erros se houver (ajuda no debug)
  [prod, cli, tab, os, orc, notas, mov, vendas].forEach(r => { if (r.error) console.error('Erro ao carregar:', r.error); });

  return {
    produtos: (prod.data || []).map(produtoFromDB),
    clientes: (cli.data || []).map(clienteFromDB),
    tabelaPrecos: (tab.data || []).map(tabelaFromDB),
    servicos: (os.data || []).map(osFromDB),
    orcamentos: (orc.data || []).map(orcFromDB),
    notas: (notas.data || []).map(notaFromDB),
    movimentacoes: (mov.data || []).map(movFromDB),
    vendas: (vendas.data || []).map(vendaFromDB),
    config: config.data ? configFromDB(config.data) : {},
    contadores: { venda: 1000 }
  };
};

/* ───────────────────────── PRODUTOS ───────────────────────── */
export const salvarProduto = async (p) => {
  if (p.id && !p.id.includes('-') === false && p.id.length > 20) {
    // tem UUID do banco → update
    return supabase.from('produtos').update(produtoToDB(p)).eq('id', p.id);
  }
  return supabase.from('produtos').insert(produtoToDB(p));
};
export const atualizarProduto = (id, p) => supabase.from('produtos').update(produtoToDB(p)).eq('id', id);
export const inserirProduto = (p) => supabase.from('produtos').insert(produtoToDB(p)).select().single();
export const removerProduto = (id) => supabase.from('produtos').update({ deletado_em: new Date().toISOString() }).eq('id', id);

/* ───────────────────────── CLIENTES ───────────────────────── */
export const inserirCliente = (c) => supabase.from('clientes').insert(clienteToDB(c)).select().single();
export const atualizarCliente = (id, c) => supabase.from('clientes').update(clienteToDB(c)).eq('id', id);
export const removerCliente = (id) => supabase.from('clientes').update({ deletado_em: new Date().toISOString() }).eq('id', id);

/* ───────────────────────── TABELA DE PREÇOS ───────────────────────── */
export const inserirTabelaPreco = (t) => supabase.from('tabela_precos').insert(tabelaToDB(t)).select().single();
export const atualizarTabelaPreco = (id, t) => supabase.from('tabela_precos').update(tabelaToDB(t)).eq('id', id);
export const removerTabelaPreco = (id) => supabase.from('tabela_precos').update({ ativo: false }).eq('id', id);

/* ───────────────────────── ORDENS DE SERVIÇO ───────────────────────── */
// Insere OS + itens. O trigger do banco move o estoque sozinho.
export const inserirOS = async (os) => {
  const { data: nova, error } = await supabase.from('ordens_servico').insert({
    cliente_id: os.clienteId || null, cliente_nome: os.cliente, cliente_telefone: os.telefone || null,
    cliente_endereco: os.endereco || null, tipo: uncap(os.tipo), status: os.status,
    tecnico: os.tecnico || null,
    data_servico: os.data, hora_servico: os.hora, notas: os.equipamentos || null, observacoes: os.obs || null
  }).select().single();
  if (error) return { error };
  if (os.itens?.length) {
    await supabase.from('os_itens').insert(os.itens.map(it => ({
      os_id: nova.id, produto_id: it.produtoId, quantidade: it.qtd
    })));
  }
  return { data: nova };
};

export const atualizarOS = async (os) => {
  await supabase.from('ordens_servico').update({
    cliente_id: os.clienteId || null, cliente_nome: os.cliente, cliente_telefone: os.telefone || null,
    cliente_endereco: os.endereco || null, tipo: uncap(os.tipo), status: os.status,
    tecnico: os.tecnico || null,
    data_servico: os.data, hora_servico: os.hora, notas: os.equipamentos || null, observacoes: os.obs || null
  }).eq('id', os.id);
  // Estratégia simples: remove itens antigos e reinsere (triggers ajustam estoque)
  await supabase.from('os_itens').delete().eq('os_id', os.id);
  if (os.itens?.length) {
    await supabase.from('os_itens').insert(os.itens.map(it => ({ os_id: os.id, produto_id: it.produtoId, quantidade: it.qtd })));
  }
  return { ok: true };
};

// Muda só o status (não mexe nos itens, então o estoque não é tocado)
export const atualizarStatusOS = (id, status) => supabase.from('ordens_servico').update({ status }).eq('id', id);

export const removerOS = (id) => supabase.from('ordens_servico').delete().eq('id', id);

/* ───────────────────────── ORÇAMENTOS ───────────────────────── */
export const inserirOrcamento = (o) => supabase.from('orcamentos').insert(orcToDB(o)).select().single();
export const atualizarOrcamento = (id, o) => supabase.from('orcamentos').update(orcToDB(o)).eq('id', id);
export const removerOrcamento = (id) => supabase.from('orcamentos').delete().eq('id', id);

/* ───────────────────────── NOTAS ───────────────────────── */
export const inserirNota = (n) => supabase.from('notas_fiscais').insert(notaToDB(n)).select().single();
export const atualizarNota = (id, n) => supabase.from('notas_fiscais').update(notaToDB(n)).eq('id', id);
export const removerNota = (id) => supabase.from('notas_fiscais').delete().eq('id', id);

/* ───────────────────────── MOVIMENTAÇÕES ───────────────────────── */
// Movimentação manual de estoque (ajuste). Para vendas/OS, os triggers cuidam.
export const lancarMovimentacao = async (produtoId, tipo, qtd, motivo) => {
  // Ajusta o produto e registra a movimentação
  const { data: prod } = await supabase.from('produtos').select('quantidade').eq('id', produtoId).single();
  if (prod) {
    const delta = tipo === 'entrada' ? qtd : -qtd;
    await supabase.from('produtos').update({ quantidade: Math.max(0, prod.quantidade + delta) }).eq('id', produtoId);
  }
  return supabase.from('movimentacoes').insert({ produto_id: produtoId, tipo, quantidade: qtd, motivo });
};

/* ───────────────────────── VENDAS ───────────────────────── */
export const inserirVenda = async (venda) => {
  const { data: nova, error } = await supabase.from('vendas').insert({
    cliente_id: venda.clienteId || null, cliente_nome: venda.cliente,
    cliente_documento: venda.clienteDocumento || null, cliente_endereco: venda.clienteEndereco || null,
    desconto: venda.desconto, total: venda.total, forma_pagamento: mapPagamento(venda.forma_pagamento),
    tipo_nota: venda.tipo_nota, observacoes: venda.observacoes || null,
    nf_numero: venda.nfNumero || null, nf_chave_acesso: venda.nfChave || null
  }).select().single();
  if (error) return { error };
  // Insere itens (trigger move estoque dos itens de origem 'estoque')
  if (venda.itens?.length) {
    await supabase.from('vendas_itens').insert(venda.itens.map(it => ({
      venda_id: nova.id, origem: it.origem, ref_id: it.refId, nome: it.nome,
      quantidade: it.qtd, preco_unitario: it.preco
    })));
  }
  return { data: vendaFromDB({ ...nova, vendas_itens: [] }) };
};

export const cancelarVenda = (id) => supabase.from('vendas').update({ status: 'cancelada' }).eq('id', id);

// Forma de pagamento: UI usa 'Dinheiro', banco usa enum 'dinheiro'
const mapPagamento = (f) => ({ 'Dinheiro': 'dinheiro', 'PIX': 'pix', 'Débito': 'debito', 'Crédito': 'credito', 'Boleto': 'boleto', 'A combinar': 'a_combinar' }[f] || 'dinheiro');

/* ───────────────────────── CONFIG ───────────────────────── */
export const salvarConfig = (cfg) => supabase.from('configuracoes').update({
  zapi_url: cfg.zapi_url || null, zapi_token: cfg.zapi_token || null, whatsapp_grupo_id: cfg.whatsapp_grupo_id || null,
  auto_enviar_whatsapp: cfg.auto_enviar_whatsapp, plugnotas_token: cfg.plugnotas_token || null,
  auto_gerar_nf: cfg.auto_gerar_nf, emitente_razao: cfg.emitente_razao || null,
  emitente_cnpj: cfg.emitente_cnpj || null, emitente_inscricao: cfg.emitente_inscricao || null
}).eq('id', 1);

/* ───────────────────────── STORAGE (fotos/PDFs) ───────────────────────── */
export const uploadFotoOS = async (file, osId) => {
  const path = `${osId}/${uid()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('os-fotos').upload(path, file, { contentType: file.type });
  if (error) return { error };
  await supabase.from('os_fotos').insert({ os_id: osId, storage_path: path });
  return { path };
};

export const uploadPdfNota = async (file, notaId) => {
  const path = `${notaId}/${uid()}.pdf`;
  const { error } = await supabase.storage.from('notas-pdf').upload(path, file, { contentType: 'application/pdf' });
  if (error) return { error };
  return { path };
};

export const urlAssinada = async (bucket, path, segundos = 3600) => {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, segundos);
  return data?.signedUrl;
};

/* ───────────────────────── LOJA VIRTUAL ───────────────────────── */
// Catálogo do site público (https://servigas-loja.vercel.app), tabela
// `loja_produtos`. O site só LÊ produtos ativos (RLS); a escrita passa
// por aqui e exige usuário logado.
const lojaFromDB = (r) => ({
  id: r.id, nome: r.nome, marca: r.marca, categoria: r.categoria, sub: r.sub,
  preco: r.preco == null ? null : Number(r.preco),
  precoAntigo: r.preco_antigo == null ? null : Number(r.preco_antigo),
  destaque: r.destaque, ativo: r.ativo, descricao: r.descricao,
  specs: r.specs || [], fotos: r.fotos || [],
  naEscolha: !!r.na_escolha, promoPrincipal: !!r.promo_principal
});
const lojaToDB = (p) => ({
  nome: p.nome, marca: p.marca || '', categoria: p.categoria, sub: p.sub || '',
  preco: p.preco === '' || p.preco == null ? null : Number(p.preco),
  preco_antigo: p.precoAntigo === '' || p.precoAntigo == null ? null : Number(p.precoAntigo),
  destaque: !!p.destaque, ativo: p.ativo !== false, descricao: p.descricao || '',
  specs: p.specs || [], fotos: p.fotos || [],
  na_escolha: !!p.naEscolha, promo_principal: !!p.promoPrincipal
});

// Ordem fixa por categoria + nome: assim a lista não "pula" depois de salvar
// (todos os produtos foram criados no mesmo instante, então ordenar por data
// deixava a ordem imprevisível a cada consulta).
export const listarLojaProdutos = async () => {
  const { data, error } = await supabase.from('loja_produtos')
    .select('*').order('categoria').order('nome');
  return { data: (data || []).map(lojaFromDB), error };
};
// Quantos produtos estão no ar no site (mostrado no menu lateral)
export const contarLojaAtivos = async () => {
  const { count, error } = await supabase.from('loja_produtos').select('id', { count: 'exact', head: true }).eq('ativo', true);
  return error ? null : count;
};
// Só um produto pode ser o principal do "Baixou o preço": antes de marcar
// um, desmarca os outros.
export const limparPromoPrincipal = () =>
  supabase.from('loja_produtos').update({ promo_principal: false }).eq('promo_principal', true);
export const inserirLojaProduto = (p) => supabase.from('loja_produtos').insert(lojaToDB(p));
export const atualizarLojaProduto = (id, p) => supabase.from('loja_produtos').update(lojaToDB(p)).eq('id', id);

// Remove o produto e apaga as fotos dele no Storage
export const removerLojaProduto = async (p) => {
  const paths = (p.fotos || []).map(u => u.split('/loja-fotos/')[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from('loja-fotos').remove(paths);
  return supabase.from('loja_produtos').delete().eq('id', p.id);
};

export const MAX_FOTOS_LOJA = 4;   // o carrossel do site mostra no máximo 4

// Comprime a imagem no navegador (máx. 900px no maior lado, JPEG 85%)
// para o site carregar rápido, e sobe pro bucket público `loja-fotos`.
const comprimirImagem = (file, maxLado = 900) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
  };
  img.onerror = () => resolve(file);
  img.src = URL.createObjectURL(file);
});

export const uploadFotoLoja = async (file) => {
  const blob = await comprimirImagem(file);
  const path = `produtos/${uid()}.jpg`;
  const { error } = await supabase.storage.from('loja-fotos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) return { error };
  const { data } = supabase.storage.from('loja-fotos').getPublicUrl(path);
  return { url: data.publicUrl };
};

/* ─────────── Fotos de instalações (carrossel do site) ─────────── */
// Tabela `loja_instalacoes`: o site mostra as ativas, em ordem, no bloco
// "Quem vende é quem instala". As imagens ficam em loja-fotos/instalacoes/.
const instFromDB = (r) => ({ id: r.id, foto: r.foto, legenda: r.legenda || '', ordem: r.ordem ?? 0, ativo: r.ativo !== false });
export const listarInstalacoes = async () => {
  const { data, error } = await supabase.from('loja_instalacoes').select('*').order('ordem').order('criado_em');
  return { data: (data || []).map(instFromDB), error };
};
export const inserirInstalacao = (i) => supabase.from('loja_instalacoes')
  .insert({ foto: i.foto, legenda: i.legenda || '', ordem: i.ordem ?? 0, ativo: i.ativo !== false });
export const atualizarInstalacao = (id, campos) => supabase.from('loja_instalacoes').update(campos).eq('id', id);
export const removerInstalacao = async (i) => {
  const path = (i.foto || '').split('/loja-fotos/')[1];
  if (path) await supabase.storage.from('loja-fotos').remove([path]);
  return supabase.from('loja_instalacoes').delete().eq('id', i.id);
};
// Foto de instalação é maior que a de produto (ocupa o carrossel inteiro)
export const uploadFotoInstalacao = async (file) => {
  const blob = await comprimirImagem(file, 1400);
  const path = `instalacoes/${uid()}.jpg`;
  const { error } = await supabase.storage.from('loja-fotos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) return { error };
  const { data } = supabase.storage.from('loja-fotos').getPublicUrl(path);
  return { url: data.publicUrl };
};
