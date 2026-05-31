use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ── WORKLOAD ──────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Workload {
    Idle,
    Gaming,
    Video3d,
    AiMl,
    Development,
    VideoEditing,
    General,
}

impl Workload {
    pub fn label(&self) -> &'static str {
        match self {
            Workload::Idle       => "Idle",
            Workload::Gaming     => "Gaming",
            Workload::Video3d    => "3D / Render",
            Workload::AiMl       => "IA / ML",
            Workload::Development => "Desenvolvimento",
            Workload::VideoEditing => "Edição de Vídeo",
            Workload::General    => "Geral",
        }
    }

    // Weights: how much each resource matters for this workload (0.0–1.0)
    pub fn weights(&self) -> ResourceWeights {
        match self {
            Workload::Gaming      => ResourceWeights { cpu: 0.30, gpu: 0.55, ram: 0.10, disk: 0.05 },
            Workload::Video3d     => ResourceWeights { cpu: 0.35, gpu: 0.40, ram: 0.15, disk: 0.10 },
            Workload::AiMl        => ResourceWeights { cpu: 0.25, gpu: 0.50, ram: 0.15, disk: 0.10 },
            Workload::Development => ResourceWeights { cpu: 0.40, gpu: 0.05, ram: 0.35, disk: 0.20 },
            Workload::VideoEditing => ResourceWeights { cpu: 0.30, gpu: 0.30, ram: 0.20, disk: 0.20 },
            Workload::General     => ResourceWeights { cpu: 0.30, gpu: 0.20, ram: 0.30, disk: 0.20 },
            Workload::Idle        => ResourceWeights { cpu: 0.25, gpu: 0.25, ram: 0.25, disk: 0.25 },
        }
    }
}

impl Default for Workload {
    fn default() -> Self { Workload::General }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceWeights {
    pub cpu:  f64,
    pub gpu:  f64,
    pub ram:  f64,
    pub disk: f64,
}

// ── HARDWARE METRICS ──────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub usage_percent:    f64,
    pub frequency_mhz:    u64,
    pub core_count:       usize,
    pub thread_count:     usize,
    pub temperature_c:    Option<f64>,
    pub brand:            String,
    pub per_core_usage:   Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuMetrics {
    pub name:             String,
    pub usage_percent:    f64,
    pub vram_used_mb:     u64,
    pub vram_total_mb:    u64,
    pub temperature_c:    Option<f64>,
    pub power_watts:      Option<f64>,
    pub driver_version:   String,
    pub available:        bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RamMetrics {
    pub used_gb:          f64,
    pub total_gb:         f64,
    pub available_gb:     f64,
    pub usage_percent:    f64,
    pub speed_mhz:        Option<u32>,
    pub swap_used_gb:     f64,
    pub swap_total_gb:    f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub name:             String,
    pub mount_point:      String,
    pub used_gb:          f64,
    pub total_gb:         f64,
    pub usage_percent:    f64,
    pub disk_type:        String,
    pub read_speed_mbs:   Option<f64>,
    pub write_speed_mbs:  Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub timestamp:        DateTime<Utc>,
    pub cpu:              CpuMetrics,
    pub gpu:              GpuMetrics,
    pub ram:              RamMetrics,
    pub disks:            Vec<DiskMetrics>,
    pub uptime_secs:      u64,
    pub os_name:          String,
    pub hostname:         String,
    pub active_processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid:              u32,
    pub name:             String,
    pub cpu_usage:        f64,
    pub ram_usage_mb:     f64,
    pub category:         ProcessCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProcessCategory {
    Creative,
    Development,
    Gaming,
    System,
    Browser,
    Other,
}

// ── ANALYSIS ──────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BottleneckReport {
    pub primary:          BottleneckType,
    pub secondary:        Option<BottleneckType>,
    pub confidence:       f64,
    pub description:      String,
    pub impact:           String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum BottleneckType {
    None,
    Cpu,
    Gpu,
    Ram,
    Disk,
    Thermal,
    Vram,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentScore {
    pub score:            u8,            // 0–100
    pub label:            String,        // "Ótimo", "Aceitável", "Crítico"
    pub interpretation:   String,        // plain language
    pub recommendation:   Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeScore {
    pub overall:          u8,
    pub cpu:              ComponentScore,
    pub gpu:              ComponentScore,
    pub ram:              ComponentScore,
    pub disk:             ComponentScore,
    pub thermal:          ComponentScore,
    pub workload:         Workload,
    pub verdict:          String,        // "Sistema dentro do esperado" etc.
    pub bottleneck:       BottleneckReport,
    pub timestamp:        DateTime<Utc>,
}

// ── ALERTS ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id:               String,
    pub severity:         AlertSeverity,
    pub component:        String,
    pub title:            String,
    pub description:      String,
    pub impact:           String,
    pub action:           Option<String>,
    pub timestamp:        DateTime<Utc>,
    pub dismissed:        bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

// ── BENCHMARK ─────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub id:               String,
    pub timestamp:        DateTime<Utc>,
    pub workload:         Workload,
    pub cpu_score:        u32,
    pub ram_score:        u32,
    pub disk_score:       u32,
    pub overall_score:    u32,
    pub cpu_duration_ms:  u64,
    pub ram_bandwidth_gbs: f64,
    pub disk_seq_read_mbs: f64,
    pub vs_baseline_pct:  f64,   // +/- vs FORGE baseline
    pub notes:            String,
}

// ── HISTORY ───────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id:               String,
    pub timestamp:        DateTime<Utc>,
    pub forge_score:      u8,
    pub cpu_usage:        f64,
    pub ram_usage:        f64,
    pub cpu_temp:         Option<f64>,
    pub workload:         Workload,
    pub bottleneck:       BottleneckType,
}

// ── FORGE CERTIFIED ───────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeCertified {
    pub cert_id:          String,
    pub build_name:       String,
    pub certified_at:     DateTime<Utc>,
    pub cpu_brand:        String,
    pub gpu_name:         String,
    pub ram_total_gb:     f64,
    pub baseline_score:   u32,
    pub current_score:    u32,
    pub score_delta_pct:  f64,
    pub status:           CertStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CertStatus {
    Active,
    Expired,
    Degraded,
}