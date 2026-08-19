-- ============================================================================
-- LOJA VIRTUAL — catálogo do site público (https://servigas-loja.vercel.app)
-- ============================================================================
-- Como rodar: painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar mais de uma vez sem problema (é idempotente).
--
-- Segurança:
--   • Site público: SOMENTE LEITURA, e só de produtos ativos (RLS).
--   • Escrita: apenas usuários logados no sistema interno (Supabase Auth).
-- ============================================================================

-- 1) Tabela do catálogo
create table if not exists loja_produtos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  marca         text not null default '',
  categoria     text not null,               -- aquecedores | bombas | mangueiras | registros | acabamentos | dutos
  sub           text not null default '',    -- marca (aquecedores/bombas) ou tipo Gás/Água (mangueiras)
  preco         numeric,                     -- null = "Sob consulta"
  preco_antigo  numeric,                     -- preço riscado da promoção (null = sem promoção)
  destaque      boolean not null default false,
  descricao     text not null default '',
  specs         jsonb not null default '[]'::jsonb,  -- lista de características
  fotos         jsonb not null default '[]'::jsonb,  -- URLs públicas das fotos
  ativo         boolean not null default true,       -- false = some do site sem apagar
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) Atualiza "atualizado_em" automaticamente
create or replace function loja_set_atualizado_em() returns trigger as $$
begin new.atualizado_em = now(); return new; end $$ language plpgsql;

drop trigger if exists trg_loja_produtos_atualizado on loja_produtos;
create trigger trg_loja_produtos_atualizado
  before update on loja_produtos
  for each row execute function loja_set_atualizado_em();

-- 3) Regras de acesso (RLS)
alter table loja_produtos enable row level security;

drop policy if exists "loja: leitura publica de ativos" on loja_produtos;
create policy "loja: leitura publica de ativos" on loja_produtos
  for select using (ativo = true);

drop policy if exists "loja: equipe logada gerencia" on loja_produtos;
create policy "loja: equipe logada gerencia" on loja_produtos
  for all to authenticated using (true) with check (true);

-- 4) Bucket público para as fotos dos produtos
insert into storage.buckets (id, name, public)
values ('loja-fotos', 'loja-fotos', true)
on conflict (id) do nothing;

drop policy if exists "loja-fotos: upload equipe" on storage.objects;
create policy "loja-fotos: upload equipe" on storage.objects
  for insert to authenticated with check (bucket_id = 'loja-fotos');

drop policy if exists "loja-fotos: remover equipe" on storage.objects;
create policy "loja-fotos: remover equipe" on storage.objects
  for delete to authenticated using (bucket_id = 'loja-fotos');

drop policy if exists "loja-fotos: leitura publica" on storage.objects;
create policy "loja-fotos: leitura publica" on storage.objects
  for select using (bucket_id = 'loja-fotos');

