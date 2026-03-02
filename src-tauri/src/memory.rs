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
    pub timestamp: String,
}

pub struct MemoryManager {
    pub db_path: PathBuf,
}

impl MemoryManager {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        let db_path = app_data_dir.join("memory.sqlite");
        let conn = Connection::open(&db_path)?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        
        Ok(Self { db_path })
    }

    pub fn commit_finding(&self, finding: Finding) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute(
            "INSERT INTO findings (agent_id, content) VALUES (?1, ?2)",
            params![finding.agent_id, finding.content],
        )?;
        Ok(conn.last_insert_rowid())
    }

    #[allow(dead_code)]
    pub fn list_findings(&self) -> Result<Vec<Finding>> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare("SELECT id, agent_id, content, timestamp FROM findings ORDER BY timestamp DESC")?;
        let finding_iter = stmt.query_map([], |row| {
            Ok(Finding {
                id: Some(row.get(0)?),
                agent_id: row.get(1)?,
                content: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?;

        let mut findings = Vec::new();
        for finding in finding_iter {
            findings.push(finding?);
        }
        Ok(findings)
    }
}

pub type SharedMemoryManager = Arc<Mutex<MemoryManager>>;
