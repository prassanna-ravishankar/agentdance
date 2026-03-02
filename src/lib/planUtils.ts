import { AgentPlan, AgentPlanTask } from "./types";

export function getPlanProgress(plan: AgentPlan): {
  total: number;
  completed: number;
  active: AgentPlanTask | null;
} {
  let total = 0, completed = 0, active: AgentPlanTask | null = null;
  for (const t of plan.tasks) {
    total++;
    if (t.status === 'completed') completed++;
    if (!active && (t.status === 'running' || t.status === 'pending')) active = t;
  }
  return { total, completed, active };
}