-- 5) Produtos iniciais (os mesmos exemplos do site) — só entram se a tabela
--    estiver vazia, para não duplicar se você rodar de novo.
do $$
begin
  if not exists (select 1 from loja_produtos) then
    insert into loja_produtos (nome, marca, categoria, sub, preco, preco_antigo, destaque, descricao, specs) values
    ('Aquecedor a gás Rheem 18 litros digital', 'Rheem', 'aquecedores', 'Rheem', 2590, 2890, false, 'Aquecedor de passagem digital com exaustão forçada, ideal para atender 2 pontos de água quente simultâneos com conforto.', '["Vazão: 18 L/min","Gás: GN ou GLP","Exaustão forçada","Painel digital","Garantia de 5 anos"]'::jsonb),
    ('Aquecedor a gás Rheem 26 litros digital', 'Rheem', 'aquecedores', 'Rheem', 3790, null, false, 'Alta vazão para residências com 3 ou mais pontos de água quente. Controle preciso de temperatura.', '["Vazão: 26 L/min","Gás: GN ou GLP","Exaustão forçada","Painel digital","Garantia de 5 anos"]'::jsonb),
    ('Aquecedor a gás Rinnai REU-E15 15 litros', 'Rinnai', 'aquecedores', 'Rinnai', 1990, null, true, 'O queridinho das instalações residenciais: compacto, silencioso e muito econômico. Atende banho + pia com folga.', '["Vazão: 15 L/min","Gás: GN ou GLP","Exaustão forçada","Bivolt","Garantia de 5 anos"]'::jsonb),
    ('Aquecedor a gás Rinnai REU-E21 21 litros', 'Rinnai', 'aquecedores', 'Rinnai', 2890, null, true, 'Equilíbrio perfeito entre vazão e economia. Atende 2 chuveiros simultâneos mantendo a temperatura estável.', '["Vazão: 21 L/min","Gás: GN ou GLP","Exaustão forçada","Controle digital de temperatura","Garantia de 5 anos"]'::jsonb),
    ('Aquecedor a gás Rinnai REU-E27 27 litros', 'Rinnai', 'aquecedores', 'Rinnai', 3990, null, false, 'Para casas grandes e alto consumo: vazão de sobra para vários pontos ao mesmo tempo, com tecnologia japonesa.', '["Vazão: 27 L/min","Gás: GN ou GLP","Exaustão forçada","Controle digital de temperatura","Garantia de 5 anos"]'::jsonb),
    ('Aquecedor a gás Komeco KO 16D 16 litros', 'Komeco', 'aquecedores', 'Komeco', 1690, 1890, false, 'Ótimo custo-benefício com display digital e chama modulante. Ideal para apartamentos e casas menores.', '["Vazão: 16 L/min","Gás: GN ou GLP","Exaustão forçada","Display digital","Garantia de 3 anos"]'::jsonb),
    ('Aquecedor a gás Komeco KO 22D 22 litros', 'Komeco', 'aquecedores', 'Komeco', 2490, null, false, 'Vazão generosa por um preço acessível. Atende banheira e chuveiros com estabilidade de temperatura.', '["Vazão: 22 L/min","Gás: GN ou GLP","Exaustão forçada","Display digital","Garantia de 3 anos"]'::jsonb),
    ('Aquecedor a gás Lorenzetti LZ 1600DE 15 litros', 'Lorenzetti', 'aquecedores', 'Lorenzetti', 1590, null, false, 'Marca brasileira consagrada, fácil manutenção e peças sempre disponíveis. Excelente primeira instalação.', '["Vazão: 15 L/min","Gás: GN ou GLP","Exaustão forçada","Acendimento eletrônico","Garantia de 3 anos"]'::jsonb),
    ('Aquecedor a gás Lorenzetti LZ 2500DE 25 litros', 'Lorenzetti', 'aquecedores', 'Lorenzetti', 2790, null, false, 'Alta vazão nacional com comando digital de temperatura e proteção contra superaquecimento.', '["Vazão: 25 L/min","Gás: GN ou GLP","Exaustão forçada","Comando digital","Garantia de 3 anos"]'::jsonb),
    ('Bomba pressurizadora Komeco TP 820 G2 120W', 'Komeco', 'bombas', 'Komeco', 890, 990, false, 'Acaba com o banho fraco: pressuriza chuveiro e aquecedor com acionamento automático e operação silenciosa.', '["Potência: 120 W","Vazão máx.: 30 L/min","Acionamento automático por fluxo","Silenciosa","Garantia de 2 anos"]'::jsonb),
    ('Bomba pressurizadora Komeco TP 825 G4 245W', 'Komeco', 'bombas', 'Komeco', 1190, null, false, 'Mais potência para casas com 2 banheiros ou tubulação longa. Pressão constante em todos os pontos.', '["Potência: 245 W","Vazão máx.: 40 L/min","Acionamento automático por fluxo","Corpo em latão","Garantia de 2 anos"]'::jsonb),
    ('Bomba pressurizadora Rinnai RB 250W', 'Rinnai', 'bombas', 'Rinnai', 1290, null, true, 'Qualidade Rinnai também na pressurização: robusta, estável e perfeita para trabalhar junto com o aquecedor.', '["Potência: 250 W","Vazão máx.: 42 L/min","Acionamento automático","Baixo ruído","Garantia de 2 anos"]'::jsonb),
    ('Mangueira de gás flexível inox 1,20 m', 'Universal', 'mangueiras', 'Gás', 89, null, false, 'Mangueira em aço inox trançado com certificação, conexões 1/2" — segurança total na ligação do gás.', '["Comprimento: 1,20 m","Conexão: 1/2 pol.","Aço inox trançado","Certificada NBR 14177"]'::jsonb),
    ('Mangueira de gás flexível inox 2,00 m', 'Universal', 'mangueiras', 'Gás', 129, null, false, 'Versão mais longa para instalações onde o ponto de gás fica distante do aquecedor.', '["Comprimento: 2,00 m","Conexão: 1/2 pol.","Aço inox trançado","Certificada NBR 14177"]'::jsonb),
    ('Ligação flexível de água quente 40 cm', 'Universal', 'mangueiras', 'Água', 45, null, false, 'Flexível trançado em inox próprio para água quente, faz a ligação limpa entre o aquecedor e a tubulação.', '["Comprimento: 40 cm","Conexão: 1/2 pol.","Suporta água quente","Inox trançado"]'::jsonb),
    ('Registro de gás esfera 1/2"', 'Universal', 'registros', '', 55, null, false, 'Registro tipo esfera com corpo em latão, fechamento rápido a 90° — item obrigatório de segurança.', '["Bitola: 1/2 pol.","Corpo em latão","Fechamento 1/4 de volta","Certificado"]'::jsonb),
    ('Registro de gás esfera 3/4"', 'Universal', 'registros', '', 75, null, false, 'Para tubulações de maior bitola, mesma segurança e qualidade do modelo 1/2".', '["Bitola: 3/4 pol.","Corpo em latão","Fechamento 1/4 de volta","Certificado"]'::jsonb),
    ('Kit canopla de acabamento inox', 'Universal', 'acabamentos', '', 69, null, false, 'Acabamento em inox escovado para a passagem do duto na parede — instalação com cara de obra terminada.', '["Material: inox escovado","Diâmetro: 60 mm","Fixação por encaixe"]'::jsonb),
    ('Canopla decorativa branca 60 mm', 'Universal', 'acabamentos', '', 39, null, false, 'Opção discreta em ABS branco para acabamento da exaustão em áreas internas.', '["Material: ABS","Cor: branca","Diâmetro: 60 mm"]'::jsonb),
    ('Duto de exaustão alumínio Ø60 mm × 1,5 m', 'Universal', 'dutos', '', 119, null, false, 'Duto flexível em alumínio para conduzir os gases da combustão com total segurança até a área externa.', '["Diâmetro: 60 mm","Comprimento: 1,5 m (extensível)","Alumínio","Compatível com exaustão forçada"]'::jsonb),
    ('Terminal de exaustão inox Ø60 mm', 'Universal', 'dutos', '', 149, null, false, 'Terminal externo em inox com proteção contra chuva e entrada de pássaros. Acabamento profissional.', '["Diâmetro: 60 mm","Inox 430","Proteção contra chuva e vento"]'::jsonb),
    ('Kit de exaustão sob medida (projeto)', 'Servigás', 'dutos', '', null, null, false, 'Instalações especiais (prumadas longas, shafts, coletivos): nossa equipe dimensiona e monta o kit ideal.', '["Projeto personalizado","Visita técnica","Materiais certificados"]'::jsonb);
  end if;
end $$;
