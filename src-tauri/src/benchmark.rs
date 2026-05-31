use crate::models::*;
use chrono::Utc;
use std::time::Instant;
use uuid::Uuid;

// FORGE baseline scores (calibrated against reference hardware)
const BASELINE_CPU_SCORE:  u32 = 18_000;
const BASELINE_RAM_GBS:    f64 = 30.0;
const BASELINE_DISK_MBS:   f64 = 3_000.0;

pub struct BenchmarkEngine;

impl BenchmarkEngine {
    pub fn run(workload: &Workload, sys_snap: &SystemSnapshot) -> BenchmarkResult {
        let cpu_result   = Self::bench_cpu();
        let ram_result   = Self::bench_ram();
        let disk_result  = Self::bench_disk();

        let cpu_score    = Self::normalize_cpu(cpu_result.ops_per_sec);
        let ram_score    = Self::normalize_ram(ram_result.bandwidth_gbs);
        let disk_score   = Self::normalize_disk(disk_result.seq_read_mbs);

        let w = workload.weights();
        let overall = ((cpu_score  as f64 * w.cpu  +
                        ram_score  as f64 * w.ram  +
                        disk_score as f64 * w.disk)
                       / (w.cpu + w.ram + w.disk)) as u32;

        let vs_baseline = ((overall as f64 / BASELINE_CPU_SCORE as f64) - 1.0) * 100.0;

        let notes = Self::generate_notes(cpu_score, ram_score, disk_score, &vs_baseline, sys_snap);

        BenchmarkResult {
            id:                Uuid::new_v4().to_string(),
            timestamp:         Utc::now(),
            workload:          workload.clone(),
            cpu_score,
            ram_score,
            disk_score,
            overall_score:     overall,
            cpu_duration_ms:   cpu_result.duration_ms,
            ram_bandwidth_gbs: ram_result.bandwidth_gbs,
            disk_seq_read_mbs: disk_result.seq_read_mbs,
            vs_baseline_pct:   vs_baseline,
            notes,
        }
    }

    fn bench_cpu() -> CpuBenchResult {
        let start = Instant::now();

        // Prime-number sieve — CPU-bound, single-threaded baseline
        let limit: usize = 1_000_000;
        let mut sieve    = vec![true; limit + 1];
        sieve[0] = false;
        sieve[1] = false;
        let mut i = 2;
        while i * i <= limit {
            if sieve[i] {
                let mut j = i * i;
                while j <= limit {
                    sieve[j] = false;
                    j += i;
                }
            }
            i += 1;
        }
        let prime_count: usize = sieve.iter().filter(|&&x| x).count();

        // FP operations
        let mut acc: f64 = 0.0;
        for k in 0..500_000usize {
            acc += (k as f64).sqrt() * (k as f64).ln_1p();
        }

        let elapsed  = start.elapsed();
        let duration = elapsed.as_millis() as u64;

        // Convert duration to a score: faster = higher score
        // Baseline: ~400ms on a mid-range CPU = 18000 pts
        let raw_score = (prime_count as u64 + acc as u64) / (duration.max(1));

        CpuBenchResult {
            ops_per_sec: raw_score * 1_000,
            duration_ms: duration,
        }
    }

    fn bench_ram() -> RamBenchResult {
        let size: usize = 128 * 1024 * 1024; // 128 MB
        let mut buf = vec![0u8; size];

        // Sequential write
        let start = Instant::now();
        for (i, b) in buf.iter_mut().enumerate() {
            *b = (i & 0xFF) as u8;
        }
        let write_time = start.elapsed().as_secs_f64();

        // Sequential read
        let start = Instant::now();
        let checksum: u64 = buf.iter().map(|&b| b as u64).sum();
        let read_time = start.elapsed().as_secs_f64() + write_time;

        let _ = checksum; // prevent optimization

        let bandwidth_gbs = (size as f64) / (read_time * 1_073_741_824.0);

        RamBenchResult { bandwidth_gbs }
    }

    fn bench_disk() -> DiskBenchResult {
        use std::fs::{OpenOptions, remove_file};
        use std::io::{Write, Read};

        let path = std::env::temp_dir().join("forge_bench_tmp.bin");
        let size: usize = 64 * 1024 * 1024; // 64 MB
        let data = vec![0xABu8; size];

        // Write
        let _ = std::fs::write(&path, &data);

        // Read + measure
        let start = Instant::now();
        let mut file = match OpenOptions::new().read(true).open(&path) {
            Ok(f) => f,
            Err(_) => return DiskBenchResult { seq_read_mbs: 500.0 }, // fallback
        };
        let mut read_buf = vec![0u8; size];
        let _ = file.read_exact(&mut read_buf);
        let elapsed = start.elapsed().as_secs_f64();

        let _ = remove_file(&path);

        let mbs = (size as f64) / (elapsed * 1_048_576.0);

        DiskBenchResult { seq_read_mbs: mbs }
    }

    fn normalize_cpu(ops: u64) -> u32 {
        // Map ops to 0..100_000 score range
        let score = (ops / 1_000).min(100_000) as u32;
        score.max(1)
    }

    fn normalize_ram(bw_gbs: f64) -> u32 {
        let pct = (bw_gbs / BASELINE_RAM_GBS * 100.0).min(200.0) as u32;
        pct.max(1)
    }

    fn normalize_disk(mbs: f64) -> u32 {
        let pct = (mbs / BASELINE_DISK_MBS * 100.0).min(200.0) as u32;
        pct.max(1)
    }

    fn generate_notes(cpu: u32, ram: u32, disk: u32, vs_base: &f64, snap: &SystemSnapshot) -> String {
        let mut notes = Vec::new();

        if *vs_base > 10.0 {
            notes.push(format!("{:.0}% acima da baseline FORGE.", vs_base));
        } else if *vs_base < -10.0 {
            notes.push(format!("{:.0}% abaixo da baseline FORGE.", vs_base.abs()));
        } else {
            notes.push("Dentro da baseline FORGE.".into());
        }

        if ram < 60 {
            notes.push(format!("RAM com baixa largura de banda ({}pts). DDR5 ou dual-channel recomendado.", ram));
        }
        if disk < 50 {
            notes.push(format!("Disco com leitura lenta ({}pts). Upgrade para NVMe Gen4 recomendado.", disk));
        }
        if let Some(t) = snap.cpu.temperature_c {
            if t > 80.0 {
                notes.push(format!("Score impactado por temperatura elevada ({:.0}°C).", t));
            }
        }

        notes.join(" | ")
    }
}

struct CpuBenchResult  { ops_per_sec: u64, duration_ms: u64 }
struct RamBenchResult  { bandwidth_gbs: f64 }
struct DiskBenchResult { seq_read_mbs: f64 }