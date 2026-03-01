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

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'error';
  lastActive: string;
  plan?: AgentPlan;
  forkOf?: string;
  message?: string;
}
