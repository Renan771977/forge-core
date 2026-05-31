use crate::models::*;
use chrono::Utc;
use uuid::Uuid;

// ── FORGE SCORE ENGINE ────────────────────────────────────
pub struct Analyzer;

impl Analyzer {
    /// Compute ForgeScore from a live snapshot and selected workload
    pub fn score(snap: &SystemSnapshot, workload: &Workload) -> ForgeScore {
        let cpu   = Self::score_cpu(&snap.cpu, workload);
        let gpu   = Self::score_gpu(&snap.gpu, workload);
        let ram   = Self::score_ram(&snap.ram, workload);
        let disk  = Self::score_disks(&snap.disks, workload);
        let thermal = Self::score_thermal(snap);

        let w = workload.weights();
        let overall_raw =
            (cpu.score   as f64 * w.cpu  +
             gpu.score   as f64 * w.gpu  +
             ram.score   as f64 * w.ram  +
             disk.score  as f64 * w.disk)
            .min(100.0) as u8;

        // Thermal penalty
        let overall = if thermal.score < 40 {
            (overall_raw as f64 * 0.85) as u8
        } else {
            overall_raw
        };

        let bottleneck = Self::detect_bottleneck(snap, workload);
        let verdict    = Self::verdict(overall, &bottleneck, workload);

        ForgeScore {
            overall,
            cpu,
            gpu,
            ram,
            disk,
            thermal,
            workload: workload.clone(),
            verdict,
            bottleneck,
            timestamp: Utc::now(),
        }
    }

    fn score_cpu(cpu: &CpuMetrics, workload: &Workload) -> ComponentScore {
        // High usage is expected for compute workloads; idle is bad for gaming
        let (ideal_min, ideal_max) = match workload {
            Workload::Development => (20.0, 70.0),
            Workload::AiMl | Workload::Video3d => (60.0, 95.0),
            Workload::Gaming => (30.0, 80.0),
            _ => (10.0, 80.0),
        };

        let usage = cpu.usage_percent;
        let score: u8 = if usage > 98.0 {
            30 // Saturated — bad
        } else if usage >= ideal_min && usage <= ideal_max {
            90
        } else if usage < ideal_min {
            70 // Underused — fine unless gaming
        } else {
            60 // Slightly over ideal
        };

        // Temperature penalty
        let (score, temp_note) = if let Some(t) = cpu.temperature_c {
            if t > 95.0      { ((score as f64 * 0.55) as u8, " Temperatura crítica.") }
            else if t > 85.0 { ((score as f64 * 0.75) as u8, " Temperatura elevada.") }
            else if t > 75.0 { ((score as f64 * 0.90) as u8, " Temperatura aceitável.") }
            else             { (score, "") }
        } else { (score, "") };

        let (label, interp) = Self::interpret_cpu(usage, cpu, workload, temp_note);
        let recommendation = Self::recommend_cpu(score, usage, cpu, workload);

        ComponentScore { score, label, interpretation: interp, recommendation }
    }

    fn interpret_cpu(usage: f64, cpu: &CpuMetrics, workload: &Workload, temp_note: &str) -> (String, String) {
        let label = if usage > 95.0      { "Saturado".into() }
                    else if usage > 80.0 { "Sob carga".into() }
                    else if usage > 50.0 { "Ativo".into() }
                    else                 { "Livre".into() };

        let interp = match workload {
            Workload::AiMl | Workload::Video3d => {
                if usage > 90.0 {
                    format!("CPU em {:.0}% — uso esperado para workload de renderização.{}", usage, temp_note)
                } else {
                    format!("CPU em {:.0}% — capacidade disponível para cargas paralelas.{}", usage, temp_note)
                }
            }
            Workload::Gaming => {
                if usage > 85.0 {
                    format!("CPU em {:.0}% — pode estar limitando FPS. Verifique o CPU bottleneck.{}", usage, temp_note)
                } else {
                    format!("CPU em {:.0}% — dentro do esperado para gaming.{}", usage, temp_note)
                }
            }
            Workload::Development => {
                format!("CPU em {:.0}% com {} threads disponíveis.{}", usage, cpu.thread_count, temp_note)
            }
            _ => format!("CPU em {:.0}% de utilização.{}", usage, temp_note),
        };

        (label, interp)
    }

    fn recommend_cpu(score: u8, usage: f64, cpu: &CpuMetrics, workload: &Workload) -> Option<String> {
        if score < 50 && usage > 90.0 {
            Some(format!(
                "CPU saturada. Considere fechar processos em background ou upgrade para um processador com mais cores (atual: {} cores).",
                cpu.core_count
            ))
        } else if score < 70 && matches!(workload, Workload::AiMl | Workload::Video3d) && cpu.core_count < 12 {
            Some(format!("Para workloads de renderização e IA, um CPU com 16+ cores oferece ganhos significativos. Atual: {} cores.", cpu.core_count))
        } else {
            None
        }
    }

