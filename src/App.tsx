// @ts-nocheck
import { useState } from 'react';
import { Login } from './login'; 
import { Sidebar } from './components/Sidebar';
import {
  Monitor, WorkloadSelector, Diagnosis,
  Benchmark, History, Alerts, Certified,
} from './components/Screens';
import { Dashboard } from './components/Dashboard';
import { useForge } from './hooks/useMonitor';
import type { NavSection } from './types';

// ── ESTADO DE AUTENTICAÇÃO ────────────────────────────────
interface AuthState {
  loggedIn: boolean;
  email:    string;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ loggedIn: false, email: '' });
  const [nav,  setNav]  = useState<NavSection>('dashboard');

  // Inicializa o motor de monitoramento único
  const monitor = useForge() || {};

  // ── PORTÃO DE SEGURANÇA SUPABASE ───────────────────────
  if (!auth.loggedIn) {
    return <Login onLogin={email => setAuth({ loggedIn: true, email })} />;
  }

  // ── TRATAMENTO DE VARIÁVEIS E AVATAR ────────────────────
  const initials = auth.email ? auth.email.slice(0, 2).toUpperCase() : 'US';
  
  const currentScoreNum = typeof monitor?.score === 'object' && monitor?.score !== null 
    ? monitor.score.overall 
    : (monitor?.score || 0);

  const alertCount = monitor?.alerts ? monitor.alerts.length : 0;

  // ── ROTEAMENTO INTERNO DE TELAS ─────────────────────────
  const renderContent = () => {
    switch (nav) {
      case 'dashboard':
        return (
          <Dashboard
            score={monitor?.score}
            snapshot={monitor?.snapshot || null}
            alerts={monitor?.alerts || []}
            history={monitor?.history || []}
            onNav={setNav}
          />
        );
      case 'monitor':
        return <Monitor snapshot={monitor?.snapshot || null} />;
      case 'workload':
        return (
          <WorkloadSelector
            current={monitor?.workload || 'general'}
            onChange={monitor?.setWorkload || (() => {})}
          />
        );
      case 'diagnosis':
        return <Diagnosis score={monitor?.score || null} />;
      case 'benchmark':
        return (
          <Benchmark
            results={monitor?.benchmarks || []}
            running={monitor?.benchRunning || false}
            onRun={monitor?.runBenchmark || (() => {})}
          />
        );
      case 'history':
        return <History data={monitor?.history || []} />;
      case 'alerts':
        return <Alerts alerts={monitor?.alerts || []} />;
      case 'certified':
        return (
          <Certified
            cert={monitor?.certified || null}
            certifying={monitor?.certifying || false}
            onCertify={(nomeDoBuild) => {
              if (monitor?.certifyBuild) {
                monitor.certifyBuild(nomeDoBuild);
              }
            }}
            score={monitor?.score || null} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0907] overflow-hidden select-none text-[#F4EDE4] font-sans">
      {/* Barra Lateral de Navegação */}
      <Sidebar active={nav} onChange={setNav} alertCount={alertCount} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOPBAR DO SISTEMA ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#2a84d0]/10 bg-[#0E0B09]">
          
          {/* Título Dinâmico da Seção */}
          <span
            className="font-black text-lg tracking-[3px] uppercase text-[#F4EDE4]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {{
              dashboard:  'Dashboard',
              monitor:    'Monitor de hardware',
              workload:   'Perfil de workload',
              diagnosis:  'Diagnóstico',
              benchmark:  'Benchmark FORGE',
              history:    'Histórico',
              alerts:     'Alertas',
              certified:  'FORGE Certified',
            }[nav]}
          </span>

          {/* Lado Direito: Status e Perfil */}
          <div className="flex items-center gap-4">

            {/* Indicador de Status do Rust */}
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${monitor?.error ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`}/>
              <span className="text-[9px] font-mono tracking-[2px] text-[#7A6A5E] uppercase">
                {monitor?.error ? 'Erro' : 'Ao vivo'}
              </span>
            </div>

            {/* Score Pill */}
            {monitor?.snapshot && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#2a84d0]/10 border border-[#2a84d0]/20 rounded-sm">
                <span className="text-[9px] font-mono text-[#7A6A5E] tracking-[1px] uppercase">Score</span>
                <span className={`text-[11px] font-mono font-bold ${
                  currentScoreNum >= 80 ? 'text-emerald-400' : currentScoreNum >= 60 ? 'text-[#EF9F27]' : 'text-red-400'
                }`}>
                  {currentScoreNum}
                </span>
              </div>
            )}

            {/* Workload Badge */}
            <div className="px-3 py-1 bg-[#1A1612] border border-[#2a84d0]/12 rounded-sm">
              <span className="text-[9px] font-mono text-[#7A6A5E] tracking-[1px] uppercase">
                {typeof monitor?.workload === 'string' ? monitor.workload : 'Geral'}
              </span>
            </div>

            {/* Avatar + Menu Dropdown Premium (Gatilho no Hover) */}
            <div className="relative group ml-2 flex items-center">
              <div className="w-8 h-8 rounded-full bg-[#2a84d0]/10 border border-[#2a84d0]/30 flex items-center justify-center font-mono text-[11px] font-bold text-[#2a84d0] cursor-pointer hover:bg-[#2a84d0]/20 hover:border-[#2a84d0]/50 transition-all duration-200">
                {initials}
              </div>

              {/* Menu Flutuante */}
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#0E0B09] border border-[#2a84d0]/20 rounded-sm shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="absolute -top-1.5 right-3 w-3 h-3 bg-[#0E0B09] border-t border-l border-[#2a84d0]/20 transform rotate-45"></div>

                <div className="p-4 border-b border-[#2a84d0]/10">
                  <p className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0] opacity-80 mb-1">Conta Forge</p>
                  <p className="text-[13px] text-[#F4EDE4] font-medium truncate">{auth.email}</p>
                  
                  <div className="flex items-center gap-2 mt-2.5 bg-[#131009] p-2 rounded-sm border border-[#2a84d0]/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <p className="text-[10px] font-mono text-[#7A6A5E] truncate">
                      {monitor?.snapshot?.os_name || "FORGE Workstation"}
                    </p>
                  </div>
                </div>

                <div className="p-2 flex flex-col gap-1">
                  <button className="text-left px-3 py-2 text-[11px] font-mono text-[#7A6A5E] hover:text-[#F4EDE4] hover:bg-[#2a84d0]/10 rounded-sm transition-colors flex items-center gap-2">
                    <span className="text-[#2a84d0]">+</span> Adicionar Conta
                  </button>
                  <button onClick={() => setAuth({ loggedIn: false, email: '' })} className="text-left px-3 py-2 text-[11px] font-mono text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors">
                    Desconectar (Sair)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL COM TELA DE CARREGAMENTO ── */}
        <main className="flex-1 overflow-y-auto">
          {(!monitor?.snapshot || monitor?.loading) ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <svg width="44" height="51" viewBox="0 0 56 66" fill="none" className="opacity-40 animate-pulse">
                <polygon points="28,3 51,16 51,50 28,63 5,50 5,16" fill="#2a84d0"/>
                <rect x="17" y="14" width="8"  height="31" fill="#0B0907"/>
                <rect x="25" y="14" width="14" height="9"  fill="#0B0907"/>
                <rect x="25" y="30" width="10" height="8"  fill="#0B0907"/>
              </svg>
              <span className="text-[10px] font-mono tracking-[3px] text-[#7A6A5E] uppercase animate-pulse">
                Iniciando motor de hardware...
              </span>
            </div>
          ) : (
            renderContent()
          )}
        </main>

      </div>
    </div>
  );
}