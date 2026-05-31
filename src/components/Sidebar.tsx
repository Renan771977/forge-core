import clsx from 'clsx';
import type { NavSection } from '../types';

interface Props {
  active:   NavSection;
  onChange: (s: NavSection) => void;
  alertCount: number;
}

const NAV: { id: NavSection; label: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',    icon: '◉' },
  { id: 'monitor',    label: 'Monitor',       icon: '◈' },
  { id: 'workload',   label: 'Workload',      icon: '⬡' },
  { id: 'diagnosis',  label: 'Diagnóstico',   icon: '◭' },
  { id: 'benchmark',  label: 'Benchmark',     icon: '▶' },
  { id: 'history',    label: 'Histórico',     icon: '◫' },
  { id: 'alerts',     label: 'Alertas',       icon: '△' },
  { id: 'certified',  label: 'FORGE Cert.',   icon: '◇' },
];

export function Sidebar({ active, onChange, alertCount }: Props) {
  return (
    <aside className="flex flex-col w-[220px] min-h-screen bg-[#0E0B09] border-r border-[#2a84d0]/10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2a84d0]/10">
        <svg width="26" height="30" viewBox="0 0 56 66" fill="none">
          <polygon points="28,3 51,16 51,50 28,63 5,50 5,16" fill="#2a84d0"/>
          <rect x="17" y="14" width="8" height="31" fill="#0E0B09"/>
          <rect x="25" y="14" width="14" height="9" fill="#0E0B09"/>
          <rect x="25" y="30" width="10" height="8" fill="#0E0B09"/>
        </svg>
        <div>
          <div className="font-['Barlow_Condensed'] font-black text-[18px] tracking-[5px] text-[#F4EDE4]">FORGE</div>
          <div className="text-[9px] tracking-[2px] text-[#7A6A5E] uppercase font-mono">v1.0.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[2px] p-3 flex-1">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-sm text-left transition-all',
              'hover:bg-[#2a84d0]/8 group',
              active === item.id
                ? 'bg-[#2a84d0]/12 text-[#2a84d0] border-l-2 border-[#2a84d0]'
                : 'text-[#7A6A5E] border-l-2 border-transparent',
            )}
          >
            <span className={clsx(
              'font-mono text-[13px] w-4 text-center',
              active === item.id ? 'text-[#2a84d0]' : 'text-[#4a3e36] group-hover:text-[#7A6A5E]',
            )}>
              {item.icon}
            </span>
            <span className={clsx(
              'text-[12px] tracking-[1px] uppercase font-medium',
              active === item.id ? 'text-[#F4EDE4]' : '',
            )}>
              {item.label}
            </span>
            {item.id === 'alerts' && alertCount > 0 && (
              <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#2a84d0]/20 text-[#2a84d0]">
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#2a84d0]/10">
        <div className="text-[9px] font-mono text-[#4a3e36] tracking-[1.5px] uppercase">
          Performance Computing
        </div>
        <div className="text-[9px] font-mono text-[#2a84d0]/40 mt-0.5">
          forge.build
        </div>
      </div>
    </aside>
  );
}