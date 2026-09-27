// Conversation Starters - pick a situation (family dinner, new classmate, road trip...) and a depth, and an AI
// on YOUR machine (QVAC) deals a deck of question cards. Open http://localhost:3089 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3089;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI question dealer ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// QVAC "structured output": a list of questions.
const SCHEMA = { type: "object", properties: { questions: { type: "array", items: { type: "string" } } }, required: ["questions"], additionalProperties: false };
const DEPTHS = { light: "light, fun and easy to answer (favorites, would-you-rather, funny stories)", medium: "a little more personal (experiences, opinions, hopes), still comfortable", deep: "thoughtful and meaningful (values, big life moments, what matters), but never invasive" };
const prompt = (depth) => `You write conversation starter questions. Depth: ${DEPTHS[depth]}. Reply with JSON only.
questions: 10 open-ended questions (not yes/no), each one sentence, fitting the situation. Suitable for all ages.
Avoid questions about money, weight, religion, politics or anything that could embarrass someone.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/deal") {
      if (!status.ready) return json(res, 503, { error: "The AI question dealer is not ready yet." });
      const b = JSON.parse(await readBody(req, 20000)), situation = clean(b.situation, 100) || "meeting someone new", depth = DEPTHS[b.depth] ? b.depth : "light";
      const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x) => clean(x, 200)).filter(Boolean).slice(-20);
      const r = await enqueue(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // This is the QVAC call that runs the AI on-device
            const run = completion({ modelId, stream: true, history: [{ role: "system", content: prompt(depth) }, { role: "user", content: `Situation: ${situation}.` + (avoid.length ? `\nDon't repeat:\n- ${avoid.join("\n- ")}` : "") }], responseFormat: { type: "json_schema", json_schema: { name: "Starters", schema: SCHEMA } } });
            let out = "";
            for await (const event of run.events) if (event.type === "contentDelta") out += event.text;
            const seen = new Set(avoid.map((a) => a.toLowerCase()));
            const qs = (JSON.parse(out).questions || []).map((q) => clean(q, 200).replace(/^\d+[.)]\s*/, "").replace(/^["\u201c]|["\u201d]$/g, "")).filter((q) => q.length > 8 && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
              .map((q) => (/[?.!]$/.test(q) ? q : q + "?"));
            if (qs.length >= 3) return qs.slice(0, 12);
          } catch (err) { console.error("Deal attempt failed:", err.message); }
        }
        return null;
      });
      return r ? json(res, 200, r) : json(res, 502, { error: "The AI couldn't deal questions. Try again." });
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
