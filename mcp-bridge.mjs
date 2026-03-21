#!/usr/bin/env node
// MCP stdio server that bridges agentdance tools to agents.
// Usage: node mcp-bridge.mjs <port> <agent_id>

import { createInterface } from "readline";

const PORT = process.argv[2];
const AGENT_ID = process.argv[3];
const BASE = `http://127.0.0.1:${PORT}`;

const TOOLS = [
  {
    name: "list_agents",
    description: "List all agents currently running in agentdance. Returns each agent's name, directory, status, and description.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "set_description",
    description: "Set your description visible to other agents. Call this early so peers know what you're working on.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Short description of your current task" },
      },
      required: ["description"],
    },
  },
  {
    name: "notify_agent",
    description: "Send a fire-and-forget message to another agent by name. Use for delegation, status updates, or requests. The target agent receives your message as a prompt. Does not wait for a response.",
    inputSchema: {
      type: "object",
      properties: {
        target_name: { type: "string", description: "Name of the agent to notify" },
        message: { type: "string", description: "The message to send" },
      },
      required: ["target_name", "message"],
    },
  },
  {
    name: "ask_agent",
    description: "Send a question to another agent and wait for their response. Blocks until the target agent completes their response or times out (60s). Use when you need an answer before proceeding.",
    inputSchema: {
      type: "object",
      properties: {
        target_name: { type: "string", description: "Name of the agent to ask" },
        question: { type: "string", description: "The question to ask" },
      },
      required: ["target_name", "question"],
    },
  },
  {
    name: "broadcast",
    description: "Send a message to all other agents. Useful for announcements like 'I pushed changes, everyone pull' or 'who knows about X?'. Fire-and-forget to all peers.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to broadcast" },
      },
      required: ["message"],
    },
  },
  {
    name: "write_shared_memory",
    description: "Write a finding, insight, or piece of context to shared memory. Other agents can read it. Use this to share discoveries, decisions, or important context that others should know about.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The finding or context to share" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization (e.g. 'bug', 'auth', 'decision')" },
      },
      required: ["content"],
    },
  },
  {
    name: "read_shared_memory",
    description: "Read from shared memory. Can search by keyword, filter by tag, or get recent entries. Returns findings written by any agent.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword (searches content and tags)" },
        tag: { type: "string", description: "Filter by tag" },
        limit: { type: "number", description: "Max entries to return (default 20)" },
      },
    },
  },
];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function callApi(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "agentdance-bridge", version: "1.0.0" },
      },
    });
    return;
  }

  if (method === "notifications/initialized") return;

  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      let result;
      if (toolName === "list_agents") {
        const data = await callApi("/agents");
        const lines = data.agents.map(
          (a) => `${a.name}\t${a.status}\t${a.directory || "-"}\t${a.description || "-"}`
        );
        result = `name\tstatus\tdirectory\tdescription\n${lines.join("\n")}`;
      } else if (toolName === "set_description") {
        await callApi("/set_description", {
          agent_id: AGENT_ID,
          description: args.description,
        });
        result = `Description updated: ${args.description}`;
      } else if (toolName === "notify_agent") {
        const data = await callApi("/notify", {
          from_agent_id: AGENT_ID,
          target_name: args.target_name,
          message: args.message,
        });
        result = data.success
          ? `Message sent to ${args.target_name}`
          : `Failed: ${data.error}`;
      } else if (toolName === "ask_agent") {
        const data = await callApi("/ask", {
          from_agent_id: AGENT_ID,
          target_name: args.target_name,
          question: args.question,
        });
        if (data.success) {
          result = data.response;
        } else {
          result = `Failed: ${data.error}`;
        }
      } else if (toolName === "broadcast") {
        const data = await callApi("/broadcast", {
          from_agent_id: AGENT_ID,
          message: args.message,
          exclude_self: true,
        });
        result = data.sent_to.length > 0
          ? `Broadcast sent to: ${data.sent_to.join(", ")}`
          : "No other agents to broadcast to";
      } else if (toolName === "write_shared_memory") {
        const data = await callApi("/memory/write", {
          agent_id: AGENT_ID,
          content: args.content,
          tags: args.tags || [],
        });
        result = data.success
          ? `Saved to shared memory (id: ${data.id})`
          : `Failed: ${data.error}`;
      } else if (toolName === "read_shared_memory") {
        const data = await callApi("/memory/read", {
          query: args.query || null,
          tag: args.tag || null,
          limit: args.limit || 20,
        });
        if (!data.success) {
          result = `Failed: ${data.error}`;
        } else if (data.entries.length === 0) {
          result = "No entries found in shared memory";
        } else {
          const lines = data.entries.map(
            (e) => `[${e.timestamp}] ${e.agent}: ${e.content}${e.tags.length ? ` (tags: ${e.tags.join(", ")})` : ""}`
          );
          result = lines.join("\n");
        }
      } else {
        send({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
        return;
      }

      send({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: result }],
        },
      });
    } catch (e) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: e.message },
      });
    }
    return;
  }

  // Unknown method
  if (id !== undefined) {
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    handleRequest(msg);
  } catch {
    // ignore malformed lines
  }
});
