#  FORGE — Performance Computing

FORGE é uma aplicação desktop de monitoramento de hardware de alto desempenho, diagnóstico de gargalos e certificação de builds. Desenvolvido para entusiastas, profissionais de renderização 3D, desenvolvedores e gamers, o software oferece uma visão em tempo real e em profundidade dos recursos do sistema (CPU, GPU, RAM, Disco e Térmica).

---

##  Principais Funcionalidades

* **Monitoramento em Tempo Real:** Telemetria de baixa latência de uso, frequência e temperatura de CPU (por núcleo), VRAM da GPU, RAM e Discos NVMe/SSD.
* **Detecção de Gargalos (Bottleneck):** Algoritmo inteligente que analisa o hardware e indica qual componente está limitando o desempenho da máquina.
* **Perfis de Workload:** Adapta o sistema de pontuação (FORGE Score) com base na atividade principal do usuário (Gaming, Render 3D, IA/Machine Learning, Desenvolvimento, Edição de Vídeo).
* **Benchmark & Histórico:** Testes de estresse padronizados para avaliar o sistema e manter um histórico completo de performance ao longo do tempo.
* **FORGE Certified:** Crie "snapshots" do seu hardware gerando um certificado único da sua máquina para comparar degradações futuras ou validar o seu build.
* **Autenticação em Nuvem:** Sistema de login seguro integrado com Supabase.

---

##  Tecnologias Utilizadas

O ecossistema FORGE foi construído utilizando uma arquitetura híbrida de máxima performance:

### Frontend (Interface Gráfica)
* **[React 18](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**: Motor de reatividade e tipagem estática.
* **[Vite](https://vitejs.dev/)**: Ferramenta de build extremamente rápida.
* **[Tailwind CSS](https://tailwindcss.com/)**: Estilização utilitária avançada e tema dark dinâmico.
* **[Recharts](https://recharts.org/)**: Renderização de gráficos de telemetria ao vivo.

### Backend (Motor de Sistema)
* **[Tauri V1](https://tauri.app/)**: Framework ultraleve para criação de apps desktop usando tecnologias web.
* **[Rust](https://www.rust-lang.org/)**: Linguagem de programação focada em segurança e performance para acesso de baixo nível ao hardware (leituras de BIOS, sensores térmicos e processos OS).

### Banco de Dados & Autenticação
* **[Supabase](https://supabase.com/)**: Backend-as-a-Service (PostgreSQL) para gestão segura de usuários e persistência de telemetria.

---

##  Pré-requisitos e Instalação

Para rodar ou compilar o FORGE localmente, você precisará ter instalado em sua máquina:
1. [Node.js](https://nodejs.org/) (v16 ou superior)
2. [Rust e Cargo](https://www.rust-lang.org/tools/install)
3. Pré-requisitos do SO para o Tauri (Build Tools do C++ no Windows).

### Passo a passo de instalação:

**1. Clone o repositório**
```bash
git clone [https://github.com/Renan771977/forge-core.git]
cd forge-software

**2. instale as dependências do Frontend

npm install

3. Configure o Supabase
Abra o arquivo src/supabase.ts e certifique-se de que a URL e a Anon Key do seu banco de dados estão configuradas corretamente:

const supabaseUrl = '[https://SEU-PROJETO.supabase.co](https://SEU-PROJETO.supabase.co)';
const supabaseAnonKey = 'SUA-ANON-KEY-PUBLICA';

execute o ambiente de desenvolvimento 

npx tauri dev

Compilando para Produção (Instaladores)
Para gerar o instalador final do software (.exe ou .msi para Windows), execute:

npx tauri build
```

## 📂 Estrutura do Projeto

*  **`forge-software/`**
  *  **`src/`** — *Frontend React/TS*
    *  **`components/`** — *Componentes isolados (Dashboard, Monitor, etc.)*
    *  **`hooks/`** — *Custom Hooks (Comunicação Tauri <-> React)*
    *  **`types/`** — *Tipagens globais do TypeScript*
    *  **`App.tsx`** — *Roteador central e Topbar*
    *  **`supabase.ts`** — *Conexão com o banco de dados*
  *  **`src-tauri/`** — *Backend Rust*
    *  **`src/`** — *Motor de telemetria e Comandos Tauri*
    *  **`Cargo.toml`** — *Dependências do Rust*
    *  **`tauri.conf.json`** — *Configurações da janela do software*
  *  **`package.json`** — *Dependências do Node*
  *  **`tailwind.config.cjs`** — *Temas e cores personalizadas do FORGE*

## Segurança e Privacidade

A FORGE utiliza leituras de hardware de baixo nível. Nenhuma informação pessoal ou arquivos de disco são enviados para os servidores. A telemetria salva no Supabase (quando ativada pelo usuário) serve estritamente para manter o histórico de performance e certificação do hardware atrelado ao e-mail de login.

Desenvolvido com excelência e focado em performance.