    fn score_gpu(gpu: &GpuMetrics, workload: &Workload) -> ComponentScore {
        let usage = gpu.usage_percent;
        let (label, interp, score, rec) = match workload {
            Workload::Gaming => {
                if usage > 90.0 {
                    ("Sob carga máxima", format!("GPU em {:.0}% — utilizando toda a capacidade disponível. Esperado para gaming de alto desempenho.", usage), 85u8, None)
                } else if usage < 50.0 {
                    ("Subutilizada", format!("GPU em {:.0}% — possível gargalo na CPU ou limites de API.", usage), 55u8,
                     Some("GPU abaixo do esperado para gaming. Pode indicar gargalo de CPU.".into()))
                } else {
                    ("Ativa", format!("GPU em {:.0}% — dentro do esperado.", usage), 80u8, None)
                }
            }
            Workload::AiMl => {
                if usage > 85.0 {
                    ("Utilizando CUDA/Tensor", format!("GPU em {:.0}% — treinamento ou inferência ativo.", usage), 90u8, None)
                } else {
                    ("GPU ociosa para IA", format!("GPU em {:.0}% — workload de IA abaixo do esperado. Verifique o uso de CUDA.", usage), 50u8,
                     Some("Verifique se seu framework está usando GPU (CUDA_VISIBLE_DEVICES, device='cuda').".into()))
                }
            }
            _ => {
                ("Ativa", format!("GPU em {:.0}%.", usage), (usage as u8).min(90), None)
            }
        };

        let temp_score = if let Some(t) = gpu.temperature_c {
            if t > 90.0 { (score as f64 * 0.6) as u8 }
            else if t > 80.0 { (score as f64 * 0.85) as u8 }
            else { score }
        } else { score };

        ComponentScore {
            score: temp_score,
            label: label.into(),
            interpretation: interp,
            recommendation: rec,
        }
    }

    fn score_ram(ram: &RamMetrics, workload: &Workload) -> ComponentScore {
        let pct   = ram.usage_percent;
        let total = ram.total_gb;
        let avail = ram.available_gb;

        // Critical threshold: <1GB available
        let score: u8 = if avail < 0.5 {
            10
        } else if pct > 90.0 {
            25
        } else if pct > 80.0 {
            50
        } else if pct > 65.0 {
            70
        } else {
            90
        };

        let label = if pct > 90.0 { "Crítico" } else if pct > 75.0 { "Alto" } else { "Normal" }.into();

        let interp = match workload {
            Workload::Development => {
                if total < 16.0 {
                    format!("RAM em {:.0}% ({:.1}GB de {:.0}GB). Para desenvolvimento com containers e VMs, 32GB é o mínimo recomendado.", pct, ram.used_gb, total)
                } else {
                    format!("RAM em {:.0}% ({:.1}GB de {:.0}GB). {:.1}GB disponível para novos processos.", pct, ram.used_gb, total, avail)
                }
            }
            Workload::AiMl => {
                format!("RAM em {:.0}% ({:.1}/{:.0}GB). Para modelos LLM locais, disponibilidade de RAM impacta tamanho máximo do modelo.", pct, ram.used_gb, total)
            }
            _ => {
                format!("RAM em {:.0}% — {:.1}GB em uso, {:.1}GB disponível.", pct, ram.used_gb, avail)
            }
        };

        let recommendation = if score < 50 {
            Some(format!("Sistema com {:.0}GB total de RAM. Uso em {:.0}% indica necessidade de upgrade ou fechamento de aplicações.", total, pct))
        } else if total < 16.0 && matches!(workload, Workload::AiMl | Workload::Video3d | Workload::Development) {
            Some(format!("Upgrade para 32GB de RAM recomendado para workload de {:?}. Atual: {:.0}GB.", workload, total))
        } else {
            None
        };

        ComponentScore { score, label, interpretation: interp, recommendation }
    }

