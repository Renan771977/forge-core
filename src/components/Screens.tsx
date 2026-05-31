// ── MONITOR ──────────────────────────────────────────────
// @ts-nocheck
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useState, useMemo } from 'react';
import clsx from 'clsx';
import type {
  SystemSnapshot, Workload, ForgeScore, BenchmarkResult,
  Alert, HistoryEntry, ForgeCertified
} from '../types';
import { WORKLOAD_LABELS, WORKLOAD_ICONS } from '../types';

const TT_STYLE = {
  contentStyle: { background: '#0E0B09', border: '0.5px solid rgba(42,132,208,.25)', borderRadius: 2, fontSize: 10 },
  labelStyle: { color: '#7A6A5E' },
  itemStyle: { color: '#2a84d0', fontFamily: 'monospace' },
};

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-5', className)}>
      {title && (
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-4">{title}</div>
      )}
      {children}
    </div>
  );
}

function StatBox({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-[#131009] rounded-sm p-3 border border-[#2a84d0]/6">
      <div className="text-[9px] font-mono tracking-[1.5px] uppercase text-[#7A6A5E] mb-1.5">{label}</div>
      <div className="font-mono font-bold text-xl text-[#F4EDE4] leading-none">
        {value}{unit && <span className="text-sm text-[#7A6A5E] ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[9px] text-[#4a3e36] mt-1 font-mono">{sub}</div>}
    </div>
  );
}

// Monitor screen - live hardware detail
export function Monitor({ snapshot }: { snapshot: SystemSnapshot | null }) {
  const [history, setHistory] = useState<Array<{ t: number; cpu: number; gpu: number; ram: number; temp: number }>>([]);

  useMemo(() => {
    if (!snapshot) return;
    setHistory(prev => [...prev.slice(-59), {
      t: Date.now(),
      cpu: snapshot.cpu.usage_percent,
      gpu: snapshot.gpu.usage_percent,
      ram: snapshot.ram.usage_percent,
      temp: snapshot.cpu.temperature_c ?? 0,
    }]);
  }, [snapshot]);

  if (!snapshot) return <div className="p-6 text-[#7A6A5E] font-mono text-sm">Aguardando dados...</div>;

  const { cpu, gpu, ram, disks } = snapshot;

  return (
    <div className="p-6 grid grid-cols-12 gap-4">

      {/* CPU Card */}
      <Card title="CPU" className="col-span-6">
        <div className="mb-4">
          <div className="text-sm font-medium text-[#F4EDE4] mb-0.5">{cpu.brand}</div>
          <div className="text-[10px] font-mono text-[#7A6A5E]">
            {cpu.core_count} cores · {cpu.thread_count} threads · {cpu.frequency_mhz.toLocaleString()} MHz
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="Uso total" value={cpu.usage_percent.toFixed(1)} unit="%" />
          <StatBox label="Temperatura" value={cpu.temperature_c ? cpu.temperature_c.toFixed(0) : '—'} unit="°C"
            sub={cpu.temperature_c && cpu.temperature_c > 80 ? '↑ Elevado' : 'Normal'} />
          <StatBox label="Frequência" value={(cpu.frequency_mhz / 1000).toFixed(2)} unit="GHz" />
        </div>
        {/* Per-core */}
        <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/50 mb-2">Uso por core</div>
        <div className="grid grid-cols-8 gap-1">
          {cpu.per_core_usage.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-full bg-[#1A1612] rounded-sm relative" style={{ height: 36 }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-500"
                  style={{
                    height: `${v}%`,
                    background: v > 85 ? '#E24B4A' : v > 65 ? '#2a84d0' : '#1d6099',
                  }}
                />
              </div>
              <div className="text-[7px] font-mono text-[#4a3e36]">{i + 1}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* GPU Card */}
      <Card title="GPU" className="col-span-6">
        <div className="mb-4">
          <div className="text-sm font-medium text-[#F4EDE4] mb-0.5">{gpu.name}</div>
          <div className="text-[10px] font-mono text-[#7A6A5E]">Driver {gpu.driver_version}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="Uso GPU" value={gpu.usage_percent.toFixed(1)} unit="%" />
          <StatBox label="Temp GPU" value={gpu.temperature_c ? gpu.temperature_c.toFixed(0) : '—'} unit="°C" />
          <StatBox label="Potência" value={gpu.power_watts ? gpu.power_watts.toFixed(0) : '—'} unit="W" />
        </div>
        <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/50 mb-2">VRAM</div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-[#7A6A5E]">
              {gpu.vram_used_mb ? (gpu.vram_used_mb / 1024).toFixed(1) : '—'} GB em uso
            </span>
            <span className="text-[#F4EDE4]">
              {gpu.vram_total_mb ? (gpu.vram_total_mb / 1024).toFixed(0) : '—'} GB total
            </span>
          </div>
          <div className="h-2 bg-[#1A1612] rounded-sm">
            <div
              className="h-2 rounded-sm bg-[#2a84d0] transition-all duration-700"
              style={{ width: gpu.vram_total_mb ? `${(gpu.vram_used_mb / gpu.vram_total_mb) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </Card>

      {/* RAM Card */}
      <Card title="Memória RAM" className="col-span-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatBox label="Usado" value={ram.used_gb.toFixed(1)} unit="GB" />
          <StatBox label="Disponível" value={ram.available_gb.toFixed(1)} unit="GB" />
          <StatBox label="Total" value={ram.total_gb.toFixed(0)} unit="GB" />
          <StatBox label="Swap usado" value={ram.swap_used_gb.toFixed(2)} unit="GB" />
        </div>
        <div className="h-3 bg-[#1A1612] rounded-sm">
          <div
            className={clsx(
              'h-3 rounded-sm transition-all duration-700',
              ram.usage_percent > 85 ? 'bg-[#EF9F27]' : 'bg-[#2a84d0]',
            )}
            style={{ width: `${ram.usage_percent}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-[#7A6A5E] mt-2">{ram.usage_percent.toFixed(1)}% em uso</div>
      </Card>

      {/* Disk */}
      <Card title="Armazenamento" className="col-span-4">
        {disks.map((d, i) => (
          <div key={i} className="mb-3 last:mb-0">
            <div className="flex justify-between mb-1.5">
              <div>
                <div className="text-[11px] font-medium text-[#F4EDE4]">{d.mount_point}</div>
                <div className="text-[9px] font-mono text-[#4a3e36]">{d.name} · {d.disk_type}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-mono text-[#F4EDE4]">{d.used_gb.toFixed(0)} GB</div>
                <div className="text-[9px] font-mono text-[#4a3e36]">de {d.total_gb.toFixed(0)} GB</div>
              </div>
            </div>
            <div className="h-1.5 bg-[#1A1612] rounded-sm">
              <div
                className={clsx('h-1.5 rounded-sm', d.usage_percent > 85 ? 'bg-[#EF9F27]' : 'bg-[#2a84d0]')}
                style={{ width: `${d.usage_percent}%` }}
              />
            </div>
            <div className="text-[9px] font-mono text-[#7A6A5E] mt-1">{d.usage_percent.toFixed(0)}% usado</div>
          </div>
        ))}
      </Card>

      {/* System Info */}
      <Card title="Sistema" className="col-span-4">
        <div className="space-y-2.5">
          {[
            ['Host',    snapshot.hostname],
            ['OS',      snapshot.os_name],
            ['Uptime',  `${Math.floor(snapshot.uptime_secs / 3600)}h ${Math.floor((snapshot.uptime_secs % 3600) / 60)}m`],
            ['Proc.',   `${snapshot.active_processes.length} ativos`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[#2a84d0]/5 pb-2 last:border-0">
              <span className="text-[10px] font-mono text-[#7A6A5E] tracking-[1px] uppercase">{k}</span>
              <span className="text-[10px] font-mono text-[#F4EDE4]">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Chart */}
      <Card title="Histórico ao vivo — últimos 60s" className="col-span-12">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={history}>
            <XAxis hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip {...TT_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)}%`, n.toUpperCase()]} />
            <ReferenceLine y={85} stroke="#EF9F27" strokeDasharray="4 4" strokeWidth={0.5}/>
            <Line type="monotone" dataKey="cpu"  stroke="#2a84d0" strokeWidth={1.5} dot={false} name="cpu"/>
            <Line type="monotone" dataKey="gpu"  stroke="#4ade80" strokeWidth={1.5} dot={false} name="gpu"/>
            <Line type="monotone" dataKey="ram"  stroke="#EF9F27" strokeWidth={1}   dot={false} name="ram"/>
            <Line type="monotone" dataKey="temp" stroke="#E24B4A" strokeWidth={1}   dot={false} name="temp"/>
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-2 justify-center">
          {[['CPU', '#2a84d0'], ['GPU', '#4ade80'], ['RAM', '#EF9F27'], ['Temp', '#E24B4A']].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: c }}/>
              <span className="text-[9px] font-mono text-[#7A6A5E] tracking-[1px]">{l}</span>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}

// ── WORKLOAD SELECTOR ────────────────────────────────────
const WORKLOADS: { id: Workload; desc: string }[] = [
  { id: 'gaming',        desc: 'Alto FPS, latência mínima, GPU como prioridade.' },
  { id: 'video_3d',      desc: 'Render, Blender, Cinema 4D. CPU + GPU balanceados.' },
  { id: 'ai_ml',         desc: 'CUDA, PyTorch, inferência. GPU e VRAM como prioridade.' },
  { id: 'development',   desc: 'IDEs, containers, VMs. CPU multicore e RAM.' },
  { id: 'video_editing', desc: 'Premiere, Resolve. NVMe rápido + RAM + GPU.' },
  { id: 'general',       desc: 'Uso misto. Análise equilibrada de todos os recursos.' },
];

export function WorkloadSelector({
  current, onChange,
}: { current: Workload; onChange: (w: Workload) => void }) {
  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-2">
          Perfil de workload
        </div>
        <h2 className="font-['Barlow_Condensed'] font-black text-3xl tracking-widest uppercase text-[#F4EDE4] mb-2">
          Qual é sua Forge?
        </h2>
        <p className="text-[#7A6A5E] text-sm mb-8 leading-relaxed">
          Selecione seu tipo de uso principal. O sistema adapta a análise, os pesos de score e as recomendações com base nesse perfil.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {WORKLOADS.map(w => (
            <button
              key={w.id}
              onClick={() => onChange(w.id)}
              className={clsx(
                'text-left p-4 rounded-sm border transition-all duration-200',
                'hover:border-[#2a84d0]/40 hover:bg-[#2a84d0]/5',
                current === w.id
                  ? 'border-[#2a84d0] bg-[#2a84d0]/8'
                  : 'border-[#2a84d0]/12 bg-[#0E0B09]',
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl text-[#2a84d0]">{WORKLOAD_ICONS[w.id]}</span>
                <span className="font-['Barlow_Condensed'] font-bold text-lg tracking-[2px] uppercase text-[#F4EDE4]">
                  {WORKLOAD_LABELS[w.id]}
                </span>
                {current === w.id && (
                  <span className="ml-auto text-[9px] font-mono text-[#2a84d0] tracking-[1.5px] uppercase">Ativo</span>
                )}
              </div>
              <p className="text-[11px] text-[#7A6A5E] leading-relaxed">{w.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm">
          <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 mb-2">
            Workload atual: {WORKLOAD_LABELS[current]}
          </div>
          <div className="text-[11px] text-[#7A6A5E]">
            O sistema está analisando sua performance com os pesos otimizados para <strong className="text-[#F4EDE4]">{WORKLOAD_LABELS[current]}</strong>. Altere o perfil quando mudar de atividade para obter análises mais precisas.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DIAGNOSIS ─────────────────────────────────────────────
export function Diagnosis({ score }: { score: ForgeScore | null }) {
  if (!score) return <div className="p-6 text-[#7A6A5E] font-mono text-sm">Analisando...</div>;

  const components = [
    { name: 'CPU',     data: score.cpu,     icon: '◈' },
    { name: 'GPU',     data: score.gpu,     icon: '◭' },
    { name: 'RAM',     data: score.ram,     icon: '⬡' },
    { name: 'Disco',   data: score.disk,    icon: '◫' },
    { name: 'Térmico', data: score.thermal, icon: '△' },
  ];

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Verdict */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded-sm bg-[#1A1612] flex items-center justify-center">
            <span className={clsx(
              'font-mono font-black text-3xl',
              score.overall >= 80 ? 'text-emerald-400' : score.overall >= 60 ? 'text-[#EF9F27]' : 'text-[#E24B4A]',
            )}>
              {score.overall}
            </span>
          </div>
          <div>
            <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-1">
              Score FORGE — {WORKLOAD_LABELS[score.workload]}
            </div>
            <div className="font-medium text-[#F4EDE4] mb-1">{score.verdict}</div>
            <div className="text-[11px] text-[#7A6A5E]">{score.bottleneck.description}</div>
          </div>
        </div>

        {score.bottleneck.primary !== 'NONE' && (
          <div className="mt-4 p-3 bg-[#2a84d0]/8 border border-[#2a84d0]/20 rounded-sm">
            <div className="text-[10px] font-mono tracking-[2px] uppercase text-[#2a84d0] mb-1">
              Gargalo identificado: {score.bottleneck.primary} ({(score.bottleneck.confidence * 100).toFixed(0)}% confiança)
            </div>
            <div className="text-[11px] text-[#F4EDE4]">{score.bottleneck.impact}</div>
          </div>
        )}
      </Card>

      {/* Component analysis */}
      {components.map(({ name, data, icon }) => (
        <div
          key={name}
          className="bg-[#0E0B09] border border-[#2a84d0]/12 rounded-sm p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[#2a84d0] font-mono">{icon}</span>
              <span className="font-['Barlow_Condensed'] font-bold text-lg tracking-[2px] uppercase text-[#F4EDE4]">{name}</span>
              <span className={clsx(
                'text-[9px] font-mono tracking-[1.5px] uppercase px-2 py-0.5 rounded-sm',
                data.score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                data.score >= 55 ? 'bg-[#EF9F27]/10 text-[#EF9F27]' :
                'bg-red-500/10 text-red-400',
              )}>
                {data.label}
              </span>
            </div>
            <span className={clsx(
              'font-mono font-bold text-xl',
              data.score >= 80 ? 'text-emerald-400' : data.score >= 55 ? 'text-[#EF9F27]' : 'text-red-400',
            )}>
              {data.score}
            </span>
          </div>

          <div className="h-1 bg-[#1A1612] rounded-full mb-3">
            <div
              className="h-1 rounded-full transition-all duration-1000"
              style={{
                width: `${data.score}%`,
                background: data.score >= 80 ? '#4ade80' : data.score >= 55 ? '#EF9F27' : '#E24B4A',
              }}
            />
          </div>

          <p className="text-[11px] text-[#7A6A5E] leading-relaxed mb-2">{data.interpretation}</p>

          {data.recommendation && (
            <div className="flex items-start gap-2 p-2.5 bg-[#2a84d0]/6 border border-[#2a84d0]/15 rounded-sm">
              <span className="text-[#2a84d0] text-xs mt-0.5">→</span>
              <span className="text-[11px] text-[#F4EDE4] leading-relaxed">{data.recommendation}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── BENCHMARK ─────────────────────────────────────────────
export function Benchmark({
  results, running, onRun,
}: { results: BenchmarkResult[]; running: boolean; onRun: () => void }) {
  const latest = results[0];

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-1">Benchmark FORGE</div>
            <div className="text-sm text-[#7A6A5E]">CPU · RAM · Disco — testes padronizados com resultado documentado.</div>
          </div>
          <button
            onClick={onRun}
            disabled={running}
            className={clsx(
              'font-["Barlow_Condensed"] font-bold text-sm tracking-[2px] uppercase px-5 py-2.5 rounded-sm transition-all',
              running
                ? 'bg-[#2a84d0]/20 text-[#2a84d0]/40 cursor-not-allowed'
                : 'bg-[#2a84d0] text-[#0B0907] hover:bg-[#3a94e0]',
            )}
          >
            {running ? '▶ Executando...' : '▶ Iniciar benchmark'}
          </button>
        </div>

        {running && (
          <div className="p-4 bg-[#2a84d0]/8 border border-[#2a84d0]/20 rounded-sm animate-pulse">
            <div className="text-[11px] font-mono text-[#2a84d0]">
              Executando testes... CPU → RAM → Disco. Não interrompa o processo.
            </div>
          </div>
        )}
      </Card>

      {latest && (
        <Card title={`Último resultado — ${new Date(latest.timestamp).toLocaleString('pt-BR')}`}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatBox label="Overall" value={latest.overall_score.toLocaleString()} />
            <StatBox label="CPU" value={latest.cpu_score.toLocaleString()} />
            <StatBox label="RAM" value={latest.ram_score} unit="pts" sub={`${latest.ram_bandwidth_gbs.toFixed(1)} GB/s`} />
            <StatBox label="Disco" value={latest.disk_score} unit="pts" sub={`${latest.disk_seq_read_mbs.toFixed(0)} MB/s`} />
          </div>

          <div className={clsx(
            'p-3 rounded-sm border mb-3',
            latest.vs_baseline_pct >= 0
              ? 'bg-emerald-500/8 border-emerald-500/20'
              : 'bg-[#EF9F27]/8 border-[#EF9F27]/20',
          )}>
            <span className={clsx(
              'text-[11px] font-mono font-bold',
              latest.vs_baseline_pct >= 0 ? 'text-emerald-400' : 'text-[#EF9F27]',
            )}>
              {latest.vs_baseline_pct >= 0 ? '+' : ''}{latest.vs_baseline_pct.toFixed(1)}% vs baseline FORGE
            </span>
          </div>

          {latest.notes && (
            <div className="text-[10px] font-mono text-[#7A6A5E] leading-relaxed">{latest.notes}</div>
          )}
        </Card>
      )}

      {results.length > 1 && (
        <Card title="Histórico de benchmarks">
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#2a84d0]/6 last:border-0">
                <div>
                  <div className="text-[11px] text-[#F4EDE4] font-mono">{r.overall_score.toLocaleString()}</div>
                  <div className="text-[9px] text-[#7A6A5E] font-mono">{new Date(r.timestamp).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className={clsx(
                  'text-[10px] font-mono',
                  r.vs_baseline_pct >= 0 ? 'text-emerald-400' : 'text-[#EF9F27]',
                )}>
                  {r.vs_baseline_pct >= 0 ? '+' : ''}{r.vs_baseline_pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────
export function History({ data }: { data: HistoryEntry[] }) {
  const chartData = useMemo(() =>
    [...data].reverse().map((h, i) => ({
      i,
      score: h.forge_score,
      cpu: Math.round(h.cpu_usage),
      ram: Math.round(h.ram_usage),
      temp: h.cpu_temp ? Math.round(h.cpu_temp) : null,
    })), [data]);

  return (
    <div className="p-6 space-y-4">
      <Card title="Score FORGE ao longo do tempo">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="hScoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2a84d0" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#2a84d0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip {...TT_STYLE} formatter={(v: number) => [`${v}`, 'Score']}/>
            <ReferenceLine y={80} stroke="#4ade80" strokeDasharray="4 4" strokeWidth={0.5}/>
            <ReferenceLine y={60} stroke="#EF9F27" strokeDasharray="4 4" strokeWidth={0.5}/>
            <Area type="monotone" dataKey="score" stroke="#2a84d0" fill="url(#hScoreGrad)" strokeWidth={1.5} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="CPU e RAM">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <XAxis hide /><YAxis domain={[0, 100]} hide />
              <Tooltip {...TT_STYLE} formatter={(v: number, n: string) => [`${v}%`, n.toUpperCase()]}/>
              <Line type="monotone" dataKey="cpu" stroke="#2a84d0" strokeWidth={1.5} dot={false} name="cpu"/>
              <Line type="monotone" dataKey="ram" stroke="#EF9F27" strokeWidth={1} dot={false} name="ram"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Temperatura CPU (°C)">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E24B4A" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#E24B4A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis hide /><YAxis domain={[30, 100]} hide />
              <Tooltip {...TT_STYLE} formatter={(v: number) => [`${v}°C`, 'Temp']}/>
              <ReferenceLine y={85} stroke="#EF9F27" strokeDasharray="3 3" strokeWidth={0.5}/>
              <Area type="monotone" dataKey="temp" stroke="#E24B4A" fill="url(#tempGrad)" strokeWidth={1.5} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title={`Log — últimas ${data.length} entradas`}>
        <div className="space-y-0 max-h-48 overflow-y-auto">
          {data.slice(0, 30).map(h => (
            <div key={h.id} className="flex items-center gap-4 py-1.5 border-b border-[#2a84d0]/4 last:border-0">
              <span className="text-[9px] font-mono text-[#4a3e36] w-36 flex-shrink-0">
                {new Date(h.timestamp).toLocaleString('pt-BR')}
              </span>
              <span className={clsx(
                'text-[10px] font-mono font-bold w-8',
                h.forge_score >= 80 ? 'text-emerald-400' : h.forge_score >= 60 ? 'text-[#EF9F27]' : 'text-red-400',
              )}>
                {h.forge_score}
              </span>
              <span className="text-[9px] font-mono text-[#7A6A5E]">CPU {h.cpu_usage.toFixed(0)}%</span>
              <span className="text-[9px] font-mono text-[#7A6A5E]">RAM {h.ram_usage.toFixed(0)}%</span>
              {h.bottleneck !== 'NONE' && (
                <span className="text-[9px] font-mono text-[#2a84d0] ml-auto">{h.bottleneck}</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────
export function Alerts({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const active = alerts.filter(a => !dismissed.has(a.id));

  return (
    <div className="p-6 max-w-2xl space-y-3">
      {active.length === 0 && (
        <Card>
          <div className="flex items-center gap-4 py-4">
            <div className="text-emerald-400 text-3xl">✓</div>
            <div>
              <div className="text-[#F4EDE4] font-medium mb-1">Sistema normal</div>
              <div className="text-[11px] text-[#7A6A5E]">Nenhum alerta ativo. Todos os componentes dentro dos limites esperados.</div>
            </div>
          </div>
        </Card>
      )}

      {active.map(a => (
        <div
          key={a.id}
          className={clsx(
            'bg-[#0E0B09] rounded-sm p-4 border-l-2',
            a.severity === 'critical' ? 'border-red-500' :
            a.severity === 'warning'  ? 'border-[#EF9F27]' : 'border-[#2a84d0]',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={clsx(
                  'text-[9px] font-mono tracking-[1.5px] uppercase px-2 py-0.5 rounded-sm',
                  a.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                  a.severity === 'warning'  ? 'bg-[#EF9F27]/10 text-[#EF9F27]' : 'bg-[#2a84d0]/10 text-[#2a84d0]',
                )}>
                  {a.severity === 'critical' ? '⚠ Crítico' : a.severity === 'warning' ? '△ Atenção' : 'ℹ Info'}
                </span>
                <span className="text-[9px] font-mono text-[#4a3e36] tracking-[1px] uppercase">{a.component}</span>
              </div>
              <div className="font-medium text-[#F4EDE4] text-sm mb-1">{a.title}</div>
              <div className="text-[11px] text-[#7A6A5E] mb-2">{a.description}</div>
              <div className="text-[11px] text-[#F4EDE4] mb-2">
                <span className="text-[#2a84d0] mr-1">Impacto:</span>{a.impact}
              </div>
              {a.action && (
                <div className="p-2 bg-[#2a84d0]/6 border border-[#2a84d0]/15 rounded-sm">
                  <span className="text-[10px] text-[#2a84d0] font-mono mr-1">→</span>
                  <span className="text-[10px] text-[#F4EDE4]">{a.action}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
              className="text-[#4a3e36] hover:text-[#7A6A5E] text-xs font-mono mt-0.5"
            >
              ✕
            </button>
          </div>
          <div className="text-[9px] font-mono text-[#4a3e36] mt-3">
            {new Date(a.timestamp).toLocaleString('pt-BR')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── FORGE CERTIFIED ───────────────────────────────────────
export function Certified({
  cert, certifying, onCertify, score,
}: {
  cert: ForgeCertified | null;
  certifying: boolean;
  onCertify: (name: string) => void;
  score: ForgeScore | null;
}) {
  const [buildName, setBuildName] = useState('Minha Workstation FORGE');

  return (
    <div className="p-6 max-w-2xl space-y-4">
      {cert ? (
        <>
          <div className="bg-[#0E0B09] border border-[#2a84d0] rounded-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[9px] font-mono tracking-[3px] uppercase text-[#2a84d0]/60 mb-1">FORGE Certified</div>
                <div className="font-['Barlow_Condensed'] font-black text-3xl tracking-[4px] uppercase text-[#F4EDE4]">
                  {cert.build_name}
                </div>
                <div className="font-mono text-[11px] text-[#2a84d0] mt-1">{cert.cert_id}</div>
              </div>
              <div className="text-right">
                <svg width="48" height="56" viewBox="0 0 56 66" fill="none">
                  <polygon points="28,3 51,16 51,50 28,63 5,50 5,16" fill="#2a84d0"/>
                  <rect x="17" y="14" width="8" height="31" fill="#0E0B09"/>
                  <rect x="25" y="14" width="14" height="9" fill="#0E0B09"/>
                  <rect x="25" y="30" width="10" height="8" fill="#0E0B09"/>
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                ['CPU', cert.cpu_brand],
                ['GPU', cert.gpu_name],
                ['RAM', `${cert.ram_total_gb.toFixed(0)} GB`],
                ['Certificado em', new Date(cert.certified_at).toLocaleDateString('pt-BR')],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#131009] rounded-sm p-3">
                  <div className="text-[9px] font-mono tracking-[1.5px] uppercase text-[#7A6A5E] mb-1">{k}</div>
                  <div className="text-[12px] text-[#F4EDE4] font-medium">{v}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 bg-[#2a84d0]/8 border border-[#2a84d0]/20 rounded-sm">
              <div>
                <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 mb-0.5">Score baseline</div>
                <div className="font-mono font-bold text-2xl text-[#F4EDE4]">{cert.baseline_score.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 mb-0.5">Score atual</div>
                <div className="font-mono font-bold text-2xl text-[#F4EDE4]">{cert.current_score.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 mb-0.5">Delta</div>
                <div className={clsx(
                  'font-mono font-bold text-xl',
                  cert.score_delta_pct >= 0 ? 'text-emerald-400' : 'text-[#EF9F27]',
                )}>
                  {cert.score_delta_pct >= 0 ? '+' : ''}{cert.score_delta_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onCertify(cert.build_name)}
            disabled={certifying}
            className="w-full font-['Barlow_Condensed'] font-bold text-sm tracking-[2px] uppercase py-3 rounded-sm bg-[#0E0B09] border border-[#2a84d0]/20 text-[#2a84d0] hover:bg-[#2a84d0]/5 transition-all"
          >
            {certifying ? 'Recertificando...' : 'Recertificar build'}
          </button>
        </>
      ) : (
        <Card title="Certificar este build">
          <div className="text-[11px] text-[#7A6A5E] mb-5 leading-relaxed">
            A certificação FORGE registra o estado atual do seu hardware com benchmark completo. Isso cria um registro imutável do seu build — útil para comparar degradação futura.
          </div>
          <div className="mb-4">
            <label className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 block mb-2">
              Nome do build
            </label>
            <input
              value={buildName}
              onChange={e => setBuildName(e.target.value)}
              className="w-full bg-[#131009] border border-[#2a84d0]/20 rounded-sm px-3 py-2.5 text-sm text-[#F4EDE4] font-mono focus:outline-none focus:border-[#2a84d0]"
            />
          </div>
          {score && (
            <div className="mb-4 p-3 bg-[#131009] rounded-sm">
              <div className="text-[9px] font-mono tracking-[2px] uppercase text-[#2a84d0]/60 mb-1">Score atual</div>
              <div className="font-mono font-bold text-2xl text-[#F4EDE4]">{score.overall}</div>
            </div>
          )}
          <button
            onClick={() => onCertify(buildName)}
            disabled={certifying}
            className={clsx(
              'w-full font-["Barlow_Condensed"] font-bold text-sm tracking-[2px] uppercase py-3 rounded-sm transition-all',
              certifying
                ? 'bg-[#2a84d0]/20 text-[#2a84d0]/40 cursor-not-allowed'
                : 'bg-[#2a84d0] text-[#0B0907] hover:bg-[#3a94e0]',
            )}
          >
            {certifying ? '◇ Certificando...' : '◇ Certificar build FORGE'}
          </button>
        </Card>
      )}
    </div>
  );
}