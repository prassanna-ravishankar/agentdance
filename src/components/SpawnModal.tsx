import React, { useState } from "react";
import { X, Terminal, Folder, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";

interface SpawnModalProps {
  onClose: () => void;
  onConnect: (name: string, command: string, args: string[], directory: string) => void;
}

export function SpawnModal({ onClose, onConnect }: SpawnModalProps) {
  const [directory, setDirectory] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("claude");

  const agents = [
    { id: "claude", name: "Claude Code", command: "npx", args: ["@zed-industries/claude-agent-acp"], icon: <Zap className="text-blue-400" size={18} /> },
    { id: "opencode", name: "OpenCode", command: "opencode", args: ["acp"], icon: <Terminal className="text-emerald-400" size={18} /> }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const agent = agents.find(a => a.id === selectedAgent);
    if (agent && directory) {
      onConnect(agent.name, agent.command, agent.args, directory);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-lg font-bold text-white/90">Spawn New Agent</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">Select Ensemble Member</label>
            <div className="grid grid-cols-2 gap-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                    selectedAgent === agent.id 
                      ? "bg-blue-500/10 border-blue-500/40 text-white" 
                      : "bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20"
                  }`}
                >
                  {agent.icon}
                  <span className="text-xs font-semibold">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-widest ml-1">Working Substrate (Directory)</label>
            <div className="relative flex items-center group">
              <Folder className="absolute left-4 text-white/20 group-focus-within:text-blue-400 transition-colors" size={18} />
              <input
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/absolute/path/to/project"
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-24 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                required
              />
              <button
                type="button"
                onClick={async () => {
                  const path = await invoke<string | null>('pick_directory');
                  if (path) setDirectory(path);
                }}
                className="absolute right-2 px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                Browse
              </button>
            </div>
            <p className="text-[10px] text-white/20 ml-1">Enter the absolute path or use Browse to pick a folder.</p>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-white/10 active:scale-[0.98]"
          >
            Initiate Dance
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
