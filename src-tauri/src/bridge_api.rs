use axum::{
    Router,
    extract::State,
    routing::{get, post},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::net::TcpListener;

use crate::memory::MemoryManager;
use crate::pending_queries::PendingQueries;
use crate::process_manager::ProcessManager;
use crate::registry::AgentRegistry;

fn truncate_utf8(s: &str, max_chars: usize) -> String {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => format!("{}…", &s[..idx]),
        None => s.to_string(),
    }
}

#[derive(Clone, Serialize)]
pub struct CommEvent {
    pub from_name: String,
    pub from_id: String,
    pub to_name: String,
    pub to_id: String,
    pub kind: String, // "notify", "ask", "broadcast", "response"
    pub message: String,
    pub timestamp: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone)]
pub struct BridgeState {
    pub registry: Arc<Mutex<AgentRegistry>>,
    pub process_manager: Arc<Mutex<ProcessManager>>,
    pub pending_queries: Arc<Mutex<PendingQueries>>,
    pub memory: Arc<Mutex<MemoryManager>>,
    pub app_handle: AppHandle,
}

#[derive(Serialize)]
struct AgentListResponse {
    agents: Vec<crate::registry::AgentInfo>,
}

#[derive(Deserialize)]
struct SetDescriptionRequest {
    agent_id: String,
    description: String,
}

#[derive(Deserialize)]
struct NotifyRequest {
    from_agent_id: String,
    target_name: String,
    message: String,
}

#[derive(Serialize)]
struct NotifyResponse {
    success: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
struct AskRequest {
    from_agent_id: String,
    target_name: String,
    question: String,
}

#[derive(Serialize)]
struct AskResponse {
    success: bool,
    response: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct BroadcastRequest {
    from_agent_id: String,
    message: String,
    exclude_self: Option<bool>,
}

#[derive(Serialize)]
struct BroadcastResponse {
    success: bool,
    sent_to: Vec<String>,
}

async fn list_agents(State(state): State<BridgeState>) -> Json<AgentListResponse> {
    let registry = state.registry.lock().await;
    Json(AgentListResponse {
        agents: registry.list(),
    })
}

async fn set_description(
    State(state): State<BridgeState>,
    Json(req): Json<SetDescriptionRequest>,
) -> Json<serde_json::Value> {
    let mut registry = state.registry.lock().await;
    registry.set_description(&req.agent_id, req.description);
    Json(serde_json::json!({"success": true}))
}

/// Helper: resolve target agent ID and sender name from registry
fn resolve_target_and_sender(
    registry: &AgentRegistry,
    target_name: &str,
    from_agent_id: &str,
) -> (Option<String>, String) {
    let target = registry.find_by_name(target_name).map(|a| a.id.clone());
    let sender = registry.agents.get(from_agent_id)
        .map(|a| a.name.clone())
        .unwrap_or_else(|| from_agent_id.to_string());
    (target, sender)
}

/// Helper: send a prompt to an agent's stdin. Returns Ok(()) or error string.
async fn send_prompt_to_agent(
    pm: &Arc<Mutex<ProcessManager>>,
    target_id: &str,
    session_id: &str,
    text: &str,
) -> Result<(), String> {
    let req_id = crate::next_id();
    let json_rpc = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "session/prompt",
        "params": {
            "sessionId": session_id,
            "prompt": [{ "type": "text", "text": text }]
        },
        "id": req_id
    });
    let message_str = serde_json::to_string(&json_rpc).unwrap();
    let mut mgr = pm.lock().await;
    mgr.send_input(target_id.to_string(), message_str).await
}

