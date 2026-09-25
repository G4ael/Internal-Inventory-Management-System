// ============================================================================
// LOGIN — Google (principal) e email/senha (acesso de emergência)
// ============================================================================
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo, GoogleIcon, Field } from '../components/ui';

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
    if (error) { setCarregando(false); setErr('Falha ao conectar com o Google'); }
    // Se der certo, o navegador redireciona — não precisa fazer mais nada aqui
  };

  // Login por email/senha — mantido como acesso de emergência
  const submit = async (e) => {
    e?.preventDefault();
    setErr(''); setCarregando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: u, password: p });
    setCarregando(false);
    if (error) setErr('Email ou senha inválidos');
    else onLogin(data.user);
  };

  return (
    <div className="login">
      <section className="login-heroi">
        <div>
          <Logo subtitulo="Gestão interna" />
          <h1 style={{ marginTop: 48 }}>Tudo da loja num lugar só</h1>
          <p>Serviços, orçamentos, clientes, estoque e o catálogo do site.</p>
        </div>
        <img src="/imagens/aquecedores-recorte.webp" alt="" width="900" height="560" />
      </section>

      <section className="login-form">
        <div className="login-caixa">
          <h2>Entrar</h2>
          <p className="t2" style={{ margin: '0 0 28px', fontSize: 14 }}>Acesso restrito à equipe Servigás.</p>

          <button type="button" className="btn btn-google" onClick={entrarComGoogle} disabled={carregando}>
            <GoogleIcon /> {carregando ? 'Conectando…' : 'Entrar com Google'}
          </button>

          {err && <div className="aviso-faixa erro" role="alert" style={{ marginTop: 16, marginBottom: 0 }}><span>{err}</span></div>}

          <div className="divisor">ou</div>

          {!mostrarBackup ? (
            <button type="button" className="btn btn-suave btn-bloco" onClick={() => setMostrarBackup(true)}>Entrar com email e senha</button>
          ) : (
            <form onSubmit={submit} className="grade-form" style={{ animation: 'subir .25s var(--ease)' }}>
              <Field label="Email" span={12}><input type="email" className="campo" value={u} onChange={e => setU(e.target.value)} autoFocus autoComplete="email" /></Field>
              <Field label="Senha" span={12}><input type="password" className="campo" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" /></Field>
              <div style={{ gridColumn: 'span 12' }}>
                <button type="submit" className="btn btn-preto btn-bloco" style={{ height: 50 }} disabled={carregando}>
                  <Lock /> {carregando ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default Login;
