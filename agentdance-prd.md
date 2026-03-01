# AgentDance: The Control Plane for an Agentic Workforce

**"Stop SSHing into your agents. Start choreographing them."**

## 1. The Context: The Multi-Agent Bottleneck

AI agents have moved from simple chat interfaces to sophisticated CLI tools capable of editing code, running tests, and managing Git state. However, the current state of the art suffers from three critical architectural limitations:

1.  **Terminal Isolation:** Interacting with an agent is currently a synchronous, blocking experience. We "attach" to a terminal session and watch text stream by. If we want to run three agents on three different problems, we have to juggle three terminal panes, manually monitoring each for completion or blockers.
2.  **Lack of Visibility:** CLI agents are "black boxes." While they work, the human has little visibility into their internal state or plan unless they read thousands of lines of terminal logs. There is no high-level "dashboard" for progress.
3.  **The Collaboration Wall:** Agents are islands. A backend agent has no way to query a frontend agent for a schema. They cannot delegate tasks to each other. They cannot "fork" to explore parallel solutions.

The result is a workflow where the human developer is forced to act as a low-level "process manager" rather than a high-level architect.

## 2. The Paradigm Shift (Vision)
Today, interacting with AI agents feels like managing Linux servers in 2005. We attach to `tmux` sessions, watch raw terminal output stream by, and manually copy-paste context between isolated silos. It is a primitive, human-bottlenecked workflow. 

**AgentDance** is a paradigm shift. It is a desktop-native (Tauri) IDE where agents are not treated as compute processes, but as asynchronous collaborators. Built entirely on the **Agent Client Protocol (ACP)**, AgentDance acts as the central nervous system (the control plane) for a swarm of specialized AI agents. 

You are no longer a prompt engineer typing into a terminal; you are a **Choreographer** managing an ensemble cast of intelligent systems.

---

## 2. Core Philosophy: Designing for Emergence
AgentDance is built on simple primitives (Agents, Tools, Tasks, and Routing) that, when combined via ACP, generate **emergent properties**. We do not hardcode complex workflows; we provide the substrate for agents to organize themselves.

### The "Mycelial" Network of Thought
* **Capability Discovery:** Agent A (Frontend) realizes it needs a GraphQL schema. Instead of asking the human, it emits a `workspace/query` via ACP: *"Who has access to the backend?"*
* **Dynamic Sub-contracting:** Agent B (Backend) intercepts this request, reads the schema, and returns it to Agent A. The human never intervened. 
* **The "Multiverse" (Session Forking):** An agent reaches a critical architectural decision. Instead of guessing, it invokes `session/fork` via ACP, spawning two parallel clones of itself. Clone 1 tries an SQL approach; Clone 2 tries NoSQL. The Choreographer (User) watches both timelines unfold visually and merges the winner.

### The Substrate: Unified Tools & Memory
* **The MCP Bridge (Universal Tooling):** AgentDance acts as a central **MCP (Model Context Protocol) Host**. Instead of each agent having its own siloed tools, they all connect to the AgentDance "Toolbox." Add a Jira or GitHub MCP server to AgentDance once, and every agent in the dance suddenly gains those capabilities.
* **Epistemic Shared Memory:** Agents don't just work; they learn. AgentDance maintains a collective "Knowledge Graph" (backed by a local vector store). When an agent discovers a quirk in the build system or a specific architectural pattern, it commits that finding to the shared memory. Future agents automatically query this memory, preventing redundant "re-discovery" phases.

---

## 3. Product Experience (UX / UI)
AgentDance discards the terminal UI entirely. It is a rich, hardware-accelerated Tauri application.

### 3.1 The Stage (Main Workspace View)
A spatial, node-based or Kanban-style overview of all active agents across all your repositories.
* **Spawn & Forget:** Drag an "Agent Profile" (e.g., *Security Auditor*, *React Expert*, *Database Architect*) onto a repository tile to spawn it.
* **Live Telemetry, Not Logs:** Instead of streaming text, the UI visualizes ACP `agent/plan` updates. You see a beautiful timeline of intent and action.

