const chatConfig = {
  apiEndpoint: "/api/chat",
  requestTimeoutMs: 30000,
};

const state = {
  isSending: false,
  messages: [],
};

const elements = {
  form: document.querySelector("#chatForm"),
  input: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  messages: document.querySelector("#messages"),
  emptyState: document.querySelector("#emptyState"),
  processingState: document.querySelector("#processingState"),
  clearChatButton: document.querySelector("#clearChatButton"),
  openSidebarButton: document.querySelector("#openSidebarButton"),
  closeSidebarButton: document.querySelector("#closeSidebarButton"),
  sidebarBackdrop: document.querySelector("#sidebarBackdrop"),
};

document.addEventListener("DOMContentLoaded", () => {
  bootConsole();
});

function bootConsole() {
  setupCursorSpotlight();
  bindEvents();
  resetConversation();
  refreshIcons();
}

function setupCursorSpotlight() {
  const spotlight = document.createElement("div");
  spotlight.className = "cursor-spotlight";
  document.body.prepend(spotlight);

  document.addEventListener(
    "mousemove",
    (e) => {
      document.body.style.setProperty("--cx", e.clientX + "px");
      document.body.style.setProperty("--cy", e.clientY + "px");
      spotlight.classList.add("is-visible");
    },
    { passive: true }
  );
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSendMessage();
  });

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  });

  elements.input.addEventListener("input", resizeComposer);

  document.addEventListener("click", (event) => {
    const promptButton = event.target.closest("[data-prompt]");
    if (promptButton) {
      handlePromptShortcut(promptButton.dataset.prompt);
      return;
    }

    const copyButton = event.target.closest(".copy-button");
    if (copyButton) {
      handleCopyMessage(copyButton);
    }
  });

  elements.clearChatButton.addEventListener("click", resetConversation);

  elements.openSidebarButton.addEventListener("click", openSidebar);
  elements.closeSidebarButton.addEventListener("click", closeSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });
}

function resetConversation() {
  state.messages = [];
  elements.messages.innerHTML = "";
  renderMessages();
  setProcessing(false);
  resizeComposer();
  elements.input.focus();
}

function renderMessages() {
  elements.messages.innerHTML = "";
  state.messages.forEach(renderMessage);
  updateConversationState();
  refreshIcons();
  scrollToLatest();
}

function renderMessage(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.role}${message.isError ? " error" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.innerHTML = `<i data-lucide="${message.role === "user" ? "user-round" : "scan-eye"}" class="h-4 w-4"></i>`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const authorGroup = document.createElement("div");
  authorGroup.className = "message-author-group";

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = message.role === "user" ? "Analista" : "Mano do SOC";

  const subtitle = document.createElement("span");
  subtitle.className = "message-subtitle";
  subtitle.textContent = getMessageSubtitle(message);

  authorGroup.append(author, subtitle);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const time = document.createElement("span");
  time.textContent = formatTimestamp(message.timestamp);
  actions.append(time);

  if (message.role === "agent" && !message.isLoading && !message.isError) {
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.type = "button";
    copyButton.dataset.messageId = message.id;
    copyButton.setAttribute("aria-label", "Copiar resposta do agente");
    copyButton.title = "Copy response";
    copyButton.innerHTML = `<i data-lucide="copy" class="h-4 w-4"></i>`;
    actions.append(copyButton);
  }

  meta.append(authorGroup, actions);

  const content = document.createElement("div");
  content.className = "message-content";

  if (message.isLoading) {
    content.innerHTML = `
      <span class="loading-line">
        Mano do SOC investigando...
        <span class="typing" aria-label="Agent is processing">
          <span></span><span></span><span></span>
        </span>
      </span>
    `;
  } else {
    content.textContent = message.content;
  }

  bubble.append(meta, content);
  row.append(avatar, bubble);
  elements.messages.appendChild(row);
}

