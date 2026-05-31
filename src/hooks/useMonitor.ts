import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SystemSnapshot, ForgeScore, Alert, Workload,
  BenchmarkResult, HistoryEntry, ForgeCertified, BottleneckReport
} from '../types';

// ── TAURI BRIDGE ──────────────────────────────────────────
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    // CORREÇÃO: Endereço correto do Tauri V1!
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri');
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    console.error("Falha ao conectar com o Rust:", error);
    return mockInvoke<T>(cmd, args);
  }
}

// ── MOCK DATA ─────────────────────────────────────────────
let mockCpuUsage  = 42;
let mockRamUsage  = 58;
let mockCpuTemp   = 62;
let mockGpuUsage  = 35;
let mockScore     = 78;

function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): T {
  // Slightly randomise values each call to simulate live data
  mockCpuUsage = Math.min(99, Math.max(5, mockCpuUsage + (Math.random() - 0.5) * 8));
  mockRamUsage = Math.min(95, Math.max(20, mockRamUsage + (Math.random() - 0.5) * 3));
  mockCpuTemp  = Math.min(88, Math.max(40, mockCpuTemp  + (Math.random() - 0.5) * 4));
  mockGpuUsage = Math.min(98, Math.max(5, mockGpuUsage + (Math.random() - 0.5) * 10));
  mockScore    = Math.min(99, Math.max(40, mockScore    + (Math.random() - 0.5) * 5));

  const snap: SystemSnapshot = {
    timestamp: new Date().toISOString(),
    cpu: {
      usage_percent: mockCpuUsage,
      frequency_mhz: 4800,
      core_count: 16,
      thread_count: 32,
      temperature_c: mockCpuTemp,
      brand: 'AMD Ryzen 9 7950X',
      per_core_usage: Array.from({ length: 16 }, () => Math.random() * 80 + 5),
    },
    gpu: {
      name: 'NVIDIA GeForce RTX 4090',
      usage_percent: mockGpuUsage,
      vram_used_mb: 8192,
      vram_total_mb: 24576,
      temperature_c: 68,
      power_watts: 320,
      driver_version: '551.76',
      available: true,
    },
    ram: {
      used_gb: (128 * mockRamUsage / 100),
      total_gb: 128,
      available_gb: 128 * (1 - mockRamUsage / 100),
      usage_percent: mockRamUsage,
      speed_mhz: 6000,
      swap_used_gb: 0,
      swap_total_gb: 8,
    },
    disks: [{
      name: 'Samsung 990 Pro 2TB',
      mount_point: 'C:',
      used_gb: 840,
      total_gb: 2000,
      usage_percent: 42,
      disk_type: 'SSD',
      read_speed_mbs: 7450,
      write_speed_mbs: 6900,
    }],
    uptime_secs: 86400,
    os_name: 'Windows 11 Pro 23H2',
    hostname: 'FORGE-WORKSTATION',
    active_processes: [
      { pid: 1001, name: 'blender.exe', cpu_usage: 18.4, ram_usage_mb: 4200, category: 'creative' },
      { pid: 1002, name: 'Code.exe', cpu_usage: 4.2, ram_usage_mb: 820, category: 'development' },
      { pid: 1003, name: 'chrome.exe', cpu_usage: 3.1, ram_usage_mb: 1240, category: 'browser' },
      { pid: 1004, name: 'System', cpu_usage: 1.2, ram_usage_mb: 180, category: 'system' },
    ],
  };

  const mkScore = (s: number, lbl: string, interp: string, rec?: string) => ({
    score: s, label: lbl, interpretation: interp, recommendation: rec ?? null,
  });

  const score: ForgeScore = {
    overall: Math.round(mockScore),
    cpu: mkScore(
      mockCpuUsage > 90 ? 45 : mockCpuUsage > 70 ? 72 : 88,
      mockCpuUsage > 90 ? 'Saturado' : mockCpuUsage > 60 ? 'Sob carga' : 'Ativo',
      `CPU em ${mockCpuUsage.toFixed(0)}% — dentro do esperado para renderização.`,
    ),
    gpu: mkScore(
      mockGpuUsage > 90 ? 85 : mockGpuUsage > 50 ? 78 : 55,
      mockGpuUsage > 50 ? 'Ativa' : 'Subutilizada',
      `GPU em ${mockGpuUsage.toFixed(0)}% de utilização.`,
      mockGpuUsage < 30 ? 'GPU subutilizada neste cenário.' : undefined,
    ),
    ram: mkScore(
      mockRamUsage > 90 ? 20 : mockRamUsage > 75 ? 55 : 85,
      mockRamUsage > 80 ? 'Alto' : 'Normal',
      `RAM em ${mockRamUsage.toFixed(0)}% — ${(128 * (1 - mockRamUsage / 100)).toFixed(1)}GB disponível.`,
    ),
    disk: mkScore(88, 'Normal', 'Disco com 42% de uso. 1.16TB livres.'),
    thermal: mkScore(
      mockCpuTemp > 85 ? 40 : mockCpuTemp > 75 ? 68 : 90,
      mockCpuTemp > 85 ? 'Elevado' : 'Ótimo',
      `CPU ${mockCpuTemp.toFixed(0)}°C / GPU 68°C. ${mockCpuTemp > 80 ? 'Temperatura elevada — verifique airflow.' : 'Refrigeração operando bem.'}`,
      mockCpuTemp > 80 ? 'Verifique pasta térmica e fluxo de ar do gabinete.' : undefined,
    ),
    workload: (args?.workload as Workload) ?? 'video_3d',
    verdict: mockScore > 80
      ? 'Sistema operando em excelente condição para renderização 3D.'
      : mockScore > 65
      ? 'Performance aceitável. Monitorando temperatura.'
      : 'Performance abaixo do ideal. Ação recomendada.',
    bottleneck: {
      primary: mockCpuUsage > 88 ? 'CPU' : mockRamUsage > 85 ? 'RAM' : 'NONE',
      secondary: null,
      confidence: 0.82,
      description: mockCpuUsage > 88
        ? `CPU em ${mockCpuUsage.toFixed(0)}% — recurso mais pressionado para renderização.`
        : 'Nenhum gargalo identificado. Sistema operando com folga.',
      impact: mockCpuUsage > 88
        ? 'Tarefas CPU-bound podem ter latência aumentada.'
        : 'Sistema pode absorver carga adicional.',
    },
    timestamp: new Date().toISOString(),
  };

  const alerts: Alert[] = [];
  if (mockCpuTemp > 82) {
    alerts.push({
      id: 'a1', severity: 'warning', component: 'CPU',
      title: `Temperatura elevada — ${mockCpuTemp.toFixed(0)}°C`,
      description: `CPU em ${mockCpuTemp.toFixed(0)}°C. Acima de 85°C throttling pode iniciar.`,
      impact: 'Performance pode ser reduzida em cargas sustentadas.',
      action: 'Melhore o fluxo de ar ou reaplique pasta térmica.',
      timestamp: new Date().toISOString(), dismissed: false,
    });
  }
  if (mockCpuUsage > 90) {
    alerts.push({
      id: 'a2', severity: 'warning', component: 'CPU',
      title: `CPU saturada — ${mockCpuUsage.toFixed(0)}%`,
      description: 'CPU operando no limite.',
      impact: 'Latência aumentada.',
      action: 'Feche processos em background.',
      timestamp: new Date().toISOString(), dismissed: false,
    });
  }

  const history: HistoryEntry[] = Array.from({ length: 60 }, (_, i) => ({
    id: `h${i}`,
    timestamp: new Date(Date.now() - i * 60_000).toISOString(),
    forge_score: Math.round(70 + Math.random() * 25),
    cpu_usage: 30 + Math.random() * 60,
    ram_usage: 40 + Math.random() * 40,
    cpu_temp: 55 + Math.random() * 25,
    workload: 'video_3d',
    bottleneck: Math.random() > 0.7 ? 'CPU' : 'NONE',
  }));

  const benchmarks: BenchmarkResult[] = [
    {
      id: 'b1', timestamp: new Date(Date.now() - 3600000).toISOString(),
      workload: 'video_3d', cpu_score: 24850, ram_score: 95, disk_score: 88,
      overall_score: 22400, cpu_duration_ms: 312, ram_bandwidth_gbs: 48.2,
      disk_seq_read_mbs: 6800, vs_baseline_pct: 24.5,
      notes: '24.5% acima da baseline FORGE. | Dentro da baseline FORGE.',
    },
  ];

  const certified: ForgeCertified = {
    cert_id: 'FRG-7C2A4B1E', build_name: 'Workstation Pro 3D',
    certified_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    cpu_brand: 'AMD Ryzen 9 7950X', gpu_name: 'NVIDIA GeForce RTX 4090',
    ram_total_gb: 128, baseline_score: 22400, current_score: 22100,
    score_delta_pct: -1.3, status: 'active',
  };

  const map: Record<string, unknown> = {
    get_snapshot:         snap,
    get_forge_score:      score,
    get_alerts:           alerts,
    detect_bottleneck:    score.bottleneck,
    get_history:          history,
    get_benchmark_history: benchmarks,
    run_benchmark:        benchmarks[0],
    get_workload:         'video_3d',
    set_workload:         null,
    certify_build:        certified,
    get_certified:        certified,
  };

  return (map[cmd] ?? null) as T;
}