    fn score_disks(disks: &[DiskMetrics], workload: &Workload) -> ComponentScore {
        if disks.is_empty() {
            return ComponentScore {
                score: 50,
                label: "Sem dados".into(),
                interpretation: "Nenhum disco detectado.".into(),
                recommendation: None,
            };
        }

        let primary = &disks[0];
        let pct     = primary.usage_percent;

        let score: u8 = if pct > 95.0 { 10 }
                        else if pct > 85.0 { 40 }
                        else if pct > 70.0 { 65 }
                        else { 90 };

        let label = if pct > 90.0 { "Crítico" } else if pct > 75.0 { "Alto" } else { "Normal" }.into();

        let interp = match workload {
            Workload::VideoEditing | Workload::Video3d => {
                format!("Disco principal em {:.0}% ({:.0}GB de {:.0}GB). Projetos de vídeo exigem espaço livre substancial e NVMe Gen4+.", pct, primary.used_gb, primary.total_gb)
            }
            _ => {
                format!("Disco principal em {:.0}% ({:.0}GB de {:.0}GB livres).", pct, primary.total_gb - primary.used_gb, primary.total_gb)
            }
        };

        let recommendation = if score < 50 {
            Some(format!("Disco com {:.0}% de uso. Menos de 10% livre pode degradar performance do sistema. Libere espaço ou adicione armazenamento.", pct))
        } else {
            None
        };

        ComponentScore { score, label, interpretation: interp, recommendation }
    }

    fn score_thermal(snap: &SystemSnapshot) -> ComponentScore {
        let cpu_temp  = snap.cpu.temperature_c.unwrap_or(50.0);
        let gpu_temp  = snap.gpu.temperature_c.unwrap_or(50.0);
        let max_temp  = cpu_temp.max(gpu_temp);

        let (score, label, interp) = if max_temp > 95.0 {
            (10u8, "Crítico".to_string(), format!("Temperatura crítica: CPU {:.0}°C / GPU {:.0}°C. Risco de throttling ou dano.", cpu_temp, gpu_temp))
        } else if max_temp > 85.0 {
            (45u8, "Elevado".to_string(), format!("Temperatura elevada: CPU {:.0}°C / GPU {:.0}°C. Sistema pode estar sofrendo throttling.", cpu_temp, gpu_temp))
        } else if max_temp > 75.0 {
            (70u8, "Aceitável".to_string(), format!("Temperatura dentro dos limites: CPU {:.0}°C / GPU {:.0}°C.", cpu_temp, gpu_temp))
        } else {
            (95u8, "Ótimo".to_string(), format!("Temperatura excelente: CPU {:.0}°C / GPU {:.0}°C. Airflow e refrigeração operando bem.", cpu_temp, gpu_temp))
        };

        let recommendation = if score < 50 {
            Some("Verifique pasta térmica, limpeza dos coolers e fluxo de ar do gabinete. Considere upgrade de refrigeração.".into())
        } else {
            None
        };

        ComponentScore { score, label, interpretation: interp, recommendation }
    }

    pub fn detect_bottleneck(snap: &SystemSnapshot, workload: &Workload) -> BottleneckReport {
        let cpu_pct  = snap.cpu.usage_percent;
        let gpu_pct  = snap.gpu.usage_percent;
        let ram_pct  = snap.ram.usage_percent;
        let disk_pct = snap.disks.first().map(|d| d.usage_percent).unwrap_or(0.0);
        let cpu_temp = snap.cpu.temperature_c.unwrap_or(0.0);

        // Priority: thermal > resource usage
        if cpu_temp > 90.0 {
            return BottleneckReport {
                primary:     BottleneckType::Thermal,
                secondary:   Some(BottleneckType::Cpu),
                confidence:  0.95,
                description: format!("CPU em temperatura crítica ({:.0}°C). Throttling térmico em andamento.", cpu_temp),
                impact:      "Performance reduzida em até 40% enquanto a temperatura não normalizar.".into(),
            };
        }

        let weights = workload.weights();
        let cpu_pressure  = cpu_pct  * weights.cpu;
        let gpu_pressure  = gpu_pct  * weights.gpu;
        let ram_pressure  = ram_pct  * weights.ram;
        let disk_pressure = disk_pct * weights.disk;

        let max_pressure = cpu_pressure.max(gpu_pressure).max(ram_pressure).max(disk_pressure);

        if max_pressure < 30.0 {
            return BottleneckReport {
                primary:     BottleneckType::None,
                secondary:   None,
                confidence:  0.90,
                description: "Nenhum gargalo identificado. Sistema operando com folga.".into(),
                impact:      "Sistema pode absorver carga adicional sem degradação.".into(),
            };
        }

        let (primary, desc, impact) = if cpu_pressure >= max_pressure {
            (BottleneckType::Cpu,
             format!("CPU em {:.0}% — recurso mais pressionado para workload de {}.", cpu_pct, workload.label()),
             "Tarefas CPU-bound podem ter latência ou queda de FPS.".to_string())
        } else if gpu_pressure >= max_pressure {
            (BottleneckType::Gpu,
             format!("GPU em {:.0}% — limitando performance gráfica ou de inferência.", gpu_pct),
             "Render, inferência ou FPS podem estar limitados pela GPU.".to_string())
        } else if ram_pressure >= max_pressure {
            (BottleneckType::Ram,
             format!("RAM em {:.0}% — memória é o fator limitante atual.", ram_pct),
             "Sistema pode iniciar swap, causando degradação severa de performance.".to_string())
        } else {
            (BottleneckType::Disk,
             format!("Disco com {:.0}% de uso — I/O pode estar impactando performance.", disk_pct),
             "Operações de leitura/escrita podem estar criando gargalo.".to_string())
        };

        BottleneckReport {
            primary,
            secondary: None,
            confidence: 0.75,
            description: desc,
            impact,
        }
    }

