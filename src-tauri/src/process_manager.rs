use tokio::process::ChildStdin;
use tokio::io::AsyncWriteExt;
use std::collections::HashMap;
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct ProcessManager {
    pub inputs: HashMap<String, ChildStdin>,
    pub session_ids: HashMap<String, String>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            inputs: HashMap::new(),
            session_ids: HashMap::new(),
        }
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
}

pub type SharedProcessManager = Arc<Mutex<ProcessManager>>;
