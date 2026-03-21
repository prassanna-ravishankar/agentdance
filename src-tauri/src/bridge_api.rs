use axum::{
    Router,
    extract::State,
    routing::{get, post},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::net::TcpListener;

use crate::process_manager::ProcessManager;
use crate::registry::AgentRegistry;

#[derive(Clone)]
pub struct BridgeState {
    pub registry: Arc<Mutex<AgentRegistry>>,
    pub process_manager: Arc<Mutex<ProcessManager>>,
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

async fn notify_agent(
    State(state): State<BridgeState>,
    Json(req): Json<NotifyRequest>,
) -> Json<NotifyResponse> {
    let target_id = {
        let registry = state.registry.lock().await;
        registry.find_by_name(&req.target_name).map(|a| a.id.clone())
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

    // Send the notification as a session/prompt to the target agent
    let req_id = crate::next_id();
    let json_rpc = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "session/prompt",
        "params": {
            "sessionId": session_id,
            "prompt": [{
                "type": "text",
                "text": format!("[Message from agent '{}'] {}", req.from_agent_id, req.message)
            }]
        },
        "id": req_id
    });

    let message_str = serde_json::to_string(&json_rpc).unwrap();
    let mut pm = state.process_manager.lock().await;
    match pm.send_input(target_id, message_str).await {
        Ok(()) => Json(NotifyResponse { success: true, error: None }),
        Err(e) => Json(NotifyResponse { success: false, error: Some(e) }),
    }
}

/// Starts the bridge HTTP API on a random localhost port. Returns the port.
pub async fn start_bridge_api(state: BridgeState) -> u16 {
    let app = Router::new()
        .route("/agents", get(list_agents))
        .route("/set_description", post(set_description))
        .route("/notify", post(notify_agent))
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await.expect("Failed to bind bridge API");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("Bridge API server error");
    });

    port
}
