// ── WORKLOAD ──────────────────────────────────────────────
export type Workload =
  | 'idle' | 'gaming' | 'video_3d' | 'ai_ml'
  | 'development' | 'video_editing' | 'general';

export const WORKLOAD_LABELS: Record<Workload, string> = {
  idle:          'Idle',
  gaming:        'Gaming',
  video_3d:      '3D / Render',
  ai_ml:         'IA / ML',
  development:   'Desenvolvimento',
  video_editing: 'Edição de Vídeo',
  general:       'Geral',
};

export const WORKLOAD_ICONS: Record<Workload, string> = {
  idle:          '○',
  gaming:        '◈',
  video_3d:      '◭',
  ai_ml:         '⬡',
  development:   '⌨',
  video_editing: '▶',
  general:       '◉',
};

// ── HARDWARE ──────────────────────────────────────────────
export interface CpuMetrics {
  usage_percent:   number;
  frequency_mhz:   number;
  core_count:      number;
  thread_count:    number;
  temperature_c:   number | null;
  brand:           string;
  per_core_usage:  number[];
}

export interface GpuMetrics {
  name:            string;
  usage_percent:   number;
  vram_used_mb:    number;
  vram_total_mb:   number;
  temperature_c:   number | null;
  power_watts:     number | null;
  driver_version:  string;
  available:       boolean;
}

export interface RamMetrics {
  used_gb:         number;
  total_gb:        number;
  available_gb:    number;
  usage_percent:   number;
  speed_mhz:       number | null;
  swap_used_gb:    number;
  swap_total_gb:   number;
}

export interface DiskMetrics {
  name:            string;
  mount_point:     string;
  used_gb:         number;
  total_gb:        number;
  usage_percent:   number;
  disk_type:       string;
  read_speed_mbs:  number | null;
  write_speed_mbs: number | null;
}

export interface ProcessInfo {
  pid:             number;
  name:            string;
  cpu_usage:       number;
  ram_usage_mb:    number;
  category:        'creative' | 'development' | 'gaming' | 'system' | 'browser' | 'other';
}

export interface SystemSnapshot {
  timestamp:        string;
  cpu:              CpuMetrics;
  gpu:              GpuMetrics;
  ram:              RamMetrics;
  disks:            DiskMetrics[];
  uptime_secs:      number;
  os_name:          string;
  hostname:         string;
  active_processes: ProcessInfo[];
}

// ── ANALYSIS ──────────────────────────────────────────────
export type BottleneckType = 'NONE' | 'CPU' | 'GPU' | 'RAM' | 'DISK' | 'THERMAL' | 'VRAM';

export interface BottleneckReport {
  primary:     BottleneckType;
  secondary:   BottleneckType | null;
  confidence:  number;
  description: string;
  impact:      string;
}

export interface ComponentScore {
  score:          number;   // 0–100
  label:          string;
  interpretation: string;
  recommendation: string | null;
}

export interface ForgeScore {
  overall:    number;
  cpu:        ComponentScore;
  gpu:        ComponentScore;
  ram:        ComponentScore;
  disk:       ComponentScore;
  thermal:    ComponentScore;
  workload:   Workload;
  verdict:    string;
  bottleneck: BottleneckReport;
  timestamp:  string;
}

// ── ALERTS ────────────────────────────────────────────────
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id:          string;
  severity:    AlertSeverity;
  component:   string;
  title:       string;
  description: string;
  impact:      string;
  action:      string | null;
  timestamp:   string;
  dismissed:   boolean;
}

// ── BENCHMARK ─────────────────────────────────────────────
export interface BenchmarkResult {
  id:                string;
  timestamp:         string;
  workload:          Workload;
  cpu_score:         number;
  ram_score:         number;
  disk_score:        number;
  overall_score:     number;
  cpu_duration_ms:   number;
  ram_bandwidth_gbs: number;
  disk_seq_read_mbs: number;
  vs_baseline_pct:   number;
  notes:             string;
}

// ── HISTORY ───────────────────────────────────────────────
export interface HistoryEntry {
  id:          string;
  timestamp:   string;
  forge_score: number;
  cpu_usage:   number;
  ram_usage:   number;
  cpu_temp:    number | null;
  workload:    Workload;
  bottleneck:  BottleneckType;
}

// ── CERTIFIED ─────────────────────────────────────────────
export type CertStatus = 'active' | 'expired' | 'degraded';

export interface ForgeCertified {
  cert_id:         string;
  build_name:      string;
  certified_at:    string;
  cpu_brand:       string;
  gpu_name:        string;
  ram_total_gb:    number;
  baseline_score:  number;
  current_score:   number;
  score_delta_pct: number;
  status:          CertStatus;
}

// ── UI ────────────────────────────────────────────────────
export type NavSection =
  | 'dashboard' | 'monitor' | 'workload'
  | 'diagnosis' | 'benchmark' | 'history'
  | 'alerts' | 'certified';