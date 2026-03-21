use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Finding {
    pub id: Option<i64>,
    pub agent_id: String,
    pub content: String,
    pub tags: Vec<String>,
    pub timestamp: String,
}

pub struct MemoryManager {
    db_path: PathBuf,
}

impl MemoryManager {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        let db_path = app_data_dir.join("memory.sqlite");
        let conn = Connection::open(&db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_findings_tags ON findings(tags);
            CREATE INDEX IF NOT EXISTS idx_findings_agent ON findings(agent_id);"
        )?;

        Ok(Self { db_path })
    }

    pub fn write(&self, agent_id: &str, content: &str, tags: &[String]) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;
        let tags_str = tags.join(",");
        conn.execute(
            "INSERT INTO findings (agent_id, content, tags) VALUES (?1, ?2, ?3)",
            params![agent_id, content, tags_str],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn read_all(&self, limit: usize) -> Result<Vec<Finding>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, content, tags, timestamp FROM findings ORDER BY timestamp DESC LIMIT ?1"
        )?;
        Self::collect_findings(&mut stmt, params![limit as i64])
    }

    pub fn read_by_agent(&self, agent_id: &str, limit: usize) -> Result<Vec<Finding>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, content, tags, timestamp FROM findings WHERE agent_id = ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;
        Self::collect_findings(&mut stmt, params![agent_id, limit as i64])
    }

    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<Finding>> {
        let conn = Connection::open(&self.db_path)?;
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, content, tags, timestamp FROM findings WHERE content LIKE ?1 OR tags LIKE ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;
        Self::collect_findings(&mut stmt, params![pattern, limit as i64])
    }

    pub fn read_by_tag(&self, tag: &str, limit: usize) -> Result<Vec<Finding>> {
        let conn = Connection::open(&self.db_path)?;
        let pattern = format!("%{}%", tag);
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, content, tags, timestamp FROM findings WHERE tags LIKE ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;
        Self::collect_findings(&mut stmt, params![pattern, limit as i64])
    }

    // Keep old interface for backward compat with commit_finding Tauri command
    pub fn commit_finding(&self, finding: Finding) -> Result<i64> {
        self.write(&finding.agent_id, &finding.content, &finding.tags)
    }

    fn collect_findings(stmt: &mut rusqlite::Statement, params: impl rusqlite::Params) -> Result<Vec<Finding>> {
        let rows = stmt.query_map(params, |row| {
            let tags_str: String = row.get(3)?;
            Ok(Finding {
                id: Some(row.get(0)?),
                agent_id: row.get(1)?,
                content: row.get(2)?,
                tags: if tags_str.is_empty() { vec![] } else { tags_str.split(',').map(|s| s.to_string()).collect() },
                timestamp: row.get(4)?,
            })
        })?;
        rows.collect()
    }
}

pub type SharedMemoryManager = Arc<Mutex<MemoryManager>>;
