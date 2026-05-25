# Mano do SOC - Agente de Cyber Defense

Agente de Seguranca da Informacao com foco em SOC, Blue Team, Threat Hunting e resposta a incidentes. Construido com Node.js, Express e Azure AI Foundry (GPT-4.1 Mini), com frontend interativo estilo console de operacoes.

## Tecnologias

- **Runtime**: Node.js
- **Framework**: Express.js
- **IA**: Azure AI Foundry (GPT-4.1 Mini)
- **Frontend**: HTML, CSS, Tailwind CSS, Lucide Icons
- **Deploy**: Vercel (Serverless Functions)

## Funcionalidades

- Chat interativo com agente de seguranca especializado
- System prompt com personalidade de analista SOC paulista
- Triagem de alertas XDR/SIEM
- Analise de comandos suspeitos
- Planos de resposta a incidentes
- Classificacao e enriquecimento de IOCs
- Rate limiting por IP (20 req/min)
- Validacao de input (max 4000 caracteres)

## Estrutura do Projeto

```
├── public/
│   ├── index.html          (interface do console)
│   ├── app.js              (logica do frontend)
│   └── style.css           (estilos)
├── api/
│   └── chat.js             (serverless function - Vercel)
├── server.js               (servidor Express - desenvolvimento local)
├── system-prompt.txt        (instrucoes do agente - nao versionado)
├── .env                     (variaveis de ambiente - nao versionado)
├── .env.example             (modelo de variaveis de ambiente)
├── vercel.json              (configuracao de deploy)
└── package.json
```

## Variaveis de Ambiente

| Variavel | Descricao |
|----------|-----------|
| `AZURE_ENDPOINT` | Endpoint do projeto no Azure AI Foundry |
| `AZURE_API_KEY` | Chave de API do recurso Azure |
| `AZURE_DEPLOYMENT` | Nome do modelo (ex: `gpt-4.1-mini`) |
| `SYSTEM_PROMPT` | Instrucoes de personalidade do agente (apenas Vercel) |

## Instalacao e Execucao Local

```bash
git clone https://github.com/iannxz/mano-do-soc.git
cd mano-do-soc
npm install
```

Configure o arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

Preencha com suas credenciais do Azure AI Foundry e crie o arquivo `system-prompt.txt` com as instrucoes do agente.

Inicie o servidor:

```bash
node --env-file=.env server.js
```

Acesse em `http://localhost:3000`

## Deploy na Vercel

1. Faca push do repositorio para o GitHub
2. Importe o projeto na [Vercel](https://vercel.com)
3. Configure as variaveis de ambiente no painel (`AZURE_ENDPOINT`, `AZURE_API_KEY`, `AZURE_DEPLOYMENT`, `SYSTEM_PROMPT`)
4. Faca o deploy

## Endpoints da API

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/` | Interface do console (frontend) |
| POST | `/api/chat` | Envia mensagem para o agente |

### POST `/api/chat`

**Request:**
```json
{
  "message": "O que e lateral movement?"
}
```

**Response:**
```json
{
  "reply": "Mano, lateral movement e quando o atacante..."
}
```

## Seguranca

- Chaves de API ficam apenas no servidor (nunca no frontend)
- Arquivos sensiveis (`.env`, `system-prompt.txt`) nao sao versionados
- `express.static` serve apenas a pasta `public/`
- Rate limiting para prevenir abuso
- Validacao de tamanho e tipo de input
- Mensagens de erro genericas para o frontend (sem vazamento de detalhes)
