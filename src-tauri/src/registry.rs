use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub directory: Option<String>,
    pub status: String,
    pub description: String,
    pub is_orchestrator: bool,
}

pub struct AgentRegistry {
    pub agents: HashMap<String, AgentInfo>,
    orchestrator_id: Option<String>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            orchestrator_id: None,
        }
    }

    pub fn register(&mut self, id: String, name: String, directory: Option<String>) {
        self.agents.insert(id.clone(), AgentInfo {
            id,
            name,
            directory,
            status: "idle".to_string(),
            description: String::new(),
            is_orchestrator: false,
        });
    }

    pub fn update_status(&mut self, id: &str, status: &str) {
        if let Some(agent) = self.agents.get_mut(id) {
            agent.status = status.to_string();
        }
    }

    pub fn set_description(&mut self, id: &str, description: String) {
        if let Some(agent) = self.agents.get_mut(id) {
            agent.description = description;
        }
    }

    pub fn set_orchestrator(&mut self, id: &str) -> bool {
        // Clear previous orchestrator
        if let Some(old_id) = &self.orchestrator_id {
            if let Some(old) = self.agents.get_mut(old_id) {
                old.is_orchestrator = false;
            }
        }
        if let Some(agent) = self.agents.get_mut(id) {
            agent.is_orchestrator = true;
            self.orchestrator_id = Some(id.to_string());
            true
        } else {
            false
        }
    }

    #[allow(dead_code)]
    pub fn clear_orchestrator(&mut self) {
        if let Some(old_id) = self.orchestrator_id.take() {
            if let Some(old) = self.agents.get_mut(&old_id) {
                old.is_orchestrator = false;
            }
        }
    }

    pub fn orchestrator_id(&self) -> Option<&str> {
        self.orchestrator_id.as_deref()
    }

    pub fn remove(&mut self, id: &str) {
        if self.orchestrator_id.as_deref() == Some(id) {
            self.orchestrator_id = None;
        }
        self.agents.remove(id);
    }

    pub fn list(&self) -> Vec<AgentInfo> {
        self.agents.values().cloned().collect()
    }

    pub fn find_by_name(&self, name: &str) -> Option<&AgentInfo> {
        self.agents.values().find(|a| a.name == name)
    }

    pub fn agent_summary(&self) -> String {
        let lines: Vec<String> = self.agents.values().map(|a| {
            format!("- {} ({}): {} | {}",
                a.name,
                a.directory.as_deref().unwrap_or("-"),
                a.status,
                if a.description.is_empty() { "no description" } else { &a.description }
            )
        }).collect();
        if lines.is_empty() {
            "No agents currently running.".to_string()
        } else {
            format!("Active agents:\n{}", lines.join("\n"))
        }
    }
}

pub type SharedAgentRegistry = Arc<Mutex<AgentRegistry>>;
