import React from "react";
import { Agent } from "../lib/types";
import { Terminal, Shield, Palette, Database } from "lucide-react";
import { Logo } from "./Logo";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  agents: Agent[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
}

export function Sidebar({ agents, selectedId, onSelectAgent }: SidebarProps) {
  return (
    <aside className="w-72 border-r border-white/[0.06] flex flex-col bg-black/20 backdrop-blur-3xl z-20">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-10 mt-2 pl-1">
          <Logo />
          <div>
            <span className="font-bold text-xl tracking-tight text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">AgentDance</span>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400/80 font-bold mt-0.5 transition-colors">Control Plane</p>
          </div>
        </div>
        
        <nav className="space-y-6">
          <div>
            <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.15em] mb-4 px-2">
              Active Ensemble
            </h3>
            <div className="space-y-1.5">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-300 group relative overflow-hidden",
                    selectedId === agent.id 
                      ? "bg-white/10 text-white border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]" 
                      : "text-white/50 hover:bg-white/5 hover:text-white/90 border border-transparent"
                  )}
                >
                  {selectedId === agent.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
                  )}
                  <AgentIcon role={agent.role} active={selectedId === agent.id} />
                  <span className="flex-1 text-left font-medium z-10">{agent.name}</span>
                  {agent.status === 'busy' && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse z-10 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>
      
      <div className="mt-auto p-5 border-t border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-inner">
            <span className="text-white/60 text-xs font-bold tracking-wider">CR</span>
          </div>
          <div className="text-xs">
            <p className="font-semibold text-white/90">Choreographer</p>
            <p className="text-white/40 mt-0.5">Local Session</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AgentIcon({ role, active }: { role: string; active: boolean }) {
  const props = { size: 16, className: cn("relative z-10 transition-colors duration-300", active ? "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-white/30 group-hover:text-white/60") };
  switch (role) {
    case 'Security': return <Shield {...props} />;
    case 'Frontend': return <Palette {...props} />;
    case 'Database': return <Database {...props} />;
    default: return <Terminal {...props} />;
  }
}
