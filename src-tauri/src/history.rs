use rusqlite::{Connection, params};
use crate::models::*;
use chrono::Utc;
use uuid::Uuid;
use anyhow::Result;

pub struct HistoryStore {
    conn: Connection,
}

impl HistoryStore {
    pub fn open(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS history (
                id           TEXT PRIMARY KEY,
                timestamp    TEXT NOT NULL,
                forge_score  INTEGER NOT NULL,
                cpu_usage    REAL NOT NULL,
                ram_usage    REAL NOT NULL,
                cpu_temp     REAL,
                workload     TEXT NOT NULL,
                bottleneck   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS benchmarks (
                id               TEXT PRIMARY KEY,
                timestamp        TEXT NOT NULL,
                workload         TEXT NOT NULL,
                cpu_score        INTEGER NOT NULL,
                ram_score        INTEGER NOT NULL,
                disk_score       INTEGER NOT NULL,
                overall_score    INTEGER NOT NULL,
                vs_baseline_pct  REAL NOT NULL,
                notes            TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS certified (
                cert_id          TEXT PRIMARY KEY,
                build_name       TEXT NOT NULL,
                certified_at     TEXT NOT NULL,
                cpu_brand        TEXT NOT NULL,
                gpu_name         TEXT NOT NULL,
                ram_total_gb     REAL NOT NULL,
                baseline_score   INTEGER NOT NULL,
                current_score    INTEGER NOT NULL,
                score_delta_pct  REAL NOT NULL,
                status           TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_history_ts ON history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_bench_ts   ON benchmarks(timestamp);
        ")?;
        Ok(())
    }

    pub fn record_snapshot(&self, score: &ForgeScore, snap: &SystemSnapshot) -> Result<()> {
        self.conn.execute(
            "INSERT INTO history (id, timestamp, forge_score, cpu_usage, ram_usage, cpu_temp, workload, bottleneck)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                Uuid::new_v4().to_string(),
                Utc::now().to_rfc3339(),
                score.overall as i32,
                snap.cpu.usage_percent,
                snap.ram.usage_percent,
                snap.cpu.temperature_c,
                serde_json::to_string(&score.workload)?,
                serde_json::to_string(&score.bottleneck.primary)?,
            ],
        )?;
        Ok(())
    }

    pub fn save_benchmark(&self, result: &BenchmarkResult) -> Result<()> {
        self.conn.execute(
            "INSERT INTO benchmarks
             (id, timestamp, workload, cpu_score, ram_score, disk_score, overall_score, vs_baseline_pct, notes)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                result.id,
                result.timestamp.to_rfc3339(),
                serde_json::to_string(&result.workload)?,
                result.cpu_score as i32,
                result.ram_score as i32,
                result.disk_score as i32,
                result.overall_score as i32,
                result.vs_baseline_pct,
                result.notes,
            ],
        )?;
        Ok(())
    }

    pub fn get_history(&self, limit: usize) -> Result<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, timestamp, forge_score, cpu_usage, ram_usage, cpu_temp, workload, bottleneck
             FROM history ORDER BY timestamp DESC LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(HistoryEntry {
                id:          row.get(0)?,
                timestamp:   row.get::<_, String>(1)?.parse().unwrap_or(Utc::now()),
                forge_score: row.get::<_, i32>(2)? as u8,
                cpu_usage:   row.get(3)?,
                ram_usage:   row.get(4)?,
                cpu_temp:    row.get(5)?,
                workload:    serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
                bottleneck:  serde_json::from_str(&row.get::<_, String>(7)?).unwrap_or(BottleneckType::None),
            })
        })?;

        let mut entries = Vec::new();
        for row in rows { entries.push(row?); }
        Ok(entries)
    }

    pub fn get_benchmarks(&self, limit: usize) -> Result<Vec<BenchmarkResult>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, timestamp, workload, cpu_score, ram_score, disk_score,
                    overall_score, vs_baseline_pct, notes
             FROM benchmarks ORDER BY timestamp DESC LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(BenchmarkResult {
                id:                row.get(0)?,
                timestamp:         row.get::<_, String>(1)?.parse().unwrap_or(Utc::now()),
                workload:          serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default(),
                cpu_score:         row.get::<_, i32>(3)? as u32,
                ram_score:         row.get::<_, i32>(4)? as u32,
                disk_score:        row.get::<_, i32>(5)? as u32,
                overall_score:     row.get::<_, i32>(6)? as u32,
                cpu_duration_ms:   0,
                ram_bandwidth_gbs: 0.0,
                disk_seq_read_mbs: 0.0,
                vs_baseline_pct:   row.get(7)?,
                notes:             row.get(8)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows { results.push(row?); }
        Ok(results)
    }

    pub fn upsert_certified(&self, cert: &ForgeCertified) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO certified
             (cert_id, build_name, certified_at, cpu_brand, gpu_name, ram_total_gb,
              baseline_score, current_score, score_delta_pct, status)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                cert.cert_id, cert.build_name,
                cert.certified_at.to_rfc3339(),
                cert.cpu_brand, cert.gpu_name, cert.ram_total_gb,
                cert.baseline_score as i32, cert.current_score as i32,
                cert.score_delta_pct,
                serde_json::to_string(&cert.status)?,
            ],
        )?;
        Ok(())
    }

    pub fn get_certified(&self) -> Result<Option<ForgeCertified>> {
        let mut stmt = self.conn.prepare(
            "SELECT cert_id, build_name, certified_at, cpu_brand, gpu_name, ram_total_gb,
                    baseline_score, current_score, score_delta_pct, status
             FROM certified ORDER BY certified_at DESC LIMIT 1"
        )?;

        let mut rows = stmt.query_map([], |row| {
            Ok(ForgeCertified {
                cert_id:         row.get(0)?,
                build_name:      row.get(1)?,
                certified_at:    row.get::<_, String>(2)?.parse().unwrap_or(Utc::now()),
                cpu_brand:       row.get(3)?,
                gpu_name:        row.get(4)?,
                ram_total_gb:    row.get(5)?,
                baseline_score:  row.get::<_, i32>(6)? as u32,
                current_score:   row.get::<_, i32>(7)? as u32,
                score_delta_pct: row.get(8)?,
                status:          serde_json::from_str(&row.get::<_, String>(9)?).unwrap_or(CertStatus::Active),
            })
        })?;

        Ok(rows.next().and_then(|r| r.ok()))
    }
}