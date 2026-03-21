use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};

/// Stores pending synchronous queries waiting for an agent's response.
/// Key: target agent_id. Value: oneshot sender to resolve with the response text.
/// Only one pending query per target at a time (last writer wins).
pub struct PendingQueries {
    senders: HashMap<String, oneshot::Sender<String>>,
}

impl PendingQueries {
    pub fn new() -> Self {
        Self { senders: HashMap::new() }
    }

    /// Register a pending query for a target agent. Returns a receiver to await.
    pub fn register(&mut self, agent_id: String) -> oneshot::Receiver<String> {
        let (tx, rx) = oneshot::channel();
        // If there's already a pending query, the old sender gets dropped (caller gets error)
        self.senders.insert(agent_id, tx);
        rx
    }

    /// Resolve a pending query with the agent's response. Returns true if resolved.
    pub fn resolve(&mut self, agent_id: &str, response: String) -> bool {
        if let Some(tx) = self.senders.remove(agent_id) {
            tx.send(response).is_ok()
        } else {
            false
        }
    }

    #[allow(dead_code)]
    pub fn has_pending(&self, agent_id: &str) -> bool {
        self.senders.contains_key(agent_id)
    }
}

pub type SharedPendingQueries = Arc<Mutex<PendingQueries>>;