async function handleSendMessage() {
  const prompt = elements.input.value.trim();

  if (!prompt || state.isSending) return;

  appendMessage({ role: "user", content: prompt });
  elements.input.value = "";
  resizeComposer();
  setProcessing(true);

  const loadingMessage = appendMessage({
    role: "agent",
    content: "",
    isLoading: true,
  });

  try {
    const response = await getAgentResponse(prompt);
    replaceMessage(loadingMessage.id, {
      role: "agent",
      content: response,
    });
  } catch (error) {
    replaceMessage(loadingMessage.id, {
      role: "agent",
      isError: true,
      content:
        "Eita, n\u00e3o consegui conectar no backend. Verifica se o servidor t\u00e1 rodando e se as credenciais do Azure est\u00e3o configuradas no .env.",
    });
    console.error("Chat request failed:", error);
  } finally {
    setProcessing(false);
    elements.input.focus();
  }
}

function appendMessage(message) {
  const hydratedMessage = {
    id: createMessageId(),
    timestamp: new Date(),
    ...message,
  };

  state.messages.push(hydratedMessage);
  renderMessages();
  return hydratedMessage;
}

function replaceMessage(id, nextMessage) {
  state.messages = state.messages.map((message) => {
    if (message.id !== id) return message;

    return {
      id,
      timestamp: new Date(),
      ...nextMessage,
    };
  });

  renderMessages();
}

async function getAgentResponse(prompt) {
  return callSecureChatApi(prompt);
}

async function callSecureChatApi(prompt) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), chatConfig.requestTimeoutMs);

  try {
    /*
      A integracao real com Microsoft/Azure AI Foundry deve acontecer em um backend seguro
      ou serverless function. Nunca coloque API_KEY, endpoint, agent_id ou deployment_id no
      JavaScript do frontend. Esta chamada espera que /api/chat use variaveis de ambiente no
      servidor, chame o agente no Azure AI Foundry e retorne JSON no formato:

      { "reply": "texto da resposta do agente" }
    */
    const response = await fetch(chatConfig.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        context: {
          console: "OlhoVivo",
          workflow: "soc-triage",
          source: "frontend-no-secret",
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();

    if (!data.reply || typeof data.reply !== "string") {
      throw new Error("Invalid API response. Expected { reply: string }.");
    }

    return data.reply;
  } finally {
    window.clearTimeout(timeout);
  }
}

function handlePromptShortcut(prompt) {
  if (!prompt || state.isSending) return;

  elements.input.value = prompt;
  resizeComposer();
  closeSidebar();
  handleSendMessage();
}

async function handleCopyMessage(button) {
  const message = state.messages.find((item) => item.id === button.dataset.messageId);
  if (!message?.content) return;

  const copied = await copyText(message.content);
  if (!copied) return;

  const original = button.innerHTML;
  button.innerHTML = `<i data-lucide="check" class="h-4 w-4"></i>`;
  button.setAttribute("aria-label", "Resposta copiada");
  refreshIcons();

  window.setTimeout(() => {
    button.innerHTML = original;
    button.setAttribute("aria-label", "Copiar resposta do agente");
    refreshIcons();
  }, 1400);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea-based copy path for local testing.
    }
  }

  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.left = "-9999px";
  document.body.appendChild(fallback);
  fallback.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(fallback);
  }
}

function setProcessing(isProcessing) {
  state.isSending = isProcessing;
  elements.sendButton.disabled = isProcessing;
  elements.processingState.classList.toggle("active", isProcessing);
  elements.processingState.textContent = isProcessing
    ? "Analisando a fita..."
    : "No plant\u00e3o, pronto pra receber.";
}

function updateConversationState() {
  const hasMessages = state.messages.length > 0;
  elements.emptyState.classList.toggle("is-hidden", hasMessages);
  elements.messages.classList.toggle("has-messages", hasMessages);
}

function resizeComposer() {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 180)}px`;
}

function scrollToLatest() {
  requestAnimationFrame(() => {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  });
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp ?? new Date());
}

function getMessageSubtitle(message) {
  if (message.isLoading) return "Investigando...";
  if (message.isError) return "Deu ruim na conex\u00e3o";
  return message.role === "user" ? "Evid\u00eancia enviada" : "An\u00e1lise do plant\u00e3o";
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
  elements.openSidebarButton.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  elements.openSidebarButton.setAttribute("aria-expanded", "false");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function createMessageId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
