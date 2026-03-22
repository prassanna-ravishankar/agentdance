mod bridge_api;
mod mcp_host;
mod memory;
mod pending_queries;
mod process_manager;
mod registry;

use mcp_host::{McpRegistry, SharedMcpRegistry, McpTool};
use memory::{MemoryManager, SharedMemoryManager, Finding};
use bridge_api::BridgeState;
use pending_queries::{PendingQueries, SharedPendingQueries};
use process_manager::{ProcessManager, SharedProcessManager, SpawnConfig};
use registry::{AgentRegistry, SharedAgentRegistry};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};

type SharedAppDataDir = Arc<Mutex<PathBuf>>;

struct BridgeConfig {
    port: u16,
    script_path: PathBuf,
}
type SharedBridgeConfig = Arc<BridgeConfig>;

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

pub fn next_id() -> u64 {
    REQUEST_ID.fetch_add(1, Ordering::SeqCst)
}

#[derive(Clone, Serialize, Deserialize)]
struct AgentPlanTask {
    id: String,
    title: String,
    status: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct AgentPlan {
    id: String,
    agent_id: String,
    title: String,
    tasks: Vec<AgentPlanTask>,
}

#[derive(Clone, Serialize, Deserialize)]
struct AgentUpdate {
    id: String,
    name: Option<String>,
    status: String,
    plan: Option<AgentPlan>,
    fork_of: Option<String>,
    message: Option<String>,
}

#[tauri::command]
async fn connect_agent(
    handle: AppHandle,
    name: String,
    command: String,
    args: Vec<String>,
    directory: Option<String>,
    state: tauri::State<'_, SharedProcessManager>,
    registry: tauri::State<'_, SharedAgentRegistry>,
    bridge_config: tauri::State<'_, SharedBridgeConfig>,
    pending: tauri::State<'_, SharedPendingQueries>,
) -> Result<String, String> {
    let mut cmd = Command::new(&command);
    cmd.args(&args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.stdin(Stdio::piped());

    if let Some(ref dir) = directory {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn agent process: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let agent_id = format!("agent-{}", &uuid::Uuid::new_v4().to_string()[..8]);
    let cwd = directory.unwrap_or_else(|| ".".to_string());

    {
        let mut mgr = state.lock().await;
        mgr.register_child(agent_id.clone(), child);
    }

    let mut reader = BufReader::new(stdout).lines();

    // ── Step 1: send initialize, wait for its response ──────────────────────
    let init_id = next_id();
    let init_str = serde_json::to_string(&serde_json::json!({
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": { "protocolVersion": 1, "clientCapabilities": {} },
        "id": init_id
    })).unwrap();
    let _ = handle.emit("agent-log", serde_json::json!({"agent_id": agent_id, "stream": "stdin", "line": init_str}));
    stdin.write_all(format!("{}\n", init_str).as_bytes()).await
        .map_err(|e| format!("Failed to send initialize: {}", e))?;

    loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                let _ = handle.emit("agent-log", serde_json::json!({"agent_id": agent_id, "stream": "stdout", "line": line}));
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if json.get("id").and_then(|v| v.as_u64()) == Some(init_id) {
                        break; // got initialize response
                    }
                }
            }
            _ => return Err("Agent closed stdout during initialize".to_string()),
        }
    }

    // ── Step 2: send newSession with MCP bridge ────────────────────────────
    let ns_id = next_id();
    let ns_str = serde_json::to_string(&serde_json::json!({
        "jsonrpc": "2.0",
        "method": "session/new",
        "params": {
            "cwd": cwd,
            "mcpServers": [{
                "name": "agentdance",
                "command": "node",
                "args": [bridge_config.script_path.to_string_lossy(), bridge_config.port.to_string(), agent_id],
            }]
        },
        "id": ns_id
    })).unwrap();
    let _ = handle.emit("agent-log", serde_json::json!({"agent_id": agent_id, "stream": "stdin", "line": ns_str}));
    stdin.write_all(format!("{}\n", ns_str).as_bytes()).await
        .map_err(|e| format!("Failed to send newSession: {}", e))?;

    let session_id = loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                let _ = handle.emit("agent-log", serde_json::json!({"agent_id": agent_id, "stream": "stdout", "line": line}));
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if json.get("id").and_then(|v| v.as_u64()) == Some(ns_id) {
                        match json.get("result").and_then(|r| r.get("sessionId")).and_then(|s| s.as_str()) {
                            Some(sid) => break sid.to_string(),
                            None => return Err(format!("newSession failed: {}", line)),
                        }
                    }
                }
            }
            _ => return Err("Agent closed stdout during newSession".to_string()),
        }
    };

    {
        let mut mgr = state.lock().await;
        mgr.register_session_id(agent_id.clone(), session_id);
        mgr.register_stdin(agent_id.clone(), stdin);
        let dir_opt = if cwd == "." { None } else { Some(cwd.clone()) };
        mgr.register_spawn_config(agent_id.clone(), SpawnConfig {
            name: name.clone(),
            command: command.clone(),
            args: args.clone(),
            directory: dir_opt.clone(),
        });
    }
    {
        let dir_opt = if cwd == "." { None } else { Some(cwd) };
        let mut reg = registry.lock().await;
        reg.register(agent_id.clone(), name.clone(), dir_opt);
    }

    let _ = handle.emit("agent-update", AgentUpdate {
        id: agent_id.clone(),
        name: Some(name.clone()),
        status: "idle".to_string(),
        plan: None,
        fork_of: None,
        message: None,
    });

    // Notify orchestrator about new agent
    let reg_ref = registry.inner().clone();
    let pm_ref = state.inner().clone();
    let agent_name_for_notif = name.clone();
    tauri::async_runtime::spawn(async move {
        notify_orchestrator(&reg_ref, &pm_ref, &format!("Agent '{}' has joined.", agent_name_for_notif)).await;
    });

    let id_clone = agent_id.clone();
    let handle_clone = handle.clone();
    let state_clone = state.inner().clone();
    let registry_clone = registry.inner().clone();
    let pending_clone = pending.inner().clone();

    let id_for_stderr = agent_id.clone();
    let handle_for_stderr = handle.clone();
    tauri::async_runtime::spawn(async move {
        let mut err_reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = err_reader.next_line().await {
            let _ = handle_for_stderr.emit("agent-log", serde_json::json!({
                "agent_id": id_for_stderr,
                "stream": "stderr",
                "line": line
            }));
        }
    });

    tauri::async_runtime::spawn(async move {
        let mut message_buf = String::new();
        let pm = state_clone;
        let reg = registry_clone;
        let pq = pending_clone;

        while let Ok(Some(line)) = reader.next_line().await {
            let _ = handle_clone.emit("agent-log", serde_json::json!({
                "agent_id": id_clone,
                "stream": "stdout",
                "line": line
            }));

            let json: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Response to a prompt request
            if json.get("id").is_some() {
                if json.get("result").and_then(|r| r.get("stopReason")).is_some() {
                    // Schedule idle after 200ms — enough time for any trailing chunks
                    let h = handle_clone.clone();
                    let id = id_clone.clone();
                    let reg2 = reg.clone();
                    let pq2 = pq.clone();
                    let msg = if message_buf.is_empty() { None } else { Some(message_buf.clone()) };
                    message_buf.clear();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                        reg2.lock().await.update_status(&id, "idle");
                        // Resolve any pending synchronous query
                        if let Some(ref response_text) = msg {
                            pq2.lock().await.resolve(&id, response_text.clone());
                        }
                        let _ = h.emit("agent-update", AgentUpdate {
                            id,
                            name: None,
                            status: "idle".to_string(),
                            plan: None,
                            fork_of: None,
                            message: msg,
                        });
                    });
                }
                continue;
            }

            // Permission request: auto-approve with allow_always
            if json.get("method").and_then(|m| m.as_str()) == Some("session/request_permission") {
                let req_id = json.get("id").cloned().unwrap_or(serde_json::Value::Null);
                let response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": { "optionId": "allow_always" }
                });
                let response_str = serde_json::to_string(&response).unwrap();
                let _ = handle_clone.emit("agent-log", serde_json::json!({
                    "agent_id": id_clone, "stream": "stdin", "line": response_str
                }));
                let mut mgr = pm.lock().await;
                let _ = mgr.send_input(id_clone.clone(), response_str).await;
                continue;
            }

            // Notification: {method:"session/update", params:{sessionId, update:{sessionUpdate,...}}}
            if json.get("method").and_then(|m| m.as_str()) == Some("session/update") {
                reg.lock().await.update_status(&id_clone, "busy");
                let update = json.get("params").and_then(|p| p.get("update"));

                let session_update_type = update
                    .and_then(|u| u.get("sessionUpdate"))
                    .and_then(|s| s.as_str());

                match session_update_type {
                    Some("plan") => {
                        if let Some(entries) = update.and_then(|u| u.get("entries")).and_then(|e| e.as_array()) {
                            let tasks: Vec<AgentPlanTask> = entries.iter().enumerate().map(|(i, entry)| {
                                let content = entry.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
                                let raw_status = entry.get("status").and_then(|s| s.as_str()).unwrap_or("pending");
                                let status = match raw_status {
                                    "in_progress" => "running",
                                    other => other,
                                }.to_string();
                                AgentPlanTask { id: format!("t{}", i), title: content, status }
                            }).collect();

                            let _ = handle_clone.emit("agent-update", AgentUpdate {
                                id: id_clone.clone(),
                                name: None,
                                status: "busy".to_string(),
                                plan: Some(AgentPlan {
                                    id: format!("p-{}", id_clone),
                                    agent_id: id_clone.clone(),
                                    title: "Agent Plan".to_string(),
                                    tasks,
                                }),
                                fork_of: None,
                                message: None,
                            });
                        }
                    }
                    Some("agent_message_chunk") => {
                        let text = update
                            .and_then(|u| u.get("content"))
                            .and_then(|c| c.get("text"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("");
                        message_buf.push_str(text);
                        let _ = handle_clone.emit("agent-update", AgentUpdate {
                            id: id_clone.clone(),
                            name: None,
                            status: "busy".to_string(),
                            plan: None,
                            fork_of: None,
                            message: Some(message_buf.clone()),
                        });
                    }
                    _ => {}
                }
            }
        }

        // stdout closed — agent process exited
        let _ = handle_clone.emit("agent-log", serde_json::json!({
            "agent_id": id_clone,
            "stream": "stderr",
            "line": "[agentdance] process exited"
        }));
        let _ = handle_clone.emit("agent-update", AgentUpdate {
            id: id_clone.clone(),
            name: None,
            status: "disconnected".to_string(),
            plan: None,
            fork_of: None,
            message: None,
        });
        // Clean up + notify orchestrator
        let (agent_name, was_orchestrator) = {
            let r = reg.lock().await;
            let name = r.agents.get(&id_clone).map(|a| a.name.clone()).unwrap_or_default();
            let was_orch = r.orchestrator_id() == Some(id_clone.as_str());
            (name, was_orch)
        };
        let mut mgr = pm.lock().await;
        let _ = mgr.kill_agent(&id_clone).await;
        drop(mgr);
        reg.lock().await.remove(&id_clone);
        if was_orchestrator {
            let _ = handle_clone.emit("orchestrator-changed", serde_json::json!({"agent_id": serde_json::Value::Null}));
        }
        notify_orchestrator(&reg, &pm, &format!("Agent '{}' has disconnected.", agent_name)).await;
    });

    Ok(agent_id)
}