    pub fn generate_alerts(snap: &SystemSnapshot) -> Vec<Alert> {
        let mut alerts = Vec::new();
        let now = Utc::now();

        if let Some(t) = snap.cpu.temperature_c {
            if t > 90.0 {
                alerts.push(Alert {
                    id:          Uuid::new_v4().to_string(),
                    severity:    AlertSeverity::Critical,
                    component:   "CPU".into(),
                    title:       format!("Temperatura crítica — {:.0}°C", t),
                    description: format!("CPU atingiu {:.0}°C. Limite de segurança é 95°C.", t),
                    impact:      "Throttling automático em andamento — performance reduzida.".into(),
                    action:      Some("Verifique refrigeração e pasta térmica imediatamente.".into()),
                    timestamp:   now,
                    dismissed:   false,
                });
            } else if t > 80.0 {
                alerts.push(Alert {
                    id:          Uuid::new_v4().to_string(),
                    severity:    AlertSeverity::Warning,
                    component:   "CPU".into(),
                    title:       format!("Temperatura elevada — {:.0}°C", t),
                    description: format!("CPU em {:.0}°C. Acima de 85°C throttling pode iniciar.", t),
                    impact:      "Performance pode ser reduzida em cargas sustentadas.".into(),
                    action:      Some("Melhore o fluxo de ar ou reaplique pasta térmica.".into()),
                    timestamp:   now,
                    dismissed:   false,
                });
            }
        }

        if snap.ram.usage_percent > 90.0 {
            alerts.push(Alert {
                id:          Uuid::new_v4().to_string(),
                severity:    AlertSeverity::Critical,
                component:   "RAM".into(),
                title:       format!("Memória crítica — {:.0}%", snap.ram.usage_percent),
                description: format!("RAM em {:.0}% ({:.1}GB de {:.0}GB). Sistema pode iniciar swap.", snap.ram.usage_percent, snap.ram.used_gb, snap.ram.total_gb),
                impact:      "Performance severa pode ser impactada. Travamentos possíveis.".into(),
                action:      Some("Feche aplicações desnecessárias. Considere upgrade de RAM.".into()),
                timestamp:   now,
                dismissed:   false,
            });
        }

        if snap.cpu.usage_percent > 95.0 {
            alerts.push(Alert {
                id:          Uuid::new_v4().to_string(),
                severity:    AlertSeverity::Warning,
                component:   "CPU".into(),
                title:       format!("CPU saturada — {:.0}%", snap.cpu.usage_percent),
                description: "CPU operando no limite. Processos competindo por tempo de execução.".into(),
                impact:      "Latência aumentada. Tarefas em background atrasadas.".into(),
                action:      Some("Identifique e feche processos com alto consumo de CPU.".into()),
                timestamp:   now,
                dismissed:   false,
            });
        }

        if let Some(disk) = snap.disks.first() {
            if disk.usage_percent > 90.0 {
                alerts.push(Alert {
                    id:          Uuid::new_v4().to_string(),
                    severity:    AlertSeverity::Warning,
                    component:   "Disco".into(),
                    title:       format!("Espaço em disco crítico — {:.0}%", disk.usage_percent),
                    description: format!("Apenas {:.1}GB livres em {}.", disk.total_gb - disk.used_gb, disk.mount_point),
                    impact:      "Sistema de arquivos cheio pode causar corrupção e travamentos.".into(),
                    action:      Some("Libere espaço ou adicione armazenamento.".into()),
                    timestamp:   now,
                    dismissed:   false,
                });
            }
        }

        alerts
    }

    fn verdict(score: u8, bottleneck: &BottleneckReport, workload: &Workload) -> String {
        if score >= 85 {
            format!("Sistema operando em excelente condição para {}.", workload.label())
        } else if score >= 70 {
            match &bottleneck.primary {
                BottleneckType::None => "Sistema dentro do esperado.".into(),
                b => format!("Performance aceitável. Gargalo identificado: {:?}.", b),
            }
        } else if score >= 50 {
            format!("Performance abaixo do ideal. {}.", bottleneck.description)
        } else {
            "Sistema com limitações críticas. Ação recomendada.".into()
        }
    }
}