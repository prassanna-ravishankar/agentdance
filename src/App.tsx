import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { Stage } from "./components/Stage";
import { AgentInspector } from "./components/AgentInspector";
import { SpawnModal } from "./components/SpawnModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { Background } from "./components/Background";
import { Agent, AgentPlan, AgentPlanTask, HistoryEntry, CommEvent, SpawnConfig } from "./lib/types";
import { Plus, Terminal, ChevronDown, ChevronUp, RotateCcw, Radio, ArrowRight, Command, Send } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";


const MAX_HISTORY = 200;

function mapPlanPayload(plan: AgentUpdatePayload['plan']): AgentPlan | undefined {
  if (!plan) return undefined;
  return {
    id: plan.id,
    agentId: plan.agent_id,
    title: plan.title,
    tasks: plan.tasks.map(t => ({
      ...t,
      status: (t.status === 'in_progress' ? 'running' : t.status) as AgentPlanTask['status']
    }))
  };
}

interface LogLine {
  agent_id: string;
  stream: 'stdin' | 'stdout' | 'stderr';
  line: string;
}

interface AgentUpdatePayload {
  id: string;
  name?: string;
  status: 'idle' | 'busy' | 'error' | 'disconnected';
  fork_of?: string;
  message?: string;
  plan?: {
    id: string;
    agent_id: string;
    title: string;
    tasks: { id: string; title: string; status: string }[];
  };
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [inspectingAgentId, setInspectingAgentId] = useState<string | null>(null);
  const [isSpawnModalOpen, setIsSpawnModalOpen] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsOpen, setLogsOpen] = useState(true);
  const [logTab, setLogTab] = useState<'debug' | 'mesh'>('mesh');
  const [comms, setComms] = useState<CommEvent[]>([]);
  const [savedSessions, setSavedSessions] = useState<SpawnConfig[]>([]);
  const [orchestratorId, setOrchestratorId] = useState<string | null>(null);
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [omnibarText, setOmnibarText] = useState("");
  const omnibarRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const commsEndRef = useRef<HTMLDivElement>(null);

  // Cmd+K to toggle omnibar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmnibarOpen(o => !o);
      }
      if (e.key === 'Escape') setOmnibarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (omnibarOpen) omnibarRef.current?.focus();
  }, [omnibarOpen]);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    try {
      listen<AgentUpdatePayload>("agent-update", (event) => {
        const payload = event.payload;
        setAgents((prev) => {
          const existing = prev.find(a => a.id === payload.id);
          if (existing) {
            return prev.map((agent) => {
              if (agent.id !== payload.id) return agent;
              const history = [...agent.history];
              if (payload.status === 'idle' && payload.message) {
                history.push({ role: 'agent', text: payload.message, timestamp: Date.now() });
              }
              return {
                ...agent,
                name: payload.name || agent.name,
                status: payload.status,
                lastActive: "Just now",
                message: payload.message !== undefined ? payload.message : agent.message,
                history: history.slice(-MAX_HISTORY),
                plan: mapPlanPayload(payload.plan) ?? agent.plan,
              };
            });
          } else {
            const parent = prev.find(a => a.id === payload.fork_of);
            const newAgent: Agent = {
              id: payload.id,
              name: payload.name || (payload.fork_of ? `${parent?.name || 'Agent'} (Fork)` : "Real Agent"),
              role: parent?.role || 'External',
              status: payload.status,
              lastActive: "Just now",
              forkOf: payload.fork_of,
              message: payload.message,
              history: [],
              peerMessageCount: 0,
              plan: mapPlanPayload(payload.plan),
            };
            return [...prev, newAgent];
          }
        });
      }).then((fn) => {
        unlistenFn = fn;
      }).catch(e => console.warn("Tauri listen failed", e));
    } catch (e) {
      console.warn("Not running in Tauri environment", e);
    }

    let unlistenLog: (() => void) | undefined;
    listen<LogLine>("agent-log", (event) => {
      setLogs(prev => [...prev.slice(-200), event.payload]);
    }).then(fn => { unlistenLog = fn; }).catch(() => {});

    let unlistenComm: (() => void) | undefined;
    listen<CommEvent>("agent-comm", (event) => {
      const comm = event.payload;
      setComms(prev => [...prev.slice(-200), comm]);
      // Inject into receiving agent's history
      setAgents(prev => prev.map(a => {
        if (a.id !== comm.to_id) return a;
        return {
          ...a,
          peerMessageCount: a.peerMessageCount + 1,
          history: [...a.history, {
            role: 'peer' as const, text: comm.message, timestamp: comm.timestamp,
            peerName: comm.from_name, commKind: comm.kind,
          }].slice(-MAX_HISTORY),
        };
      }));
    }).then(fn => { unlistenComm = fn; }).catch(() => {});

    let unlistenOrch: (() => void) | undefined;
    listen<{ agent_id: string }>("orchestrator-changed", (event) => {
      setOrchestratorId(event.payload.agent_id);
    }).then(fn => { unlistenOrch = fn; }).catch(() => {});

    let unlistenSpawn: (() => void) | undefined;
    listen<{ name: string; command: string; args: string[]; directory?: string; initial_prompt?: string }>("spawn-agent", async (event) => {
      const { name, command, args, directory, initial_prompt } = event.payload;
      try {
        const agentId = await invoke<string>("connect_agent", { name, command, args, directory: directory || null });
        if (initial_prompt && agentId) {
          await invoke("send_agent_input", { agentId, message: initial_prompt });
        }
      } catch (e) {
        console.error("Failed to spawn sub-agent", e);
      }
    }).then(fn => { unlistenSpawn = fn; }).catch(() => {});

    invoke<SpawnConfig[]>("load_previous_session")
      .then(sessions => { if (sessions.length > 0) setSavedSessions(sessions); })
      .catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
      if (unlistenLog) unlistenLog();
      if (unlistenComm) unlistenComm();
      if (unlistenOrch) unlistenOrch();
      if (unlistenSpawn) unlistenSpawn();
    };
  }, []);

  useEffect(() => {
    if (logsOpen && logTab === 'debug') logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (logsOpen && logTab === 'mesh') commsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, comms, logsOpen, logTab]);

  const handleConnect = async (name: string, command: string, args: string[], directory: string, initialTask?: string) => {
    try {
      const agentId = await invoke<string>("connect_agent", {
        name,
        command,
        args,
        directory: directory || null
      });
      if (initialTask && agentId) {
        await invoke("send_agent_input", { agentId, message: initialTask });
        setAgents(prev => prev.map(a =>
          a.id === agentId ? { ...a, history: [...a.history, { role: 'user' as const, text: initialTask, timestamp: Date.now() }] } : a
        ));
      }
      setIsSpawnModalOpen(false);
    } catch (e) {
      console.error("Failed to connect agent", e);
    }
  };

  const handleStartEnsemble = async (directory: string, task: string, workerCount: number = 1) => {
    const orchId = await invoke<string>("connect_agent", {
      name: "Orchestrator",
      command: "npx",
      args: ["@zed-industries/claude-agent-acp"],
      directory: directory || null,
    });
    if (orchId) {
      await invoke("set_orchestrator", { agentId: orchId });
      const workerNames = workerCount === 1 ? ["Worker"] : Array.from({ length: workerCount }, (_, i) => `Worker ${i + 1}`);
      for (const name of workerNames) {
        await invoke<string>("connect_agent", {
          name,
          command: "npx",
          args: ["@zed-industries/claude-agent-acp"],
          directory: directory || null,
        });
      }
      if (task) {
        await invoke("send_agent_input", { agentId: orchId, message: task });
        setAgents(prev => prev.map(a =>
          a.id === orchId ? { ...a, history: [...a.history, { role: 'user' as const, text: task, timestamp: Date.now() }] } : a
        ));
      }
    }
  };

  const handleFork = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      const contextParts: string[] = [];
      if (agent?.plan) {
        const tasks = agent.plan.tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.title}`).join('\n');
        contextParts.push(`The original agent's plan was:\n${tasks}`);
      }
      if (agent?.message) {
        contextParts.push(`The original agent's last message was:\n${agent.message.slice(0, 1000)}`);
      }
      contextParts.push("Take an alternative approach to the task. Explore different solutions or strategies.");
      await invoke("fork_session", { agentId, context: contextParts.join('\n\n') });
      setInspectingAgentId(null);
    } catch (e) {
      console.error("Failed to fork session", e);
    }
  };

  const handleSendCommand = async (agentId: string, message: string) => {
    try {
      await invoke("send_agent_input", { agentId, message });
      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, history: [...a.history, { role: 'user' as const, text: message, timestamp: Date.now() }].slice(-MAX_HISTORY) } : a
      ));
    } catch (e) {
      console.error("Failed to send command", e);
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      await invoke("stop_agent", { agentId });
      setInspectingAgentId(null);
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (e) {
      console.error("Failed to stop agent", e);
    }
  };

  const handleRestoreSession = async () => {
    await Promise.all(savedSessions.map(s => handleConnect(s.name, s.command, s.args, s.directory || "")));
    setSavedSessions([]);
  };

  const handleDelegate = async (fromId: string, targetName: string, task: string) => {
    const from = agents.find(a => a.id === fromId);
    const target = agents.find(a => a.name === targetName);
    if (!target) return;
    const message = `[Task delegated by orchestrator '${from?.name || fromId}'] ${task}`;
    await handleSendCommand(target.id, message);
    setInspectingAgentId(null);
  };

  const handleSetOrchestrator = async (agentId: string) => {
    try {
      await invoke("set_orchestrator", { agentId });
      setInspectingAgentId(null);
    } catch (e) {
      console.error("Failed to set orchestrator", e);
    }
  };

  const handleDismissRestore = () => setSavedSessions([]);

  const handleGodPrompt = useCallback(async () => {
    const msg = omnibarText.trim();
    if (!msg) return;
    const running = agents.filter(a => a.status !== 'disconnected');
    await Promise.allSettled(running.map(a => invoke("send_agent_input", { agentId: a.id, message: msg })));
    setAgents(prev => prev.map(a =>
      a.status !== 'disconnected' ? { ...a, history: [...a.history, { role: 'user' as const, text: `[God Prompt] ${msg}`, timestamp: Date.now() }].slice(-MAX_HISTORY) } : a
    ));
    setOmnibarText("");
    setOmnibarOpen(false);
  }, [agents, omnibarText]);

  const handleUpdatePlan = (agentId: string, tasks: AgentPlanTask[]) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, plan: a.plan ? { ...a.plan, tasks } : a.plan, pinnedWaypoints: tasks } : a
    ));
    const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    handleSendCommand(agentId, `[WAYPOINT UPDATE] Discard your current plan. Your new waypoint sequence is:\n\n${taskList}\n\nBegin immediately with waypoint 1. Execute each in order.`);
    setInspectingAgentId(null);
  };

  const inspectingAgent = agents.find(a => a.id === inspectingAgentId);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans relative">
      <Background />
      <Sidebar 
        agents={agents} 
        onSelectAgent={setSelectedAgentId} 
        selectedId={selectedAgentId} 
      />
      
      <main className="flex-1 relative flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/[0.06] flex items-center justify-between px-8 bg-white/[0.01] backdrop-blur-md z-10 relative">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide">
              <span className="text-white/40">Project</span>
              <span className="text-white/20">/</span>
              <span className="text-white/90">agentdance</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOmnibarOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-white/40 hover:text-white/60 text-[12px]"
            >
              <Command size={12} />
              <span>God Prompt</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono">⌘K</kbd>
            </button>
            <button
              data-testid="spawn-open-btn"
              onClick={() => setIsSpawnModalOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-white/60 hover:text-white group hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <Plus size={16} className="transition-all" />
            </button>
          </div>
        </header>

        {omnibarOpen && (
          <div className="absolute inset-0 z-30 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm" onClick={() => setOmnibarOpen(false)}>
            <div className="w-full max-w-2xl mx-8" onClick={e => e.stopPropagation()}>
              <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                  <Command size={16} className="text-white/30 shrink-0" />
                  <input
                    ref={omnibarRef}
                    value={omnibarText}
                    onChange={e => setOmnibarText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleGodPrompt(); }}
                    placeholder="Send a command to all agents..."
                    className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/20"
                  />
                  <button
                    onClick={handleGodPrompt}
                    disabled={!omnibarText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-[12px] font-bold rounded-xl hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
                  >
                    <Send size={12} />
                    Broadcast
                  </button>
                </div>
                <div className="px-4 py-2.5 text-[11px] text-white/30 flex items-center gap-2">
                  {(() => { const n = agents.filter(a => a.status !== 'disconnected').length; return <span>Sends to {n} active agent{n !== 1 ? 's' : ''}</span>; })()}
                  <span className="text-white/10">·</span>
                  <span>Esc to close</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {savedSessions.length > 0 && (
          <div className="mx-8 mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <RotateCcw size={16} className="text-blue-400" />
              <span className="text-[13px] text-white/80">
                Previous session found — <span className="text-blue-300 font-medium">{savedSessions.length} agent{savedSessions.length > 1 ? 's' : ''}</span> ({savedSessions.map(s => s.name).join(', ')})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDismissRestore} className="px-3 py-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors">Dismiss</button>
              <button onClick={handleRestoreSession} className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-[12px] font-semibold rounded-lg transition-colors">Restore All</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto relative z-0">
          {agents.length === 0 && savedSessions.length === 0 ? (
            <WelcomeScreen onSpawn={handleConnect} onStartEnsemble={handleStartEnsemble} />
          ) : (
            <Stage
              agents={agents}
              selectedId={selectedAgentId}
              orchestratorId={orchestratorId}
              onInspectAgent={setInspectingAgentId}
            />
          )}
        </div>
      </main>

      {inspectingAgent && (
        <AgentInspector
          agent={inspectingAgent}
          allAgents={agents}
          isOrchestrator={inspectingAgent.id === orchestratorId}
          onClose={() => setInspectingAgentId(null)}
          onUpdatePlan={handleUpdatePlan}
          onFork={handleFork}
          onSendCommand={handleSendCommand}
          onStop={handleStopAgent}
          onSetOrchestrator={handleSetOrchestrator}
          onDelegate={handleDelegate}
        />
      )}

      {isSpawnModalOpen && (
        <SpawnModal
          onClose={() => setIsSpawnModalOpen(false)}
          onConnect={handleConnect}
        />
      )}

      {/* Bottom panel with tabs */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur font-mono text-[11px]">
        <div className="flex items-center px-4 py-1.5 select-none gap-1">
          <button
            onClick={() => { setLogTab('mesh'); setLogsOpen(true); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${logTab === 'mesh' && logsOpen ? 'bg-purple-500/20 text-purple-300' : 'text-white/40 hover:text-white/60'}`}
          >
            <Radio size={11} />
            <span className="uppercase tracking-widest text-[10px]">Mesh</span>
            {comms.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[9px] font-bold">{comms.length}</span>}
          </button>
          <button
            onClick={() => { setLogTab('debug'); setLogsOpen(true); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${logTab === 'debug' && logsOpen ? 'bg-white/10 text-white/60' : 'text-white/40 hover:text-white/60'}`}
          >
            <Terminal size={11} />
            <span className="uppercase tracking-widest text-[10px]">ACP Debug</span>
          </button>
          <span className="ml-auto cursor-pointer text-white/20 hover:text-white/40" onClick={() => setLogsOpen(o => !o)}>
            {logsOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </span>
        </div>
        {logsOpen && logTab === 'mesh' && (
          <div className="h-40 overflow-y-auto px-4 pb-2 space-y-1">
            {comms.length === 0 && <div className="text-white/20 py-2">No inter-agent messages yet. Agents will communicate once they discover each other.</div>}
            {comms.map((c, i) => (
              <div key={i} className="flex items-center gap-2 leading-5">
                <span className="text-white/20 text-[10px] shrink-0 w-16">{new Date(c.timestamp).toLocaleTimeString()}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                  c.kind === 'notify' ? 'bg-blue-500/20 text-blue-300' :
                  c.kind === 'ask' ? 'bg-amber-500/20 text-amber-300' :
                  c.kind === 'broadcast' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-emerald-500/20 text-emerald-300'
                }`}>{c.kind}</span>
                <span className="text-white/60 font-semibold shrink-0">{c.from_name}</span>
                <ArrowRight size={10} className="text-white/20 shrink-0" />
                <span className="text-white/60 font-semibold shrink-0">{c.to_name}</span>
                <span className="text-white/40 truncate">{c.message.length > 80 ? c.message.slice(0, 80) + '…' : c.message}</span>
              </div>
            ))}
            <div ref={commsEndRef} />
          </div>
        )}
        {logsOpen && logTab === 'debug' && (
          <div className="h-40 overflow-y-auto px-4 pb-2 space-y-0.5">
            {logs.length === 0 && <div className="text-white/20 py-2">No log lines yet. Spawn an agent to see traffic.</div>}
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2 leading-5">
                <span className={
                  l.stream === 'stdin' ? 'text-blue-400/70 w-12 shrink-0' :
                  l.stream === 'stderr' ? 'text-red-400/70 w-12 shrink-0' :
                  'text-green-400/70 w-12 shrink-0'
                }>{l.stream}</span>
                <span className="text-white/30 shrink-0">{l.agent_id.slice(-6)}</span>
                <span className="text-white/70 break-all">{l.line}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
