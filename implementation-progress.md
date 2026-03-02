# AgentDance — Implementation Progress

## Phase 1: The Soloist ✅ Complete

Goal: a live-updating desktop UI connected to a real agent.

**Done:**
- Tauri + React + Tailwind app scaffolded
- ACP handshake implemented in Rust: `initialize` → `session/new` (sequential, waits for each response before sending the next)
- Works with both **Claude Code** (`npx @zed-industries/claude-agent-acp`) and **OpenCode** (`opencode acp`)
- `session/prompt` sends user messages; streaming `agent_message_chunk` responses shown live on agent cards with a blinking cursor
- `session/update` plan notifications parsed — `entries[].content` and `entries[].status` rendered as a task list on the card
- Agent cards show status (`idle` / `busy`), last-active timestamp, agent ID
- 200ms idle transition delay handles agents that send message chunks after `stopReason` (OpenCode behaviour)
- ACP debug log panel (bottom of screen) shows raw stdin/stdout/stderr per agent for diagnostics
- SQLite-backed findings store (`memory.rs`) wired as a Tauri command (`commit_finding`)
- MCP registry stub (`mcp_host.rs`) in place

**Not yet done in Phase 1:**
- Conversation history per agent (cards show only the current/last response)
- Agent disconnect detection (dead process looks frozen-idle)
- Message buffer doesn't reset between turns (second reply appends to first)

**Done (post-Phase 1 correctness):**
- ✅ Auto-approve `session/request_permission`: backend detects the JSON-RPC permission request notification, immediately responds with `allow_always`, preventing agents from silently stalling mid-task

---

## Phase 2: The Duet 🔄 In Progress

Goal: multi-agent workspace with steering and forking.

**Partially done:**
- Multiple agents can be spawned simultaneously (each gets its own process, session ID, stdin handle)
- `AgentInspector` modal has a "Fork Trajectory" button and a plan-edit UI
- `fork_session` Tauri command exists

**Stubs / not wired:**
- `fork_session` fabricates a fake hardcoded agent — does not spawn a real process or do the ACP handshake
- Plan edits in the inspector update local React state only; nothing is sent to the agent on "Resume Dance"
- `ProcessManager` doesn't store spawn metadata (command/args/dir), which blocks real forking and reconnect
- No cross-agent routing or visual handoff tethers
- SpawnModal uses a free-text path field instead of a native directory picker

**Done (Tier 1 — small):**
- ✅ Reset message buffer between prompts (`message_buf.clear()` after clone in stopReason branch)
- ✅ Send plan edits as a steering prompt on "Resume Dance" (`handleUpdatePlan` calls `handleSendCommand`)
- ✅ Native directory picker in SpawnModal (`tauri-plugin-dialog` + Browse button)
- ✅ Dynamic waypoints: add blank row (auto-focused), delete with X, reorder with up/down chevrons, empty-state ghost row
- ✅ Structured `[WAYPOINT UPDATE]` steering prompt on Resume Dance (semantic replacement, not suggestion)
- ✅ Compressed plan view on agent cards: progress bar + single active task + "N / M waypoints" counter (replaces full task wall)
- ✅ Waypoint persistence: `pinnedWaypoints` field on Agent survives backend `agent-update` plan overwrites; inspector prefers user-authored waypoints on reopen with "· user-authored" badge

**Next up (Tier 2 — medium):**
- Agent disconnect detection + `disconnected` status
- Per-agent conversation history in AgentInspector

**Next up (Tier 3 — large):**
- Real `fork_session`: store spawn metadata, re-spawn process, full handshake

---

## Phase 3: The Ensemble ❌ Not started

Goal: self-organizing swarm with shared memory and unified tooling.

- MCP Bridge (central host proxying tool calls to registered MCP servers) — registry stub exists, no routing
- Epistemic Shared Memory (vector search on findings) — SQLite store exists, no `list_findings` command exposed, no UI
- Agent-to-agent capability discovery and dynamic sub-contracting
- "God Prompt" omnibar (Cmd+K) for spawning agent ensembles from a single instruction
- Visual handoff tethers between communicating agents on the Stage
