import React from "react";

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black pointer-events-none">
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20 mix-blend-screen"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />
      
      {/* Drifting Ambient Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] animate-blob" style={{ animationDelay: '0s' }} />
      <div className="absolute top-[20%] right-[-20%] w-[60vw] h-[40vw] rounded-full bg-indigo-600/10 blur-[130px] animate-blob" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-purple-600/10 blur-[120px] animate-blob" style={{ animationDelay: '5s' }} />
      
      {/* Final unifying glass layer */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[60px]" />
    </div>
  );
}
