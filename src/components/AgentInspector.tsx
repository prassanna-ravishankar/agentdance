import React, { useState } from "react";
import { Agent, AgentPlanTask } from "../lib/types";
import { X, Play, Pause, RotateCcw, Plus, GitFork, Send } from "lucide-react";
import { motion } from "framer-motion";

interface AgentInspectorProps {
  agent: Agent;
  onClose: () => void;
  onUpdatePlan: (agentId: string, tasks: AgentPlanTask[]) => void;
  onFork: (agentId: string) => void;
  onSendCommand: (agentId: string, message: string) => void;
}

export function AgentInspector({ agent, onClose, onUpdatePlan, onFork, onSendCommand }: AgentInspectorProps) {
  const [editedTasks, setEditedTasks] = useState<AgentPlanTask[]>(
    agent.plan?.tasks.map(t => ({ ...t })) || []
  );
  const [command, setCommand] = useState("");

  const handleTaskChange = (index: number, newTitle: string) => {
    const next = [...editedTasks];
    next[index].title = newTitle;
    setEditedTasks(next);
  };

  const handleSend = () => {
    if (command.trim()) {
      onSendCommand(agent.id, command);
      setCommand("");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh] relative"
      >
        {/* Glow overlay */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-blue-500/20 blur-[80px] pointer-events-none" />

        <div className="p-7 border-b border-white/[0.08] flex items-center justify-between relative z-10 bg-white/[0.01]">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Pause className="text-blue-400" size={20} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white/90 tracking-tight">Steering: {agent.name}</h2>
              <p className="text-[11px] text-blue-300/80 uppercase tracking-widest mt-1 font-semibold">Trajectory Paused</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white hover:rotate-90 duration-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-7 space-y-8 relative z-10">
          {/* Internal mental model section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Internal Mental Model</h3>
            <div className="space-y-3">
              {editedTasks.map((task, i) => (
                <div key={task.id} className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/[0.05] group hover:border-white/10 transition-colors focus-within:border-blue-500/30 focus-within:ring-1 focus-within:ring-blue-500/30">
                  <span className="text-[10px] font-mono text-white/20 w-4 tracking-wider">0{i + 1}</span>
                  <input 
                    value={task.title}
                    onChange={(e) => handleTaskChange(i, e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] font-medium text-white/90 outline-none placeholder:text-white/20"
                    placeholder="Describe objective..."
                  />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-rose-400 transition-colors"><RotateCcw size={14} /></button>
                  </div>
                </div>
              ))}
              <button className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[12px] text-white/40 font-medium hover:border-blue-500/50 hover:text-blue-400 transition-all hover:bg-blue-500/5 flex items-center justify-center gap-2">
                <Plus size={14} /> Add dynamic waypoint
              </button>
            </div>
          </div>

          {/* New Command HUD section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1 text-blue-400/80">Issue Direct Request</h3>
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/5 blur-xl group-focus-within:bg-blue-500/10 transition-all pointer-events-none" />
              <div className="relative flex items-center gap-3 bg-black/60 p-2 pl-5 rounded-2xl border border-blue-500/20 focus-within:border-blue-500/50 transition-all shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                <input 
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message or instruction to the agent..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] text-white outline-none placeholder:text-white/20"
                />
                <button 
                  onClick={handleSend}
                  disabled={!command.trim()}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-all shadow-lg shadow-blue-500/20"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/[0.08] bg-black/40 flex items-center justify-between relative z-10 backdrop-blur-xl">
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-[13px] font-semibold text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              Discard Edits
            </button>
            <button 
              onClick={() => onFork(agent.id)}
              className="px-5 py-2.5 text-[13px] font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all border border-blue-500/20 group"
            >
              <GitFork size={14} className="group-hover:rotate-12 transition-transform" />
              Fork Trajectory
            </button>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => onUpdatePlan(agent.id, editedTasks)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-blue-50 rounded-xl text-[13px] font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <Play size={14} fill="currentColor" />
              Resume Dance
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