### 3.2 Steering & Intervention (Co-authorship)
* **The "Pause & Pivot":** You are never a passive observer. At any moment, you can pause an agent's execution. This reveals the agent's current "Internal Plan." You can manually edit the plan (e.g., *"Wait, use the v2 API instead of v1"* or *"Prioritize the unit tests over the documentation"*), and hit Resume. The agent adapts its trajectory immediately.
* **Semantic Diffs:** When an agent proposes code, you get a rich, side-by-side IDE diff with "Accept / Reject / Discuss" buttons.

### 3.3 The Ensemble (Cross-Agent Communication)
* **Visual Handoffs:** See visual tethers between agents when they communicate. If the UI designer agent is blocked by the API agent, a glowing line connects them on The Stage showing the blocked status and the pending payload.
* **The "God Prompt":** A global omnibar (Cmd+K). You type: *"Migrate the payments service to Stripe."* AgentDance analyzes the prompt, spawns the necessary agents, and wires their ACP/MCP channels together.

---

## 4. Technical Architecture

AgentDance leverages a local-first, high-performance stack:

* **The Shell (Tauri / Rust):** Provides native filesystem access, secure credential storage, and system tray integration.
* **The Nervous System (ACP + MCP Router):** 
  * A Rust-based JSON-RPC server/broker.
  * Acts as a central **MCP Host**, proxying tool calls from agents to registered MCP servers.
* **The Canvas (React / TypeScript / Tailwind):** A rich frontend focused on data visualization (timeline, node graphs, syntax-highlighted diffs).
* **The Memory (SQLite + Vector Store):**
  * Local database storing agent identities, session histories, and fork trees.
  * Integrated vector search (`sqlite-vss`) for shared "Epistemic Memory."

---

## 5. Implementation Roadmap

### Phase 1: The Soloist (Proof of Concept)
* Scaffold Tauri + React app.
* Implement basic ACP server in Rust.
* **Deliverable:** A beautiful desktop UI showing a live-updating plan of a single agent.

### Phase 2: The Duet (Routing, Forking, & Steering)
* Implement `session/fork` and the "Pause & Pivot" steering mechanism.
* Enable manual routing between agents.
* **Deliverable:** Multi-agent workspace with manual intervention capabilities.

### Phase 3: The Ensemble (Emergent Substrate)
* Implement the central **MCP Bridge** for unified tool access.
* Implement the **Epistemic Shared Memory** (vector store).
* Allow agents to dynamically spawn sub-agents and query each other.
* **Deliverable:** A self-organizing swarm that shares knowledge and tools autonomously.

---

## 6. Success Metrics
* **Time-to-Context:** How quickly a user can understand what an agent has been doing (Goal: < 5 seconds).
* **Parallel Autonomy:** Number of independent tasks a single developer can run concurrently (Goal: 5+).
* **Knowledge Reuse:** Percentage of tasks where an agent utilizes "shared memory" to skip discovery.

---

## 7. References & Standards

* **ACP Overview:** [agentclientprotocol.com/protocol/overview](https://agentclientprotocol.com/protocol/overview)
* **MCP Specification:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
* **ACP Agent Plan (Live Task Visibility):** [agentclientprotocol.com/protocol/agent-plan](https://agentclientprotocol.com/protocol/agent-plan)
* **Zed's Claude Agent Integration:** [zed.dev/docs/ai/external-agents#claude-agent](https://zed.dev/docs/ai/external-agents#claude-agent)
* **The Adapter (Claude Code ↔ ACP bridge):** [github.com/zed-industries/claude-agent-acp](https://github.com/zed-industries/claude-agent-acp)
* **OpenCode ACP:** [agentclientprotocol.com/get-started/agents](https://agentclientprotocol.com/get-started/agents)
