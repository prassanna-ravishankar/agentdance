# agentdance

Multi-agent orchestration desktop app. Agents discover each other, communicate, and collaborate on codebases via ACP (Agent Client Protocol).

## Architecture

```
React/TypeScript UI (Vite + Tailwind)
    ↕ Tauri IPC (commands + events)
Rust Backend (Tokio async)
    ↕ JSON-RPC stdin/stdout (ACP protocol)
Agent Processes (Claude Code ACP, OpenCode, etc.)
    ↕ MCP stdio
mcp-bridge.mjs (provides collaboration tools)
    ↕ HTTP localhost
Axum Bridge API (registry, messaging, memory)
```

## Commands

```bash
npm run dev              # Start Vite dev server (port 1420)
npm run tauri dev        # Start Tauri app in dev mode (runs both Vite + Rust)
npm run build            # Build frontend (tsc + vite)
npm run tauri build      # Build production Tauri app (.dmg/.AppImage/.msi)
npx tsc --noEmit         # TypeScript check
cd src-tauri && cargo check  # Rust check
```

## Key Backend Files (src-tauri/src/)

- `lib.rs` — Tauri commands: `connect_agent` (ACP handshake), `send_agent_input`, `stop_agent`, `set_orchestrator`, `fork_session`. Stdout reader parses plan updates, message chunks, permission requests.
- `process_manager.rs` — Owns agent child processes, stdin handles, session IDs, spawn configs. `send_prompt()` builds and sends JSON-RPC session/prompt messages.
- `registry.rs` — In-memory agent registry. Tracks name, directory, status, description, orchestrator designation.
- `bridge_api.rs` — Axum HTTP server on localhost (random port). Endpoints: `/agents`, `/set_description`, `/notify`, `/ask`, `/broadcast`, `/memory/write`, `/memory/read`, `/spawn`. Emits `agent-comm` Tauri events for UI.
- `pending_queries.rs` — Oneshot channels for synchronous `ask_agent` queries with 60s timeout.
- `memory.rs` — SQLite-backed shared memory. Tags, keyword search, per-agent filtering.
- `mcp_host.rs` — MCP registry stub (future: central tool proxy).

## Key Frontend Files (src/)

- `App.tsx` — Main controller. State: agents, orchestratorId, logs, comms, savedSessions, omnibar. Event listeners for agent-update, agent-log, agent-comm, orchestrator-changed, spawn-agent.
- `components/Stage.tsx` — Grid of agent cards with plan progress, status, peer message badges.
- `components/AgentInspector.tsx` — Modal: waypoint editing, conversation history, delegation panel (orchestrator), direct commands, stop/fork actions.
- `components/WelcomeScreen.tsx` — First-run onboarding. One-click spawn flow.
- `components/SpawnModal.tsx` — Agent type selection + directory picker.
- `lib/types.ts` — TypeScript interfaces: Agent, AgentPlan, HistoryEntry, CommEvent, SpawnConfig.
- `lib/planUtils.ts` — `getPlanProgress()` helper.
- `lib/cn.ts` — `cn()` classname utility (clsx + tailwind-merge).

## MCP Bridge (mcp-bridge.mjs)

Node.js MCP stdio server bundled as a Tauri resource. Passed to each agent in `session/new` mcpServers. Provides 8 tools:

1. `list_agents` — discover peers
2. `set_description` — self-label
3. `notify_agent` — fire-and-forget message
4. `ask_agent` — synchronous query (60s timeout)
5. `broadcast` — message all peers
6. `write_shared_memory` — persist findings with tags
7. `read_shared_memory` — search shared context
8. `spawn_sub_agent` — programmatically spawn new agents

## Code Style

- Rust: edition 2021, async with Tokio, serde for serialization
- TypeScript: strict mode, React 19 with hooks, Tailwind v4
- Imports: Rust uses `mod` declarations in lib.rs; TypeScript uses named imports
- No unnecessary comments — code should be self-explanatory
- Extract before duplicating — shared helpers in `planUtils.ts`, `cn.ts`, `ProcessManager::send_prompt()`
- State derived where possible (e.g. `orchestratorId` is a single string, not a boolean on every agent)
- History capped at 200 entries to prevent unbounded growth

## External Docs

- ACP Protocol: https://agentclientprotocol.com
- Claude Code ACP adapter: https://github.com/zed-industries/claude-agent-acp
- MCP Protocol: https://modelcontextprotocol.io
- Tauri v2: https://v2.tauri.app
- Axum: https://docs.rs/axum/latest/axum/