async fn notify_agent(
    State(state): State<BridgeState>,
    Json(req): Json<NotifyRequest>,
) -> Json<NotifyResponse> {
    let (target_id, sender_name) = {
        let registry = state.registry.lock().await;
        resolve_target_and_sender(&registry, &req.target_name, &req.from_agent_id)
    };

    let target_id = match target_id {
        Some(id) => id,
        None => return Json(NotifyResponse {
            success: false,
            error: Some(format!("No agent found with name: {}", req.target_name)),
        }),
    };

    let session_id = {
        let pm = state.process_manager.lock().await;
        pm.get_session_id(&target_id).cloned()
    };

    let session_id = match session_id {
        Some(id) => id,
        None => return Json(NotifyResponse {
            success: false,
            error: Some(format!("Agent '{}' has no active session", req.target_name)),
        }),
    };

    let text = format!("[Message from '{}'] {}", sender_name, req.message);
    match send_prompt_to_agent(&state.process_manager, &target_id, &session_id, &text).await {
        Ok(()) => {
            let _ = state.app_handle.emit("agent-comm", CommEvent {
                from_name: sender_name, from_id: req.from_agent_id,
                to_name: req.target_name.clone(), to_id: target_id,
                kind: "notify".to_string(), message: req.message, timestamp: now_ms(),
            });
            Json(NotifyResponse { success: true, error: None })
        }
        Err(e) => Json(NotifyResponse { success: false, error: Some(e) }),
    }
}

async fn ask_agent(
    State(state): State<BridgeState>,
    Json(req): Json<AskRequest>,
) -> Json<AskResponse> {
    let (target_id, sender_name) = {
        let registry = state.registry.lock().await;
        resolve_target_and_sender(&registry, &req.target_name, &req.from_agent_id)
    };

    let target_id = match target_id {
        Some(id) => id,
        None => return Json(AskResponse {
            success: false,
            response: None,
            error: Some(format!("No agent found with name: {}", req.target_name)),
        }),
    };

    let session_id = {
        let pm = state.process_manager.lock().await;
        pm.get_session_id(&target_id).cloned()
    };

    let session_id = match session_id {
        Some(id) => id,
        None => return Json(AskResponse {
            success: false,
            response: None,
            error: Some(format!("Agent '{}' has no active session", req.target_name)),
        }),
    };

    // Register a pending query channel before sending the prompt
    let rx = {
        let mut pq = state.pending_queries.lock().await;
        pq.register(target_id.clone())
    };

    let text = format!("[Question from '{}' — please respond directly] {}", sender_name, req.question);
    let _ = state.app_handle.emit("agent-comm", CommEvent {
        from_name: sender_name.clone(), from_id: req.from_agent_id.clone(),
        to_name: req.target_name.clone(), to_id: target_id.clone(),
        kind: "ask".to_string(), message: req.question.clone(), timestamp: now_ms(),
    });
    if let Err(e) = send_prompt_to_agent(&state.process_manager, &target_id, &session_id, &text).await {
        // Clean up the pending query
        let mut pq = state.pending_queries.lock().await;
        pq.resolve(&target_id, String::new());
        return Json(AskResponse {
            success: false,
            response: None,
            error: Some(e),
        });
    }

    // Wait for response with 60s timeout
    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(response)) => {
            let _ = state.app_handle.emit("agent-comm", CommEvent {
                from_name: req.target_name.clone(), from_id: target_id,
                to_name: sender_name, to_id: req.from_agent_id,
                kind: "response".to_string(),
                message: truncate_utf8(&response, 200),
                timestamp: now_ms(),
            });
            Json(AskResponse { success: true, response: Some(response), error: None })
        }
        Ok(Err(_)) => Json(AskResponse {
            success: false,
            response: None,
            error: Some("Response channel closed unexpectedly".to_string()),
        }),
        Err(_) => {
            // Timeout — clean up
            let mut pq = state.pending_queries.lock().await;
            pq.resolve(&target_id, String::new());
            Json(AskResponse {
                success: false,
                response: None,
                error: Some("Timed out waiting for response (60s)".to_string()),
            })
        }
    }
}

