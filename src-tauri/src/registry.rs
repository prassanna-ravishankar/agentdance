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
}

pub struct AgentRegistry {
    pub agents: HashMap<String, AgentInfo>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    pub fn register(&mut self, id: String, name: String, directory: Option<String>) {
        self.agents.insert(id.clone(), AgentInfo {
            id,
            name,
            directory,
            status: "idle".to_string(),
            description: String::new(),
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

    pub fn remove(&mut self, id: &str) {
        self.agents.remove(id);
    }

    pub fn list(&self) -> Vec<AgentInfo> {
        self.agents.values().cloned().collect()
    }

    pub fn find_by_name(&self, name: &str) -> Option<&AgentInfo> {
        self.agents.values().find(|a| a.name == name)
    }
}

pub type SharedAgentRegistry = Arc<Mutex<AgentRegistry>>;
