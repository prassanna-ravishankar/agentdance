import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("relative group", className)}>
      {/* Ambient outer glow */}
      <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl group-hover:bg-blue-400/40 transition-all duration-500" />
      
      {/* Spinning gradient border */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl opacity-50 group-hover:opacity-100 blur-[2px] transition-opacity duration-500 animate-[spin_4s_linear_infinite]" />
      
      {/* Core glass body */}
      <div className="w-11 h-11 bg-black/80 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 relative overflow-hidden z-10 shadow-[inset_0_2px_20px_rgba(255,255,255,0.1)]">
        {/* Inner diagonal light sweep */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50" />
        
        {/* The Choreographed Atom SVG */}
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.9)] relative z-10 w-6 h-6 group-hover:scale-110 transition-transform duration-500"
          stroke="currentColor" 
          strokeWidth="1.5"
        >
          {/* Orbital Paths */}
          <ellipse cx="12" cy="12" rx="9" ry="3.5" className="origin-center -rotate-45 opacity-80" />
          <ellipse cx="12" cy="12" rx="9" ry="3.5" className="origin-center rotate-45 opacity-40" />
          
          {/* Orbiting Agent Nodes */}
          <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" className="animate-pulse" />
          <circle cx="18.5" cy="18.5" r="1" fill="currentColor" stroke="none" className="opacity-60" />
          
          {/* Core Control Plane */}
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </svg>
      </div>
    </div>
  );
}