async fn broadcast_to_agents(
    State(state): State<BridgeState>,
    Json(req): Json<BroadcastRequest>,
) -> Json<BroadcastResponse> {
    let exclude_self = req.exclude_self.unwrap_or(true);

    let (targets, sender_name) = {
        let registry = state.registry.lock().await;
        let sender = registry.agents.get(&req.from_agent_id)
            .map(|a| a.name.clone())
            .unwrap_or_else(|| req.from_agent_id.clone());
        let targets: Vec<(String, String)> = registry.list().iter()
            .filter(|a| !exclude_self || a.id != req.from_agent_id)
            .map(|a| (a.id.clone(), a.name.clone()))
            .collect();
        (targets, sender)
    };

    let text = format!("[Broadcast from '{}'] {}", sender_name, req.message);
    let mut sent_to = Vec::new();

    for (agent_id, agent_name) in targets {
        let session_id = {
            let pm = state.process_manager.lock().await;
            pm.get_session_id(&agent_id).cloned()
        };
        if let Some(sid) = session_id {
            if send_prompt_to_agent(&state.process_manager, &agent_id, &sid, &text).await.is_ok() {
                sent_to.push(agent_name.clone());
                let _ = state.app_handle.emit("agent-comm", CommEvent {
                    from_name: sender_name.clone(), from_id: req.from_agent_id.clone(),
                    to_name: agent_name, to_id: agent_id,
                    kind: "broadcast".to_string(), message: req.message.clone(), timestamp: now_ms(),
                });
            }
        }
    }

    Json(BroadcastResponse {
        success: true,
        sent_to,
    })
}

#[derive(Deserialize)]
struct MemoryWriteRequest {
    agent_id: String,
    content: String,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct MemoryReadRequest {
    query: Option<String>,
    tag: Option<String>,
    agent_id: Option<String>,
    limit: Option<usize>,
}

#[derive(Serialize)]
struct MemoryEntry {
    id: i64,
    agent: String,
    content: String,
    tags: Vec<String>,
    timestamp: String,
}

async fn memory_write(
    State(state): State<BridgeState>,
    Json(req): Json<MemoryWriteRequest>,
) -> Json<serde_json::Value> {
    let mem = state.memory.lock().await;
    let tags = req.tags.unwrap_or_default();
    match mem.write(&req.agent_id, &req.content, &tags) {
        Ok(id) => Json(serde_json::json!({"success": true, "id": id})),
        Err(e) => Json(serde_json::json!({"success": false, "error": e.to_string()})),
    }
}

async fn memory_read(
    State(state): State<BridgeState>,
    Json(req): Json<MemoryReadRequest>,
) -> Json<serde_json::Value> {
    let mem = state.memory.lock().await;
    let limit = req.limit.unwrap_or(20);

    let findings = if let Some(query) = &req.query {
        mem.search(query, limit)
    } else if let Some(tag) = &req.tag {
        mem.read_by_tag(tag, limit)
    } else if let Some(agent_id) = &req.agent_id {
        mem.read_by_agent(agent_id, limit)
    } else {
        mem.read_all(limit)
    };

    match findings {
        Ok(items) => {
            let entries: Vec<MemoryEntry> = items.into_iter().map(|f| MemoryEntry {
                id: f.id.unwrap_or(0),
                agent: f.agent_id,
                content: f.content,
                tags: f.tags,
                timestamp: f.timestamp,
            }).collect();
            Json(serde_json::json!({"success": true, "entries": entries}))
        }
        Err(e) => Json(serde_json::json!({"success": false, "error": e.to_string()})),
    }
}

pub async fn start_bridge_api(state: BridgeState) -> u16 {
    let app = Router::new()
        .route("/agents", get(list_agents))
        .route("/set_description", post(set_description))
        .route("/notify", post(notify_agent))
        .route("/ask", post(ask_agent))
        .route("/broadcast", post(broadcast_to_agents))
        .route("/memory/write", post(memory_write))
        .route("/memory/read", post(memory_read))
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await.expect("Failed to bind bridge API");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("Bridge API server error");
    });

    port
}