// ── HOOK ──────────────────────────────────────────────────
export function useForge() {
  const [snapshot,    setSnapshot]    = useState<SystemSnapshot | null>(null);
  const [score,       setScore]       = useState<ForgeScore | null>(null);
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [workload,    setWorkloadState] = useState<Workload>('general');
  const [history,     setHistory]     = useState<HistoryEntry[]>([]);
  const [benchmarks,  setBenchmarks]  = useState<BenchmarkResult[]>([]);
  const [certified,   setCertified]   = useState<ForgeCertified | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);
  const [certifying,  setCertifying]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [snap, sc, al] = await Promise.all([
        invoke<SystemSnapshot>('get_snapshot'),
        invoke<ForgeScore>('get_forge_score'),
        invoke<Alert[]>('get_alerts'),
      ]);
      setSnapshot(snap);
      setScore(sc);
      setAlerts(al);
      setLoading(false);
    } catch (e) {
      console.error('FORGE monitor error:', e);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const [hist, bench, cert] = await Promise.all([
      invoke<HistoryEntry[]>('get_history', { limit: 120 }),
      invoke<BenchmarkResult[]>('get_benchmark_history'),
      invoke<ForgeCertified | null>('get_certified'),
    ]);
    setHistory(hist);
    setBenchmarks(bench);
    setCertified(cert);
  }, []);

  const setWorkload = useCallback(async (w: Workload) => {
    await invoke('set_workload', { workload: w });
    setWorkloadState(w);
    await refresh();
  }, [refresh]);

  const runBenchmark = useCallback(async (): Promise<BenchmarkResult> => {
    setBenchRunning(true);
    try {
      const result = await invoke<BenchmarkResult>('run_benchmark');
      setBenchmarks(prev => [result, ...prev]);
      return result;
    } finally {
      setBenchRunning(false);
    }
  }, []);

  const certifyBuild = useCallback(async (buildName: string): Promise<ForgeCertified> => {
    setCertifying(true);
    try {
      const cert = await invoke<ForgeCertified>('certify_build', { buildName });
      setCertified(cert);
      return cert;
    } finally {
      setCertifying(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadHistory();
    invoke<Workload>('get_workload').then(setWorkloadState);
    intervalRef.current = setInterval(refresh, 1500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, loadHistory]);

  return {
    snapshot, score, alerts, workload, history, benchmarks, certified,
    benchRunning, certifying, loading,
    setWorkload, runBenchmark, certifyBuild, refresh,
  };
}