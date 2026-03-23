import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, FolderOpen, ArrowRight, Sparkles, Users, MessageSquare, Crown } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface WelcomeScreenProps {
  onSpawn: (name: string, command: string, args: string[], directory: string, initialTask?: string) => Promise<void>;
  onStartEnsemble: (directory: string, task: string, workerCount?: number) => Promise<void>;
}

export function WelcomeScreen({ onSpawn, onStartEnsemble }: WelcomeScreenProps) {
  const [step, setStep] = useState<'welcome' | 'pick-dir' | 'ensemble'>('welcome');
  const [directory, setDirectory] = useState("");
  const [task, setTask] = useState("");
  const [spawning, setSpawning] = useState(false);

  const handleQuickStart = () => setStep('pick-dir');

  const handleSpawn = async () => {
    if (!directory) return;
    setSpawning(true);
    try {
      await onSpawn("Claude Code", "npx", ["@zed-industries/claude-agent-acp"], directory, task || undefined);
    } finally {
      setSpawning(false);
    }
  };

  const handleEnsemble = async () => {
    if (!directory || !task) return;
    setSpawning(true);
    try {
      await onStartEnsemble(directory, task, 2);
    } finally {
      setSpawning(false);
    }
  };

  if (step === 'ensemble') {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full space-y-8"
        >
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center"
            >
              <Crown className="text-amber-400" size={28} />
            </motion.div>
            <h2 className="text-2xl font-bold text-white/90">Start an Ensemble</h2>
            <p className="text-[14px] text-white/40">An orchestrator agent will coordinate 2 worker agents on your task.</p>
          </div>

          <div className="relative flex items-center">
            <input
              value={directory}
              onChange={e => setDirectory(e.target.value)}
              placeholder="/path/to/your/project"
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-5 pr-24 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
              autoFocus
            />
            <button
              type="button"
              onClick={async () => {
                const path = await invoke<string | null>('pick_directory');
                if (path) setDirectory(path);
              }}
              className="absolute right-2 px-4 py-2 text-[12px] font-semibold text-white/50 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              Browse
            </button>
          </div>

          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Describe the task for the ensemble..."
            rows={3}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 px-5 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none placeholder:text-white/20"
          />

          <button
            onClick={handleEnsemble}
            disabled={!directory || !task || spawning}
            className="w-full py-4 bg-amber-500 text-black font-bold rounded-2xl hover:bg-amber-400 transition-all shadow-lg active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-3 text-[15px]"
          >
            {spawning ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Spawning ensemble...
              </>
            ) : (
              <>
                <Crown size={18} />
                Launch 1 Orchestrator + 2 Workers
              </>
            )}
          </button>

          <button
            onClick={() => setStep('welcome')}
            className="w-full text-center text-[13px] text-white/30 hover:text-white/50 transition-colors"
          >
            Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 'pick-dir') {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full space-y-8"
        >
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center"
            >
              <FolderOpen className="text-blue-400" size={28} />
            </motion.div>
            <h2 className="text-2xl font-bold text-white/90">Where should your agent work?</h2>
            <p className="text-[14px] text-white/40">Pick a project directory. The agent will have full access to read, edit, and run commands there.</p>
          </div>

          <div className="relative flex items-center">
            <input
                value={directory}
                onChange={e => setDirectory(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-5 pr-24 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && directory) handleSpawn(); }}
              />
              <button
                type="button"
                onClick={async () => {
                  const path = await invoke<string | null>('pick_directory');
                  if (path) setDirectory(path);
                }}
                className="absolute right-2 px-4 py-2 text-[12px] font-semibold text-white/50 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                Browse
              </button>
          </div>

          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="What should the agent work on? (optional)"
            rows={2}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 px-5 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-none placeholder:text-white/20"
          />

          <button
            onClick={handleSpawn}
            disabled={!directory || spawning}
            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-3 text-[15px]"
          >
            {spawning ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Zap size={18} />
                Spawn Agent
              </>
            )}
          </button>

          <button
            onClick={() => setStep('welcome')}
            className="w-full text-center text-[13px] text-white/30 hover:text-white/50 transition-colors"
          >
            Back
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full space-y-12"
      >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2, damping: 12 }}
            className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center relative"
          >
            <Sparkles className="text-blue-400" size={32} />
            <div className="absolute inset-0 rounded-3xl bg-blue-500/10 animate-pulse" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white/90 tracking-tight">agentdance</h1>
          <p className="text-[16px] text-white/40 max-w-md mx-auto leading-relaxed">
            Orchestrate AI agents that discover each other, communicate, and collaborate on your codebase.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { icon: <Zap size={18} />, title: "Spawn", desc: "Launch agents on any project directory" },
            { icon: <Users size={18} />, title: "Orchestrate", desc: "Agents discover peers and coordinate" },
            { icon: <MessageSquare size={18} />, title: "Collaborate", desc: "Shared memory, messaging, delegation" },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-2"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/50">
                {item.icon}
              </div>
              <h3 className="text-[13px] font-bold text-white/70">{item.title}</h3>
              <p className="text-[11px] text-white/30 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleQuickStart}
              className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:-translate-y-0.5 active:translate-y-0 text-[15px]"
            >
              <Zap size={18} />
              Single Agent
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setStep('ensemble')}
              className="flex items-center gap-3 px-8 py-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold rounded-2xl hover:bg-amber-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 text-[15px]"
            >
              <Crown size={18} />
              Start Ensemble
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-[12px] text-white/20"
        >
          Requires Claude Code ACP · <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px]">⌘K</kbd> for god prompt
        </motion.p>
      </motion.div>
    </div>
  );
}
