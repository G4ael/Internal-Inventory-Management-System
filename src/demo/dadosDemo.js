// Dados FICTÍCIOS da demonstração (nomes, telefones e valores inventados).
// As datas são calculadas a partir de hoje para o painel sempre ter movimento.

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const momento = (n, h = 14) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 12, 0, 0); return d.toISOString(); };
const id = (p, i) => `${p}0000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

export const criarDadosDemo = () => {
  const nomes = ['Marina Duarte', 'João Pedro Alves', 'Condomínio Mar Azul', 'Fernanda Rocha', 'Ricardo Menezes', 'Padaria Sol Nascente', 'Luiza Martins', 'Carlos Eduardo Lima', 'Pousada Enseada', 'Beatriz Nogueira'];
  const ruas = ['Rua das Palmeiras, 100', 'Rua XV de Novembro, 123', 'Av. Atlântica, 1460', 'Rua Sete de Setembro, 169', 'Rua Brasil, 192', 'Rua Blumenau, 215', 'Rua Itajaí, 238', 'Rua Hercílio Luz, 261', 'Av. Nereu Ramos, 3120', 'Rua 300, 845'];
  const cidades = ['Itapema/SC', 'Balneário Camboriú/SC', 'Porto Belo/SC', 'Itajaí/SC'];
  const clientes = nomes.map((nome, i) => ({
    id: id('c', i), nome, telefone: `47 9${9100 + i * 37}-${1000 + i * 111}`,
    endereco: `${ruas[i]} — ${cidades[i % 4]}`, documento: i % 3 === 1 ? `${100 + i}.456.789-0${i}` : i === 2 ? '12.345.678/0001-90' : null,
    observacoes: i === 0 ? 'Prefere atendimento pela manhã.' : i === 2 ? 'Falar com o zelador (bloco B).' : null,
    deletado_em: null, criado_em: momento(-(i * 9) - 3)
  }));

  const produtos = [
    ['Aquecedor Rinnai REU-E15', 'RN-E15', 4, 2, 1890], ['Aquecedor Rinnai REU-E21', 'RN-E21', 3, 2, 2690], ['Aquecedor Komeco KO 22D', 'KO-22D', 1, 2, 2490],
    ['Regulador de pressão', 'REG-001', 12, 5, 85], ['Mangueira de gás inox 1,2 m', 'MNG-12', 9, 4, 65], ['Registro esfera 1/2"', 'REG-12', 20, 6, 55],
    ['Duto de alumínio Ø60 1,5 m', 'DUT-60', 2, 3, 119], ['Terminal de exaustão inox', 'TER-60', 5, 2, 149]
  ].map(([nome, sku, quantidade, estoque_minimo, preco], i) => ({ id: id('p', i), nome, sku, quantidade, estoque_minimo, preco, deletado_em: null }));

  const tabela_precos = [
    ['Rinnai 15L instalado', 'Rinnai', 2400, 'Aparelho + instalação básica'], ['Rinnai 21L instalado', 'Rinnai', 3290, 'Aparelho + instalação básica'],
    ['Komeco 22D instalado', 'Komeco', 3100, 'Aparelho + instalação básica'], ['Instalação avulsa', 'Serviço', 350, 'Cliente fornece o aparelho'],
    ['Manutenção preventiva', 'Serviço', 180, 'Limpeza, pressão e troca de juntas'], ['Desinstalação', 'Serviço', 120, null],
    ['Kit exaustão 1,5 m', 'Kit', 260, 'Duto + terminal + canopla'], ['Bomba pressurizadora instalada', 'Pressurizador', 1490, null]
  ].map(([nome, categoria, preco, descricao], i) => ({ id: id('t', i), nome, categoria, descricao, preco, ativo: true }));

  const tipos = ['instalacao', 'manutencao', 'instalacao', 'instalacao', 'manutencao', 'desinstalacao', 'instalacao', 'manutencao', 'instalacao', 'manutencao', 'instalacao', 'manutencao', 'instalacao', 'instalacao'];
  const deslocamentos = [-82, -64, -47, -35, -27, -20, -13, -9, -6, -2, 0, 0, 2, 5];
  const tecnicos = ['Anderson', 'Bruno Silva', 'Anderson', 'Diego'];
  const ordens_servico = deslocamentos.map((o, i) => {
    const c = clientes[i % clientes.length];
    return {
      id: id('s', i), cliente_id: c.id, cliente_nome: c.nome, cliente_telefone: c.telefone, cliente_endereco: c.endereco,
      tipo: tipos[i], status: o < 0 ? (i === 3 ? 'cancelado' : 'concluido') : o === 0 && i === 10 ? 'em_andamento' : 'pendente',
      tecnico: i === 13 ? null : tecnicos[i % 4], data_servico: dia(o), hora_servico: ['08:30:00', '10:00:00', '14:00:00', '16:30:00'][i % 4],
      notas: i === 12 ? 'Levar escada grande' : null, observacoes: null, criado_em: momento(o - 3)
    };
  });
  const os_itens = [0, 2, 6, 12].map((s, k) => ({
    id: id('i', k), os_id: ordens_servico[s].id, produto_id: produtos[k % 2].id, nome_snapshot: produtos[k % 2].nome, quantidade: 1
  }));

  const desc = '• Rinnai 21L instalado — R$ 3.290,00\n• Kit exaustão 1,5 m — R$ 260,00\n• Registro esfera 1/2" — R$ 55,00';
  const orcamentos = [
    [-75, 'aprovado', 3605, 15], [-58, 'recusado', 2400, 15], [-41, 'aprovado', 5230, 15], [-30, 'aprovado', 1490, 10], [-24, 'aberto', 2490, 10],
    [-15, 'aprovado', 3100, 15], [-9, 'aberto', 1860, 30], [-4, 'aberto', 4120, 15], [-1, 'aberto', 530, 15]
  ].map(([o, status, valor_total, val], i) => {
    const c = clientes[(i + 2) % clientes.length];
    return {
      id: id('o', i), cliente_id: c.id, cliente_nome: c.nome, cliente_documento: c.documento, cliente_endereco: c.endereco,
      local: c.endereco, descricao: i % 2 ? '• Instalação avulsa — R$ 350,00\n• Manutenção preventiva — R$ 180,00' : desc, valor_total,
      validade: dia(o + val), data_orcamento: dia(o), status, nf_numero: i === 0 ? '10452' : null, criado_em: momento(o)
    };
  });

  const formas = ['pix', 'dinheiro', 'credito', 'pix', 'debito', 'pix', 'credito'];
  const vendas = [[-52, 1890], [-33, 450], [-21, 2490], [-12, 180], [-7, 3100], [-3, 260], [-1, 610]].map(([o, total], i) => ({
    id: id('v', i), numero: 1001 + i, cliente_id: clientes[i].id, cliente_nome: clientes[i].nome, cliente_documento: clientes[i].documento,
    cliente_endereco: clientes[i].endereco, desconto: 0, total, forma_pagamento: formas[i], tipo_nota: i % 2 ? 'sem_nota' : 'nfce',
    status: i === 3 ? 'cancelada' : 'finalizada', observacoes: null, nf_numero: i % 2 ? null : String(5000 + i), nf_chave_acesso: i % 2 ? null : '4226' + '0'.repeat(30) + (5000 + i),
    criado_em: momento(o, 10 + i)
  }));
  const vendas_itens = vendas.map((v, i) => ({ id: id('w', i), venda_id: v.id, origem: 'tabela', ref_id: tabela_precos[3].id, nome: 'Itens diversos', quantidade: 1, preco_unitario: v.total }));

  const notas_fiscais = [
    { id: id('n', 0), numero: '88213', fornecedor: 'Distribuidora Litoral', valor: 8450, data_emissao: dia(-30), observacoes: 'Compra de aquecedores', pdf_path: null },
    { id: id('n', 1), numero: '5000', fornecedor: 'Marina Duarte', valor: 1890, data_emissao: dia(-52), observacoes: 'NFCE de venda #1001 (SIMULADA)', pdf_path: null },
    { id: id('n', 2), numero: '10452', fornecedor: 'Condomínio Mar Azul', valor: 3605, data_emissao: dia(-70), observacoes: 'Gerada do orçamento (SIMULADA)', pdf_path: null }
  ];
  const movimentacoes = [[0, 'entrada', 4, 'Compra do fornecedor', -30], [1, 'saida', 1, 'OS — uso de item', -13], [3, 'entrada', 10, 'Reposição', -10], [4, 'saida', 2, 'Venda #1005', -7], [6, 'saida', 1, 'Ajuste manual', -2]]
    .map(([p, tipo, quantidade, motivo, o], i) => ({ id: id('m', i), produto_id: produtos[p].id, tipo, quantidade, motivo, criado_em: momento(o) }));

  const loja_produtos = [
    ['Aquecedor a gás Rinnai REU-E15 15 litros', 'Rinnai', 'aquecedores', 'Rinnai', 1990, null, true, true],
    ['Aquecedor a gás Rinnai REU-E21 21 litros', 'Rinnai', 'aquecedores', 'Rinnai', 2890, null, true, true],
    ['Aquecedor a gás Komeco KO 16D 16 litros', 'Komeco', 'aquecedores', 'Komeco', 1690, 1890, false, true],
    ['Bomba pressurizadora Rinnai RB 250W', 'Rinnai', 'bombas', 'Rinnai', 1290, null, false, true],
    ['Mangueira de gás flexível inox 1,20 m', 'Universal', 'mangueiras', 'Gás', 89, null, false, false],
    ['Kit de exaustão sob medida (projeto)', 'Servigás', 'dutos', '', null, null, false, true]
  ].map(([nome, marca, categoria, sub, preco, preco_antigo, destaque, ativo], i) => ({
    id: id('l', i), nome, marca, categoria, sub, preco, preco_antigo, destaque, ativo,
    descricao: 'Produto de demonstração.', specs: ['Garantia de fábrica'], fotos: []
  }));

  // Integrações preenchidas para os botões de WhatsApp e nota fiscal funcionarem (em modo simulado)
  const configuracoes = [{
    id: 1, zapi_url: 'https://api.z-api.io/instances/DEMO/token/DEMO', zapi_token: 'demo', whatsapp_grupo_id: '120363000000000000@g.us',
    auto_enviar_whatsapp: false, plugnotas_url: 'https://api.plugnotas.com.br', plugnotas_token: 'demo', auto_gerar_nf: false,
    emitente_razao: 'Servigás Aquecedores (demonstração)', emitente_cnpj: '00.000.000/0001-00', emitente_inscricao: '000000'
  }];

  return { clientes, produtos, tabela_precos, ordens_servico, os_itens, orcamentos, vendas, vendas_itens, notas_fiscais, movimentacoes, loja_produtos, configuracoes };
};
