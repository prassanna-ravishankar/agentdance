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
    description: "Send a fire-and-forget message to another agent by name. Use for delegation, status updates, or requests. The target agent receives your message as a prompt.",
    inputSchema: {
      type: "object",
      properties: {
        target_name: { type: "string", description: "Name of the agent to notify" },
        message: { type: "string", description: "The message to send" },
      },
      required: ["target_name", "message"],
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

  if (method === "notifications/initialized") return; // no response needed

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
