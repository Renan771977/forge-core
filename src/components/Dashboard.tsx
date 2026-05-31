// @ts-nocheck
import { useMemo } from 'react';
import clsx from 'clsx';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { ForgeScore, SystemSnapshot, Alert, HistoryEntry, BottleneckType, NavSection } from '../types';

interface Props {
  score:    ForgeScore | null;
  snapshot: SystemSnapshot | null;
  alerts:   Alert[];
  history:  HistoryEntry[];
  onNav:    (s: NavSection) => void;
}

function ScoreRing({ value }: { value: number }) {
  const r   = 54;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 80 ? '#2a84d0' : value >= 60 ? '#EF9F27' : '#E24B4A';

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1A1612" strokeWidth="8"/>
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="font-mono font-bold text-4xl leading-none" style={{ color }}>
          {value}
        </div>
        <div className="text-[9px] tracking-[2px] uppercase text-[#7A6A5E] mt-1">Score</div>
      </div>
    </div>
  );
}

function MiniGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono tracking-[1.5px] uppercase text-[#7A6A5E]">{label}</span>
        <span className="text-[11px] font-mono font-bold text-[#F4EDE4]">{value.toFixed(0)}%</span>
      </div>
      <div className="h-[3px] bg-[#1A1612] rounded-full">
        <div
          className="h-[3px] rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function BottleneckBadge({ type }: { type: BottleneckType }) {
  if (type === 'NONE') return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
      <span className="text-[10px] font-mono tracking-[2px] uppercase text-emerald-400">Sem gargalo</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a84d0]/10 border border-[#2a84d0]/25 rounded-sm">
      <div className="w-1.5 h-1.5 rounded-full bg-[#2a84d0]"/>
      <span className="text-[10px] font-mono tracking-[2px] uppercase text-[#2a84d0]">Gargalo: {type}</span>
    </div>
  );
}

