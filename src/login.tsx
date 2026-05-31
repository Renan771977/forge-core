import { supabase } from './supabase';
import { useState, useRef, useEffect } from 'react';

interface Props {
  onLogin: (email: string) => void;
}

export function Login({ onLogin }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    if (password.length < 4) { setError('Senha inválida.'); return; }

    setLoading(true);

    // --- A MÁGICA DE SEGURANÇA DO SUPABASE COMEÇA AQUI ---
    const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setLoading(false);

    if (supabaseError) {
      // Se o usuário digitar a senha errada ou não existir, o Supabase bloqueia!
      console.error("Erro no login:", supabaseError.message);
      setError('E-mail ou senha incorretos. Acesso negado.');
      return;
    }

    if (data.session) {
      // Login com sucesso! O Supabase devolveu o Token e nós abrimos a porta.
      onLogin(data.user.email || '');
    }
    // --- FIM DA MÁGICA ---
  }
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#0B0907] overflow-hidden">

      {/* Grade de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(42,132,208,.035) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(42,132,208,.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow central */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 560, height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(42,132,208,.07) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <svg width="52" height="60" viewBox="0 0 56 66" fill="none" className="mb-4">
            <polygon points="28,3 51,16 51,50 28,63 5,50 5,16" fill="#2a84d0"/>
            <polygon points="28,9 46,20 46,46 28,57 10,46 10,20"
              fill="none" stroke="#0B0907" strokeWidth="0.6" opacity="0.2"/>
            <rect x="17" y="14" width="8"  height="31" fill="#0B0907"/>
            <rect x="25" y="14" width="14" height="9"  fill="#0B0907"/>
            <rect x="25" y="30" width="10" height="8"  fill="#0B0907"/>
          </svg>

          <h1
            className="text-[32px] font-black tracking-[10px] uppercase text-[#F4EDE4] leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            FORGE
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[3px] uppercase text-[#2a84d0] font-mono opacity-70">
            Performance Computing
          </p>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#0E0B09] border border-[#2a84d0]/15 rounded-sm p-8 flex flex-col gap-5"
        >
          <div>
            <p
              className="text-[14px] text-[#F4EDE4] font-medium mb-0.5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}
            >
              Acesse sua conta
            </p>
            <p className="text-[11px] text-[#7A6A5E] font-mono">
              Monitore, analise e otimize em tempo real.
            </p>
          </div>

          {/* E-mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-mono tracking-[2.5px] uppercase text-[#2a84d0] opacity-80">
              E-mail
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@forge.build"
              autoComplete="email"
              className="
                w-full bg-[#131009] border border-[#2a84d0]/20 rounded-sm
                px-3.5 py-3 text-[13px] font-mono text-[#F4EDE4]
                placeholder-[#4a3e36] outline-none
                focus:border-[#2a84d0] focus:bg-[#0f0d09]
                transition-colors duration-150
              "
            />
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-mono tracking-[2.5px] uppercase text-[#2a84d0] opacity-80">
                Senha
              </label>
              <button
                type="button"
                className="text-[9px] font-mono text-[#7A6A5E] hover:text-[#F4EDE4] transition-colors"
              >
                Esqueci a senha
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="
                w-full bg-[#131009] border border-[#2a84d0]/20 rounded-sm
                px-3.5 py-3 text-[13px] font-mono text-[#F4EDE4]
                placeholder-[#4a3e36] outline-none
                focus:border-[#2a84d0] focus:bg-[#0f0d09]
                transition-colors duration-150
              "
            />
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/8 border border-red-500/25 rounded-sm">
              <span className="text-red-400 text-[11px] font-mono">⚠ {error}</span>
            </div>
          )}

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3.5 rounded-sm font-black text-[14px] tracking-[3px] uppercase
              transition-all duration-150 mt-1
              disabled:opacity-40 disabled:cursor-not-allowed
              enabled:hover:brightness-110 enabled:active:scale-[.99]
            "
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              background: '#2a84d0',
              color: '#0B0907',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Verificando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#2a84d0]/10" />
            <span className="text-[9px] font-mono text-[#4a3e36] tracking-[1px]">ou</span>
            <div className="flex-1 h-px bg-[#2a84d0]/10" />
          </div>

          {/* Criar conta */}
          <p className="text-center text-[11px] font-mono text-[#7A6A5E]">
            Não tem acesso?{' '}
            <button
              type="button"
              className="text-[#2a84d0] hover:brightness-125 transition-all underline underline-offset-2"
            >
              Solicitar cadastro
            </button>
          </p>
        </form>

        <p className="mt-5 text-center text-[9px] font-mono text-[#4a3e36] tracking-[1.5px] uppercase">
          forge.build · v1.0.0
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#0B0907" strokeWidth="3" opacity="0.3"/>
      <path d="M22 12a10 10 0 0 0-10-10" stroke="#0B0907" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}