#[tauri::command]
async fn send_agent_input(
    _handle: AppHandle,
    state: tauri::State<'_, SharedProcessManager>,
    agent_id: String,
    message: String
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.send_prompt(&agent_id, &message).await
}

#[tauri::command]
async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
async fn commit_finding(state: tauri::State<'_, SharedMemoryManager>, agent_id: String, content: String) -> Result<i64, String> {
    let manager = state.lock().await;
    manager.commit_finding(Finding {
        id: None,
        agent_id,
        content,
        tags: vec![],
        timestamp: "".to_string(),
    }).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_tools(state: tauri::State<'_, SharedMcpRegistry>) -> Result<Vec<McpTool>, String> {
    let registry = state.lock().await;
    Ok(registry.list_all_tools())
}

#[tauri::command]
async fn load_previous_session(
    data_dir: tauri::State<'_, SharedAppDataDir>,
) -> Result<Vec<SpawnConfig>, String> {
    let dir = data_dir.lock().await;
    ProcessManager::load_session(&dir.join("session.json"))
}

/// Notify the orchestrator (if any) about an event. Non-blocking.
async fn notify_orchestrator(
    registry: &SharedAgentRegistry,
    pm: &SharedProcessManager,
    message: &str,
) {
    let orch_id = {
        let reg = registry.lock().await;
        match reg.orchestrator_id() {
            Some(id) => id.to_string(),
            None => return,
        }
    };
    let text = format!("[Orchestrator notification] {}", message);
    let mut mgr = pm.lock().await;
    let _ = mgr.send_prompt(&orch_id, &text).await;
}

#[tauri::command]
async fn set_orchestrator(
    handle: AppHandle,
    state: tauri::State<'_, SharedProcessManager>,
    registry: tauri::State<'_, SharedAgentRegistry>,
    agent_id: String,
) -> Result<(), String> {
    let summary = {
        let mut reg = registry.lock().await;
        if !reg.set_orchestrator(&agent_id) {
            return Err(format!("Agent not found: {}", agent_id));
        }
        reg.agent_summary()
    };
    let context = format!(
        "[You are now the orchestrator] You coordinate the work of all agents. \
         Delegate tasks, monitor progress, and ensure agents collaborate effectively.\n\n\
         {}\n\n\
         You have access to: list_agents, notify_agent, ask_agent, broadcast, \
         spawn_sub_agent, write_shared_memory, read_shared_memory.\n\
         You will be automatically notified when agents join or leave.",
        summary
    );
    let mut mgr = state.lock().await;
    let _ = mgr.send_prompt(&agent_id, &context).await;
    drop(mgr);
    let _ = handle.emit("orchestrator-changed", serde_json::json!({"agent_id": agent_id}));
    Ok(())
}

#[tauri::command]
async fn stop_agent(
    handle: AppHandle,
    state: tauri::State<'_, SharedProcessManager>,
    registry: tauri::State<'_, SharedAgentRegistry>,
    agent_id: String,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.kill_agent(&agent_id).await?;
    drop(mgr);
    let mut reg = registry.lock().await;
    reg.remove(&agent_id);
    let _ = handle.emit("agent-update", AgentUpdate {
        id: agent_id,
        name: None,
        status: "disconnected".to_string(),
        plan: None,
        fork_of: None,
        message: None,
    });
    Ok(())
}

#[tauri::command]
async fn fork_session(
    handle: AppHandle,
    state: tauri::State<'_, SharedProcessManager>,
    registry: tauri::State<'_, SharedAgentRegistry>,
    bridge_config: tauri::State<'_, SharedBridgeConfig>,
    pending: tauri::State<'_, SharedPendingQueries>,
    agent_id: String,
    context: Option<String>,
) -> Result<String, String> {
    let config = {
        let mgr = state.lock().await;
        mgr.get_spawn_config(&agent_id)
            .cloned()
            .ok_or_else(|| format!("No spawn config for agent: {}", agent_id))?
    };

    let fork_name = format!("{} (Fork)", config.name);
    let fork_id = connect_agent(
        handle.clone(),
        fork_name,
        config.command,
        config.args,
        config.directory,
        state.clone(),
        registry.clone(),
        bridge_config.clone(),
        pending.clone(),
    ).await?;

    // Send context prompt to the forked agent so it picks up where the parent was
    let ctx = context.unwrap_or_else(|| format!(
        "You are a forked exploration from agent {}. \
         Take an alternative approach to the task at hand. \
         Explore different solutions or strategies than the original agent.",
        agent_id
    ));
    send_agent_input(handle.clone(), state, fork_id.clone(), ctx).await?;

    // Mark fork relationship
    let _ = handle.emit("agent-update", AgentUpdate {
        id: fork_id.clone(),
        name: None,
        status: "busy".to_string(),
        plan: None,
        fork_of: Some(agent_id),
        message: None,
    });

    Ok(fork_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(debug_assertions)]
    { builder = builder.plugin(tauri_plugin_webdriver::init()); }

    builder
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let pm = window.state::<SharedProcessManager>().inner().clone();
                let data_dir = window.state::<SharedAppDataDir>().inner().clone();
                tauri::async_runtime::block_on(async {
                    let mut mgr = pm.lock().await;
                    let dir = data_dir.lock().await;
                    let _ = mgr.save_session(&dir.join("session.json"));
                    mgr.kill_all().await;
                });
            }
        })
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("./data"));
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir).unwrap();
            }

            let memory_manager = Arc::new(Mutex::new(MemoryManager::new(app_data_dir.clone()).expect("Failed to init memory")));
            let mcp_registry = Arc::new(Mutex::new(McpRegistry::new()));
            let process_manager: SharedProcessManager = Arc::new(Mutex::new(ProcessManager::new()));
            let agent_registry: SharedAgentRegistry = Arc::new(Mutex::new(AgentRegistry::new()));
            let pending_queries: SharedPendingQueries = Arc::new(Mutex::new(PendingQueries::new()));
            let data_dir: SharedAppDataDir = Arc::new(Mutex::new(app_data_dir));

            // Start bridge HTTP API for inter-agent communication
            let bridge_state = BridgeState {
                registry: agent_registry.clone(),
                process_manager: process_manager.clone(),
                pending_queries: pending_queries.clone(),
                memory: memory_manager.clone(),
                app_handle: app.handle().clone(),
            };
            let port = tauri::async_runtime::block_on(bridge_api::start_bridge_api(bridge_state));
            let script_path = app.path().resource_dir()
                .map(|d| d.join("mcp-bridge.mjs"))
                .unwrap_or_else(|_| PathBuf::from("mcp-bridge.mjs"));
            let bridge_config: SharedBridgeConfig = Arc::new(BridgeConfig { port, script_path });
            log::info!("Bridge API started on port {}", port);

            app.manage(memory_manager);
            app.manage(mcp_registry);
            app.manage(process_manager);
            app.manage(agent_registry);
            app.manage(data_dir);
            app.manage(bridge_config);
            app.manage(pending_queries);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fork_session,
            commit_finding,
            list_tools,
            connect_agent,
            send_agent_input,
            stop_agent,
            set_orchestrator,
            load_previous_session,
            pick_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