export function Dashboard({ score, snapshot, alerts, history, onNav }: Props) {
  const histData = useMemo(() =>
    [...history].reverse().slice(-40).map((h, i) => ({
      i, score: h.forge_score, cpu: h.cpu_usage, ram: h.ram_usage,
    })), [history]);

  const unread = alerts.filter(a => !a.dismissed);

  if (!score || !snapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#7A6A5E] font-mono text-sm tracking-[2px] animate-pulse">
          INICIALIZANDO FORGE MONITOR...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-12 gap-4 auto-rows-min">

      {/* FORGE Score */}
      <div className="col-span-4 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5 flex flex-col items-center gap-4">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 self-start">
          FORGE Score
        </div>
        <ScoreRing value={score.overall} />
        <div className="text-[12px] text-[#7A6A5E] text-center leading-relaxed px-2">
          {score.verdict}
        </div>
        <BottleneckBadge type={score.bottleneck.primary} />
      </div>

      {/* Quick Stats */}
      <div className="col-span-5 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5 flex flex-col gap-4">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60">
          Status em tempo real
        </div>
        <div className="flex flex-col gap-3">
          <MiniGauge label="CPU" value={snapshot.cpu.usage_percent} color={snapshot.cpu.usage_percent > 85 ? '#E24B4A' : '#2a84d0'} />
          <MiniGauge label="GPU" value={snapshot.gpu.usage_percent} color="#2a84d0" />
          <MiniGauge label="RAM" value={snapshot.ram.usage_percent} color={snapshot.ram.usage_percent > 85 ? '#EF9F27' : '#2a84d0'} />
          <MiniGauge label="Disco" value={snapshot.disks[0]?.usage_percent ?? 0} color="#2a84d0" />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2a84d0]/8">
          {snapshot.cpu.temperature_c && (
            <div className="text-center">
              <div className={clsx('font-mono font-bold text-lg', snapshot.cpu.temperature_c > 80 ? 'text-[#EF9F27]' : 'text-[#F4EDE4]')}>
                {snapshot.cpu.temperature_c.toFixed(0)}°C
              </div>
              <div className="text-[9px] text-[#7A6A5E] tracking-[1px] uppercase font-mono">CPU temp</div>
            </div>
          )}
          <div className="text-center">
            <div className="font-mono font-bold text-lg text-[#F4EDE4]">
              {snapshot.ram.used_gb.toFixed(1)} GB
            </div>
            <div className="text-[9px] text-[#7A6A5E] tracking-[1px] uppercase font-mono">RAM em uso</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-lg text-[#F4EDE4]">
              {snapshot.cpu.frequency_mhz.toLocaleString()} MHz
            </div>
            <div className="text-[9px] text-[#7A6A5E] tracking-[1px] uppercase font-mono">Clock CPU</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="col-span-3 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60">Alertas</div>
          {unread.length > 0 && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#2a84d0]/15 text-[#2a84d0]">
              {unread.length}
            </span>
          )}
        </div>
        {unread.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-emerald-400 text-xl mb-2">✓</div>
              <div className="text-[11px] text-[#7A6A5E] font-mono">Sistema normal</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {unread.slice(0, 4).map(a => (
              <div
                key={a.id}
                className={clsx(
                  'p-2.5 rounded-sm border-l-2 cursor-pointer hover:opacity-80',
                  a.severity === 'critical' ? 'bg-red-500/8 border-red-500' :
                  a.severity === 'warning'  ? 'bg-[#EF9F27]/8 border-[#EF9F27]' :
                  'bg-[#2a84d0]/8 border-[#2a84d0]',
                )}
                onClick={() => onNav('alerts')}
              >
                <div className="text-[10px] font-medium text-[#F4EDE4] mb-0.5">{a.title}</div>
                <div className="text-[9px] text-[#7A6A5E] leading-relaxed">{a.component}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Score history chart */}
      <div className="col-span-8 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-4">
          Score histórico — últimos 40 ciclos
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={histData}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2a84d0" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2a84d0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: '#0E0B09', border: '0.5px solid rgba(42,132,208,.3)', borderRadius: 2, fontSize: 10 }}
              labelStyle={{ color: '#7A6A5E' }}
              itemStyle={{ color: '#2a84d0', fontFamily: 'monospace' }}
              formatter={(v: number) => [`${v}`, 'Score']}
            />
            <Area type="monotone" dataKey="score" stroke="#2a84d0" fill="url(#scoreGrad)" strokeWidth={1.5} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Processes */}
      <div className="col-span-4 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-3">
          Top processos
        </div>
        <div className="flex flex-col gap-1.5">
          {snapshot.active_processes.slice(0, 5).map(p => (
            <div key={p.pid} className="flex items-center justify-between py-1.5 border-b border-[#2a84d0]/5 last:border-0">
              <div>
                <span className="text-[11px] text-[#F4EDE4] font-medium">{p.name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[10px] font-mono text-[#7A6A5E]">{p.cpu_usage.toFixed(1)}%</span>
                <span className="text-[10px] font-mono text-[#4a3e36]">{p.ram_usage_mb.toFixed(0)}MB</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component scores */}
      <div className="col-span-12 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-4">
          Análise por componente
        </div>
        <div className="grid grid-cols-5 gap-4">
          {([
            ['CPU',    score.cpu],
            ['GPU',    score.gpu],
            ['RAM',    score.ram],
            ['Disco',  score.disk],
            ['Térmico', score.thermal],
          ] as [string, typeof score.cpu][]).map(([name, c]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono tracking-[2px] uppercase text-[#7A6A5E]">{name}</span>
                <span className={clsx(
                  'text-[10px] font-mono font-bold',
                  c.score >= 80 ? 'text-emerald-400' : c.score >= 55 ? 'text-[#EF9F27]' : 'text-red-400',
                )}>
                  {c.score}
                </span>
              </div>
              <div className="h-1 bg-[#1A1612] rounded-full">
                <div className="h-1 rounded-full transition-all duration-1000" style={{
                  width: `${c.score}%`,
                  background: c.score >= 80 ? '#4ade80' : c.score >= 55 ? '#EF9F27' : '#E24B4A',
                }}/>
              </div>
              <div className="text-[9px] text-[#7A6A5E] leading-relaxed">{c.label}</div>
              <div className="text-[9px] text-[#4a3e36] leading-relaxed line-clamp-2">{c.interpretation}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}