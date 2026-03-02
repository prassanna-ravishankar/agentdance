import React from "react";
import { Agent, AgentPlanTask } from "../lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StageProps {
  agents: Agent[];
  selectedId: string | null;
  onInspectAgent: (id: string) => void;
}

export function Stage({ agents, selectedId, onInspectAgent }: StageProps) {
  return (
    <div data-testid="stage" className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <AnimatePresence>
        {agents.map((agent) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onInspectAgent(agent.id)}
            className={cn(
              "group relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden flex flex-col h-84 transition-all duration-500 cursor-pointer",
              "hover:border-white/20 hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] hover:shadow-blue-500/10",
              selectedId === agent.id && "ring-1 ring-blue-500/50 border-blue-500/30 bg-blue-500/[0.02] shadow-[0_0_30px_rgba(59,130,246,0.15)]"
            )}
          >
            {/* Glossy highlight effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between relative z-10 bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-inner">
                   <StatusIcon status={agent.status === 'busy' ? 'running' : 'pending'} />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-white/90">{agent.name}</h3>
                  <p className="text-[10px] text-white/40 tracking-[0.15em] uppercase mt-1 font-semibold">{agent.role}</p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] border backdrop-blur-md",
                agent.status === 'busy' ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-white/5 text-white/40 border-white/10"
              )}>
                {agent.status}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-6 relative z-10">
              {agent.plan ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Active Trajectory</span>
                    <span className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 font-medium">{agent.plan.title}</span>
                  </div>
                  {(() => {
                    let total = 0, completed = 0, active: AgentPlanTask | null = null;
                    for (const t of agent.plan.tasks) {
                      total++;
                      if (t.status === 'completed') completed++;
                      if (!active && (t.status === 'running' || t.status === 'pending')) active = t;
                    }
                    return (
                      <div className="space-y-3">
                        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/60 transition-all duration-500"
                               style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
                        </div>
                        {active && <TaskItem task={active} />}
                        <p className="text-[10px] text-white/20 font-mono">{completed} / {total} waypoints</p>
                      </div>
                    );
                  })()}
                </div>
              ) : agent.message ? (
                <div className="h-full overflow-auto">
                  <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">
                    {agent.message}
                    {agent.status === 'busy' && <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />}
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/30 space-y-4">
                  <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center bg-white/5 relative">
                    <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20" />
                    <Loader2 className="animate-spin text-white/50" size={24} />
                  </div>
                  <span className="text-sm font-medium tracking-wide">Awaiting instructions</span>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-white/[0.06] bg-black/20 flex items-center justify-between text-[11px] text-white/30 font-mono relative z-10">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {agent.status === 'busy' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                  <span className={cn("relative inline-flex rounded-full h-2 w-2", agent.status === 'busy' ? "bg-blue-500" : "bg-white/20")}></span>
                </span>
                {agent.lastActive}
              </span>
              <span className="opacity-40 tracking-wider">ID: {agent.id}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TaskItem({ task }: { task: AgentPlanTask }) {
  return (
    <div className="flex items-start gap-4 group/task">
      <div className="mt-[3px]">
        <StatusIcon status={task.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-medium transition-all duration-300 leading-relaxed",
          task.status === 'completed' ? "text-white/30 line-through" : "text-white/80",
          task.status === 'running' && "text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
        )}>
          {task.title}
        </p>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: AgentPlanTask['status'] }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={16} className="text-emerald-500/60" />;
    case 'running': return <Loader2 size={16} className="text-blue-400 animate-spin" />;
    case 'failed': return <AlertCircle size={16} className="text-rose-500/80" />;
    default: return <Circle size={16} className="text-white/10" />;
  }
}
