# AgentDance — Implementation Progress

## Phase 1: The Soloist ✅ Complete

- Tauri + React + Tailwind desktop app
- ACP handshake: `initialize` → `session/new` → `session/prompt` with streaming responses
- Works with Claude Code (`npx @zed-industries/claude-agent-acp`) and OpenCode (`opencode acp`)
- Live plan visualization from `session/update` notifications
- Message streaming with typing cursor
- Auto-approve `session/request_permission`
- ACP debug log panel
- SQLite findings store + MCP registry stubs

## Phase 2: The Duet ✅ Complete

- Agent termination + cleanup (Stop button, kill on app exit)
- Disconnect detection (dead process → red "disconnected" badge, dimmed card)
- Per-agent conversation history (scrollable in inspector, user/agent/peer messages)
- Session persistence (save configs on exit, restore banner on reopen)
- Real fork (spawns new agent with parent's config + context prompt)
- Dynamic waypoints (add/delete/reorder, structured steering prompt on Resume Dance)
- Native directory picker

## Phase 3: The Ensemble ✅ Core Complete

### Agent registry + discovery
- In-memory `AgentRegistry` with register/remove/update_status/set_description
- Axum HTTP bridge API on localhost (random port)
- MCP bridge script (`mcp-bridge.mjs`) passed to each agent in `session/new`

### Inter-agent messaging (5 MCP tools)
- `list_agents` — discover all peers (name, status, directory, description)
- `set_description` — label what you're working on
- `notify_agent` — fire-and-forget message to a peer by name
- `ask_agent` — synchronous query with 60s timeout (oneshot channels)
- `broadcast` — message all peers (excludes self)

### Communication visualization
- Mesh comms panel (tabbed: Mesh / ACP Debug) with chronological message log
- Color-coded kind badges: blue=notify, amber=ask, purple=broadcast, green=response
- Purple peer message indicators on agent cards
- Inspector history distinguishes user (blue), agent (gray), peer (purple) messages

### God Prompt omnibar
- Cmd+K opens overlay, broadcasts to all active agents
- Shows count of active agents, Esc to close

### Not yet implemented
- MCP Bridge (central tool proxy for registered MCP servers)
- Epistemic Shared Memory (vector search on findings)
- Visual handoff tethers between communicating agents on Stage
- Agent-to-agent capability discovery / dynamic sub-contracting
