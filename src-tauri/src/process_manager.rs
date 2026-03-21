use tokio::process::{Child, ChildStdin};
use tokio::io::AsyncWriteExt;
use std::collections::HashMap;
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct ProcessManager {
    pub inputs: HashMap<String, ChildStdin>,
    pub session_ids: HashMap<String, String>,
    pub children: HashMap<String, Child>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            inputs: HashMap::new(),
            session_ids: HashMap::new(),
            children: HashMap::new(),
        }
    }

    pub fn register_child(&mut self, id: String, child: Child) {
        self.children.insert(id, child);
    }

    pub fn register_stdin(&mut self, id: String, stdin: ChildStdin) {
        self.inputs.insert(id, stdin);
    }

    pub fn register_session_id(&mut self, agent_id: String, session_id: String) {
        self.session_ids.insert(agent_id, session_id);
    }

    pub fn get_session_id(&self, agent_id: &str) -> Option<&String> {
        self.session_ids.get(agent_id)
    }

    pub async fn send_input(&mut self, id: String, message: String) -> Result<(), String> {
        if let Some(stdin) = self.inputs.get_mut(&id) {
            stdin.write_all(format!("{}\n", message).as_bytes())
                .await
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            Ok(())
        } else {
            Err(format!("No active process found for agent ID: {}", id))
        }
    }

    pub async fn kill_agent(&mut self, id: &str) -> Result<(), String> {
        self.inputs.remove(id);
        self.session_ids.remove(id);
        if let Some(mut child) = self.children.remove(id) {
            child.kill().await.map_err(|e| format!("Failed to kill agent {}: {}", id, e))?;
        }
        Ok(())
    }

    pub async fn kill_all(&mut self) {
        let ids: Vec<String> = self.children.keys().cloned().collect();
        for id in ids {
            let _ = self.kill_agent(&id).await;
        }
    }
}

pub type SharedProcessManager = Arc<Mutex<ProcessManager>>;
