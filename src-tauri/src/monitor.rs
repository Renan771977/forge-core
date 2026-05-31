use sysinfo::{System, Disks, Components, CpuRefreshKind, RefreshKind, MemoryRefreshKind};
use crate::models::*; 
use nvml_wrapper::Nvml;
use wmi::{COMLibrary, WMIConnection};
use serde::Deserialize;

// ── O MOTOR DE MONITORIZAÇÃO ──────────────────────────────
pub struct MonitorEngine {
    pub sys: System,
}

impl MonitorEngine {
    pub fn new() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(sysinfo::ProcessRefreshKind::everything()),
        );
        Self { sys }
    }

    pub fn snapshot(&mut self) -> SystemSnapshot {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        self.sys.refresh_processes();

        let disks      = Disks::new_with_refreshed_list();
        let components = Components::new_with_refreshed_list();

        // CPU
        let cpus = self.sys.cpus();
        let brand = cpus.first().map(|c| c.brand().trim().to_string()).unwrap_or_else(|| "CPU Desconhecido".into());
        let per_core: Vec<f64> = cpus.iter().map(|c| c.cpu_usage() as f64).collect();
        let usage_percent = if per_core.is_empty() { self.sys.global_cpu_info().cpu_usage() as f64 } else { per_core.iter().sum::<f64>() / per_core.len() as f64 };
        let frequency_mhz = cpus.first().map(|c| c.frequency()).unwrap_or(0);
        
        let mut temperature_c = None;
        for c in components.iter() {
            let label = c.label().to_lowercase();
            if label.contains("cpu") || label.contains("package") || label.contains("tctl") || label.contains("k10temp") || label.contains("coretemp") {
                temperature_c = Some(c.temperature() as f64);
                break;
            }
        }
        if temperature_c.is_none() {
            temperature_c = components.iter().find(|c| c.temperature() > 0.0).map(|c| c.temperature() as f64);
        }

        let cpu = CpuMetrics { brand, usage_percent, frequency_mhz, core_count: self.sys.physical_core_count().unwrap_or(per_core.len()), thread_count: per_core.len(), temperature_c, per_core_usage: per_core };

        // RAM
        let total_gb     = self.sys.total_memory() as f64 / 1_073_741_824.0;
        let used_gb      = self.sys.used_memory() as f64 / 1_073_741_824.0;
        let available_gb = self.sys.available_memory() as f64 / 1_073_741_824.0;
        let ram = RamMetrics { 
            total_gb, 
            used_gb, 
            available_gb, 
            usage_percent: if total_gb > 0.0 { (used_gb / total_gb) * 100.0 } else { 0.0 }, 
            swap_total_gb: self.sys.total_swap() as f64 / 1_073_741_824.0, 
            swap_used_gb: self.sys.used_swap() as f64 / 1_073_741_824.0,
            speed_mhz: None,
        };

        // Discos
        let disk_list: Vec<DiskMetrics> = disks.iter().map(|d| {
            let total = d.total_space() as f64 / 1_073_741_824.0;
            let avail = d.available_space() as f64 / 1_073_741_824.0;
            let used  = (total - avail).max(0.0);
            DiskMetrics { 
                name: d.name().to_string_lossy().to_string(), 
                mount_point: d.mount_point().to_string_lossy().to_string(), 
                total_gb: total, 
                used_gb: used, 
                usage_percent: if total > 0.0 { (used / total) * 100.0 } else { 0.0 }, 
                disk_type: format!("{:?}", d.kind()),
                read_speed_mbs: None,
                write_speed_mbs: None,
            }
        }).collect();

        // Processos
        let mut procs: Vec<ProcessInfo> = self.sys.processes().values().map(|p| ProcessInfo {
            pid:       p.pid().as_u32(),
            name:      p.name().to_string(),
            cpu_usage: p.cpu_usage() as f64,
            ram_usage_mb: p.memory() as f64 / 1_048_576.0,
            category:  ProcessCategory::System,
        }).collect();
        procs.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
        procs.truncate(10);

        // A GPU MÁGICA HÍBRIDA
        let gpu = get_hybrid_gpu();

        SystemSnapshot { 
            timestamp: chrono::Utc::now(),
            cpu, 
            gpu, 
            ram, 
            disks: disk_list, 
            active_processes: procs, 
            hostname: System::host_name().unwrap_or_default(), 
            os_name: System::long_os_version().unwrap_or_else(|| System::name().unwrap_or_default()), 
            uptime_secs: System::uptime() 
        }
    }
}

// ── LEITOR HÍBRIDO DE GPU (NVIDIA + AMD) ─────────────────
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32VideoController {
    name: Option<String>,
    driver_version: Option<String>,
}

fn get_hybrid_gpu() -> GpuMetrics {
    // PLANO A: Tenta o motor exclusivo da NVIDIA (Detalhes máximos)
    if let Ok(nvml) = Nvml::init() {
        if let Ok(device) = nvml.device_by_index(0) {
            let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".into());
            let mem = device.memory_info();
            let vram_total_mb = mem.as_ref().map(|m| m.total / 1_048_576).unwrap_or(0) as u64;
            let vram_used_mb = mem.as_ref().map(|m| m.used / 1_048_576).unwrap_or(0) as u64;
            
            let util = device.utilization_rates();
            let usage_percent = util.as_ref().map(|u| u.gpu as f64).unwrap_or(0.0);
            
            let temp = device.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu).ok().map(|t| t as f64);
            let power_watts = device.power_usage().ok().map(|p| p as f64 / 1000.0);
            let driver_version = nvml.sys_driver_version().unwrap_or_else(|_| "N/A".into());

            return GpuMetrics {
                name,
                usage_percent,
                vram_used_mb,
                vram_total_mb,
                temperature_c: temp,
                power_watts,
                driver_version,
                available: true,
            };
        }
    }

    if let Ok(com_con) = COMLibrary::new() {
        if let Ok(wmi_con) = WMIConnection::new(com_con) {
            let query = "SELECT Name, DriverVersion FROM Win32_VideoController";
            if let Ok(results) = wmi_con.raw_query::<Win32VideoController>(query) {
                for gpu in results.into_iter() {
                    let name = gpu.name.unwrap_or_else(|| "GPU Detectada".into());
                    // Descarta placas de acesso remoto padrão do Windows
                    if !name.contains("Remote") && !name.contains("Basic") {
                        return GpuMetrics {
                            name,
                            usage_percent: 0.0,
                            vram_used_mb: 0,
                            vram_total_mb: 0, 
                            temperature_c: None,
                            power_watts: None,
                            driver_version: gpu.driver_version.unwrap_or_else(|| "N/A".into()),
                            available: true, // Acende o painel da FORGE!
                        };
                    }
                }
            }
        }
    }

    // PLANO C: Se falhar completamente (Integrada ou driver em falta)
    GpuMetrics {
        name: "Não detectada / Integrada".to_string(),
        usage_percent: 0.0,
        vram_used_mb: 0,
        vram_total_mb: 0,
        temperature_c: None,
        power_watts: None,
        driver_version: "N/A".to_string(),
        available: false,
    }
}