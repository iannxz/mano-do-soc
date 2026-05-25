export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
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
      console.error("Missing env vars:", {
        endpoint: !!endpoint,
        apiKey: !!apiKey,
        model: !!model,
        systemPrompt: !!systemPrompt,
      });
      return res.status(500).json({ error: "Variáveis de ambiente não configuradas." });
    }

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
      console.error("Azure error:", JSON.stringify(data.error ?? data));
      return res.status(502).json({ error: "Erro ao consultar o modelo." });
    }

    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("Function error:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
}
