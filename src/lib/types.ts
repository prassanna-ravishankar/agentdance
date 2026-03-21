export interface AgentPlanTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  subtasks?: AgentPlanTask[];
}

export interface AgentPlan {
  id: string;
  agentId: string;
  title: string;
  tasks: AgentPlanTask[];
}

export interface HistoryEntry {
  role: 'user' | 'agent' | 'peer';
  text: string;
  timestamp: number;
  peerName?: string; // for inter-agent messages
  commKind?: 'notify' | 'ask' | 'broadcast' | 'response';
}

export interface CommEvent {
  from_name: string;
  from_id: string;
  to_name: string;
  to_id: string;
  kind: 'notify' | 'ask' | 'broadcast' | 'response';
  message: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'error' | 'disconnected';
  lastActive: string;
  plan?: AgentPlan;
  pinnedWaypoints?: AgentPlanTask[];
  forkOf?: string;
  message?: string;
  history: HistoryEntry[];
  peerMessageCount: number;
}

export interface SpawnConfig {
  name: string;
  command: string;
  args: string[];
  directory: string | null;
}
