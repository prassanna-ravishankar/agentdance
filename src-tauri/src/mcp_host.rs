use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServerManifest {
    pub name: String,
    pub tools: Vec<McpTool>,
}

pub struct McpRegistry {
    pub servers: HashMap<String, McpServerManifest>,
}

impl McpRegistry {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    pub fn register_server(&mut self, manifest: McpServerManifest) {
        self.servers.insert(manifest.name.clone(), manifest);
    }

    pub fn list_all_tools(&self) -> Vec<McpTool> {
        self.servers.values().flat_map(|s| s.tools.clone()).collect()
    }
}

pub type SharedMcpRegistry = Arc<Mutex<McpRegistry>>;
