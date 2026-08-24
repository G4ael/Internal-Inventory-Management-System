-- ============================================================================
-- CORREÇÕES DA AUDITORIA DE SEGURANÇA — aplicadas em 24/08/2026
-- ============================================================================
-- Já está tudo aplicado no banco (migração `endurecimento_seguranca_auditoria`).
-- Este arquivo fica aqui como registro do que foi feito e para poder repetir
-- num banco novo. Rodar de novo não causa problema.
-- ============================================================================

-- 1) Relatórios que ignoravam o RLS e estavam abertos ao público
alter view public.v_vendas_hoje     set (security_invoker = true);
alter view public.v_faturamento_dia set (security_invoker = true);
alter view public.v_estoque_alerta  set (security_invoker = true);
revoke all on public.v_vendas_hoje, public.v_faturamento_dia, public.v_estoque_alerta from anon;
grant select on public.v_vendas_hoje, public.v_faturamento_dia, public.v_estoque_alerta to authenticated;

-- 2) Upload: tamanho e tipo agora são impostos pelo servidor, não pelo navegador
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'loja-fotos';
update storage.buckets set file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'os-fotos';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'] where id in ('notas-pdf','nf-pdf');

-- 3) Ninguém se promove a admin: só o próprio nome é editável
revoke update on public.perfis from anon, authenticated;
grant  update (nome) on public.perfis to authenticated;

-- 4) Funções de gatilho não devem ser chamáveis pela API
revoke execute on function public.tg_criar_perfil()            from anon, authenticated;
revoke execute on function public.tg_bloquear_nao_autorizado() from anon, authenticated;

-- 5) search_path fixo (evita sequestro de função por schema malicioso)
alter function public.tg_set_atualizado_em()        set search_path = public, pg_temp;
alter function public.tg_movimentar_estoque_os()    set search_path = public, pg_temp;
alter function public.tg_movimentar_estoque_venda() set search_path = public, pg_temp;
alter function public.tg_estornar_venda_cancelada() set search_path = public, pg_temp;
alter function public.tg_recalcular_venda()         set search_path = public, pg_temp;
alter function public.tg_criar_perfil()             set search_path = public, pg_temp;
alter function public.tg_normalizar_email()         set search_path = public, pg_temp;
alter function public.tg_bloquear_nao_autorizado()  set search_path = public, pg_temp;
alter function public.loja_set_atualizado_em()      set search_path = public, pg_temp;

-- 6) Validação do catálogo no próprio banco (última barreira)
alter table public.loja_produtos
  add constraint loja_categoria_valida check (
    categoria in ('aquecedores','bombas','mangueiras','registros','acabamentos','dutos')),
  add constraint loja_precos_nao_negativos check (
    (preco is null or preco >= 0) and (preco_antigo is null or preco_antigo >= 0)),
  add constraint loja_nome_preenchido check (length(btrim(nome)) between 1 and 200),
  add constraint loja_ate_4_fotos check (jsonb_array_length(fotos) <= 4);

-- ============================================================================
-- AINDA PENDENTE — só o dono da conta consegue fazer (painel do Supabase):
--   • Authentication > Rate Limits: apertar o limite de tentativas de login
--   • Authentication > Bot and Abuse Protection: ligar o CAPTCHA
--   • Authentication > Passwords: ligar "leaked password protection"
--   • API Keys: desativar a chave legada `anon` (JWT)
-- E no GitHub: tornar privado o repositório do sistema interno.
-- ============================================================================
