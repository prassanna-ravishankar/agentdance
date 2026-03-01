import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { Stage } from "./components/Stage";
import { AgentInspector } from "./components/AgentInspector";
import { SpawnModal } from "./components/SpawnModal";
import { Background } from "./components/Background";
import { Agent, AgentPlanTask } from "./lib/types";
import { Plus, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";


interface LogLine {
  agent_id: string;
  stream: 'stdin' | 'stdout' | 'stderr';
  line: string;
}

interface AgentUpdatePayload {
  id: string;
  name?: string;
  status: 'idle' | 'busy' | 'error';
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    try {
      listen<AgentUpdatePayload>("agent-update", (event) => {
        const payload = event.payload;
        setAgents((prev) => {
          const existing = prev.find(a => a.id === payload.id);
          if (existing) {
            return prev.map((agent) => {
              if (agent.id === payload.id) {
                return {
                  ...agent,
                  name: payload.name || agent.name,
                  status: payload.status,
                  lastActive: "Just now",
                  message: payload.message !== undefined ? payload.message : agent.message,
                  plan: payload.plan ? {
                    id: payload.plan.id,
                    agentId: payload.plan.agent_id,
                    title: payload.plan.title,
                    tasks: payload.plan.tasks.map(t => ({
                      ...t,
                      status: (t.status === 'in_progress' ? 'running' : t.status) as AgentPlanTask['status']
                    }))
                  } : agent.plan
                };
              }
              return agent;
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
              plan: payload.plan ? {
                id: payload.plan.id,
                agentId: payload.plan.agent_id,
                title: payload.plan.title,
                tasks: payload.plan.tasks.map(t => ({
                  ...t,
                  status: (t.status === 'in_progress' ? 'running' : t.status) as AgentPlanTask['status']
                }))
              } : undefined
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

    return () => {
      if (unlistenFn) unlistenFn();
      if (unlistenLog) unlistenLog();
    };
  }, []);

  useEffect(() => {
    if (logsOpen) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logsOpen]);

  const handleConnect = async (name: string, command: string, args: string[], directory: string) => {
    try {
      await invoke("connect_agent", { 
        name, 
        command, 
        args,
        directory: directory || null
      });
      setIsSpawnModalOpen(false);
    } catch (e) {
      console.error("Failed to connect agent", e);
    }
  };

const handleFork = async (agentId: string) => {
    try {
      await invoke("fork_session", { agentId });
      setInspectingAgentId(null);
    } catch (e) {
      console.error("Failed to fork session", e);
    }
  };

  const handleSendCommand = async (agentId: string, message: string) => {
    try {
      await invoke("send_agent_input", { agentId, message });
    } catch (e) {
      console.error("Failed to send command", e);
    }
  };

  const handleUpdatePlan = (agentId: string, tasks: AgentPlanTask[]) => {
    setAgents(prev => prev.map(a => 
      a.id === agentId ? { ...a, plan: a.plan ? { ...a.plan, tasks } : a.plan } : a
    ));
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
              onClick={() => setIsSpawnModalOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-white/60 hover:text-white group hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <Plus size={16} className="transition-all" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto relative z-0">
          <Stage 
            agents={agents} 
            selectedId={selectedAgentId} 
            onInspectAgent={setInspectingAgentId}
          />
        </div>
      </main>

      {inspectingAgent && (
        <AgentInspector 
          agent={inspectingAgent} 
          onClose={() => setInspectingAgentId(null)}
          onUpdatePlan={handleUpdatePlan}
          onFork={handleFork}
          onSendCommand={handleSendCommand}
        />
      )}

      {isSpawnModalOpen && (
        <SpawnModal
          onClose={() => setIsSpawnModalOpen(false)}
          onConnect={handleConnect}
        />
      )}

      {/* Debug log panel */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur font-mono text-[11px]">
        <div
          className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-white/5 select-none"
          onClick={() => setLogsOpen(o => !o)}
        >
          <Terminal size={12} className="text-white/40" />
          <span className="text-white/40 uppercase tracking-widest text-[10px]">ACP Debug Log</span>
          <span className="ml-auto text-white/20">{logsOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}</span>
        </div>
        {logsOpen && (
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
