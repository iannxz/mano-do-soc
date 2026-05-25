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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
  }

  const message = req.body?.message;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Campo 'message' obrigatório." });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: "Mensagem muito longa. Máximo 4000 caracteres." });
  }

  const endpoint = process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;
  const model = process.env.AZURE_DEPLOYMENT;
  const systemPrompt = process.env.SYSTEM_PROMPT;

  if (!endpoint || !apiKey || !model || !systemPrompt) {
    return res.status(500).json({ error: "Variáveis de ambiente não configuradas." });
  }

  try {
    const azureRes = await fetch(`${endpoint}/openai/v1/chat/completions`, {
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
