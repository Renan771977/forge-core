#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod monitor;
mod analyzer;
mod benchmark;
mod history;

use models::*;
use monitor::MonitorEngine;
use analyzer::Analyzer;
use benchmark::BenchmarkEngine;
use history::HistoryStore;

use std::sync::Mutex;
use tauri::{State, Manager};
use uuid::Uuid;
use chrono::Utc;

struct AppState {
    monitor:  Mutex<MonitorEngine>,
    history:  Mutex<HistoryStore>,
    workload: Mutex<Workload>,
}

#[tauri::command]
async fn get_snapshot(state: State<'_, AppState>) -> Result<SystemSnapshot, String> {
    let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
    Ok(engine.snapshot())
}

#[tauri::command]
async fn set_workload(workload: Workload, state: State<'_, AppState>) -> Result<(), String> {
    let mut w = state.workload.lock().map_err(|e| e.to_string())?;
    *w = workload;
    Ok(())
}

#[tauri::command]
async fn get_workload(state: State<'_, AppState>) -> Result<Workload, String> {
    let w = state.workload.lock().map_err(|e| e.to_string())?;
    Ok(w.clone())
}

#[tauri::command]
async fn get_forge_score(state: State<'_, AppState>) -> Result<ForgeScore, String> {
    let snap = {
        let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
        engine.snapshot()
    };
    let workload = {
        let w = state.workload.lock().map_err(|e| e.to_string())?;
        w.clone()
    };

    let score = Analyzer::score(&snap, &workload);

    if let Ok(hist) = state.history.lock() {
        let _ = hist.record_snapshot(&score, &snap);
    }

    Ok(score)
}

#[tauri::command]
async fn get_alerts(state: State<'_, AppState>) -> Result<Vec<Alert>, String> {
    let snap = {
        let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
        engine.snapshot()
    };
    Ok(Analyzer::generate_alerts(&snap))
}

#[tauri::command]
async fn detect_bottleneck(state: State<'_, AppState>) -> Result<BottleneckReport, String> {
    let snap = {
        let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
        engine.snapshot()
    };
    let workload = {
        let w = state.workload.lock().map_err(|e| e.to_string())?;
        w.clone()
    };
    Ok(Analyzer::detect_bottleneck(&snap, &workload))
}

#[tauri::command]
async fn run_benchmark(state: State<'_, AppState>) -> Result<BenchmarkResult, String> {
    let snap = {
        let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
        engine.snapshot()
    };
    let workload = {
        let w = state.workload.lock().map_err(|e| e.to_string())?;
        w.clone()
    };

    let result = tokio::task::spawn_blocking(move || {
        BenchmarkEngine::run(&workload, &snap)
    }).await.map_err(|e| e.to_string())?;

    if let Ok(hist) = state.history.lock() {
        let _ = hist.save_benchmark(&result);
    }

    Ok(result)
}

#[tauri::command]
async fn get_history(limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<HistoryEntry>, String> {
    let hist = state.history.lock().map_err(|e| e.to_string())?;
    hist.get_history(limit.unwrap_or(200)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_benchmark_history(state: State<'_, AppState>) -> Result<Vec<BenchmarkResult>, String> {
    let hist = state.history.lock().map_err(|e| e.to_string())?;
    hist.get_benchmarks(50).map_err(|e| e.to_string())
}

#[tauri::command]
async fn certify_build(build_name: String, state: State<'_, AppState>) -> Result<ForgeCertified, String> {
    let snap = {
        let mut engine = state.monitor.lock().map_err(|e| e.to_string())?;
        engine.snapshot()
    };
    let workload = {
        let w = state.workload.lock().map_err(|e| e.to_string())?;
        w.clone()
    };
    let score   = Analyzer::score(&snap, &workload);
    let bench   = tokio::task::spawn_blocking({
        let snap = snap.clone();
        let w    = workload.clone();
        move || BenchmarkEngine::run(&w, &snap)
    }).await.map_err(|e| e.to_string())?;

    let cert = ForgeCertified {
        cert_id:         format!("FRG-{}", &Uuid::new_v4().to_string()[..8].to_uppercase()),
        build_name,
        certified_at:    Utc::now(),
        cpu_brand:       snap.cpu.brand.clone(),
        gpu_name:        snap.gpu.name.clone(),
        ram_total_gb:    snap.ram.total_gb,
        baseline_score:  bench.overall_score,
        current_score:   bench.overall_score,
        score_delta_pct: 0.0,
        status:          CertStatus::Active,
    };

    let hist = state.history.lock().map_err(|e| e.to_string())?;
    hist.upsert_certified(&cert).map_err(|e| e.to_string())?;
    Ok(cert)
}

#[tauri::command]
async fn get_certified(state: State<'_, AppState>) -> Result<Option<ForgeCertified>, String> {
    let hist = state.history.lock().map_err(|e| e.to_string())?;
    hist.get_certified().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .setup(|app| {
            // A nossa pasta do banco de dados mantida em segurança!
            let db_path = app.path_resolver().app_config_dir().unwrap().join("forge.db");
            if let Some(parent_dir) = db_path.parent() {
                std::fs::create_dir_all(parent_dir).unwrap();
            }
            let db_path_str = db_path.to_string_lossy().to_string();

            app.manage(AppState {
                monitor:  Mutex::new(MonitorEngine::new()),
                history:  Mutex::new(
                    HistoryStore::open(&db_path_str)
                        .expect("Failed to open FORGE database")
                ),
                workload: Mutex::new(Workload::General),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            set_workload,
            get_workload,
            get_forge_score,
            get_alerts,
            detect_bottleneck,
            run_benchmark,
            get_history,
            get_benchmark_history,
            certify_build,
            get_certified,
        ])
        .run(tauri::generate_context!())
        .expect("FORGE failed to start");
}

fn main() { run(); }