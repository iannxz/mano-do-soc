import express from "express";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Parse JSON with a size limit to prevent abuse
app.use(express.json({ limit: "5kb" }));

// Serve ONLY the public folder — never the project root
app.use(express.static(join(__dirname, "public")));

const endpoint = process.env.AZURE_ENDPOINT;
const apiKey = process.env.AZURE_API_KEY;
const model = process.env.AZURE_DEPLOYMENT;

if (!endpoint || !apiKey || !model) {
  console.error("Missing env vars:", { endpoint: !!endpoint, apiKey: !!apiKey, model: !!model });
  process.exit(1);
}

// Carrega prompt do arquivo local ou da env var SYSTEM_PROMPT (Vercel)
const promptPath = join(__dirname, "system-prompt.txt");
const systemPrompt = existsSync(promptPath)
  ? readFileSync(promptPath, "utf-8").trim()
  : process.env.SYSTEM_PROMPT;

if (!systemPrompt) {
  console.error("Missing system prompt: create system-prompt.txt or set SYSTEM_PROMPT env var");
  process.exit(1);
}
const chatUrl = `${endpoint}/openai/v1/chat/completions`;

// Simple in-memory rate limiter: max 20 requests per minute per IP
const rateMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

app.post("/api/chat", (req, res) => {
  const ip = req.ip;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
  }

  const message = req.body.message;

  // Validate input
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Campo 'message' obrigatório." });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: "Mensagem muito longa. Máximo 4000 caracteres." });
  }

  handleChat(message, res);
});

async function handleChat(message, res) {
  try {
    const azureRes = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 1024,
      }),
    });

    const data = await azureRes.json();

    if (!azureRes.ok) {
      console.error("Azure error:", data.error ?? data);
      return res.status(502).json({ error: "Erro ao consultar o modelo." });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
