"use strict";

/*
 * ANON CHAT — APP.JS
 * Chat temporário via WebSocket.
 * Não usa Firebase nem grava mensagens no navegador.
 *
 * IMPORTANTE:
 * O servidor Render deve aceitar os eventos "join" e "message"
 * e retransmitir as mensagens aos outros usuários da sala.
 */

const WS_URL = "wss://SEU-SERVICO.onrender.com";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 24;
const MIN_NICKNAME_LENGTH = 2;

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const chatView = $("chatView");
const loginForm = $("loginForm");
const nicknameInput = $("nickname");
const enterButton = $("enterButton");
const loginError = $("loginError");

const messages = $("messages");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const sendButton = $("sendButton");
const leaveButton = $("leaveButton");

const connectionText = $("connectionText");
const statusText = $("statusText");
const statusDot = $("statusDot");

let socket = null;
let nickname = "";
let connected = false;
let manuallyDisconnected = false;
let reconnectTimer = null;
let connectionAttempts = 0;

/* Exibe a tela escolhida. */
function showView(view) {
  loginView?.classList.toggle("active", view === "login");
  chatView?.classList.toggle("active", view === "chat");
}

/* Atualiza o estado visual da conexão. */
function setConnection(isConnected, text) {
  connected = isConnected;

  if (connectionText) connectionText.textContent = text;
  if (statusText) statusText.textContent = text;

  if (statusDot) {
    statusDot.style.background = isConnected ? "#4ade80" : "#fb7185";
  }

  if (sendButton) sendButton.disabled = !isConnected;
  if (messageInput) messageInput.disabled = !isConnected;

  if (sendButton) {
    sendButton.style.opacity = isConnected ? "1" : ".5";
  }
}

/* Mostra um erro na tela de entrada. */
function showLoginError(text) {
  if (!loginError) return;

  loginError.textContent = text;
  loginError.style.display = "block";
}

/* Cria um aviso de sistema sem interpretar HTML. */
function addSystemMessage(text) {
  if (!messages) return;

  const element = document.createElement("div");
  element.className = "system-message";
  element.textContent = text;

  messages.appendChild(element);
  scrollToBottom();
}

/* Cria uma mensagem de usuário com texto seguro. */
function addMessage(data) {
  if (!messages) return;

  const empty = $("emptyMessage");
  if (empty) empty.remove();

  const item = document.createElement("div");
  const isMine = data.nickname === nickname;

  item.className = "message" + (isMine ? " mine" : "");

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const sender = isMine ? "Você" : String(data.nickname || "Anônimo");
  const time = typeof data.time === "string" ? data.time : "";

  meta.textContent = time ? `${sender} · ${time}` : sender;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = String(data.text || "");

  item.append(meta, bubble);
  messages.appendChild(item);

  scrollToBottom();
}

/* Mantém a conversa na mensagem mais recente. */
function scrollToBottom() {
  if (messages) messages.scrollTop = messages.scrollHeight;
}

/* Cancela uma tentativa de reconexão pendente. */
function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/* Fecha a conexão atual e remove os eventos. */
function closeSocket() {
  clearReconnectTimer();
  connected = false;

  if (!socket) return;

  const oldSocket = socket;
  socket = null;

  oldSocket.onopen = null;
  oldSocket.onmessage = null;
  oldSocket.onerror = null;
  oldSocket.onclose = null;

  if (
    oldSocket.readyState === WebSocket.OPEN ||
    oldSocket.readyState === WebSocket.CONNECTING
  ) {
    oldSocket.close(1000, "Conexão encerrada");
  }
}

/* Interpreta os eventos recebidos do servidor. */
function handleServerMessage(event) {
  let data;

  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }

  if (!data || typeof data !== "object") return;

  switch (data.type) {
    case "message": {
      if (typeof data.text !== "string") return;

      if (data.text.length > MAX_MESSAGE_LENGTH) return;

      addMessage({
        nickname: String(data.nickname || "Anônimo").slice(
          0,
          MAX_NICKNAME_LENGTH
        ),
        text: data.text,
        time: data.time
      });

      break;
    }

    case "system": {
      if (typeof data.text === "string") {
        addSystemMessage(data.text.slice(0, 200));
      }
      break;
    }

    case "error": {
      if (typeof data.text === "string") {
        addSystemMessage(data.text.slice(0, 200));
      }
      break;
    }

    case "history": {
      /*
       * Este aplicativo não solicita histórico.
       * Se o servidor enviar mensagens antigas, elas são ignoradas.
       */
      break;
    }

    default:
      break;
  }
}

/* Abre a conexão com o servidor WebSocket. */
function connectChat() {
  manuallyDisconnected = false;
  clearReconnectTimer();
  closeSocket();

  if (!nickname) {
    showView("login");
    return;
  }

  if (WS_URL.includes("SEU-SERVICO")) {
    showView("login");
    showLoginError(
      "Configure WS_URL no app.js com a URL WebSocket do seu serviço Render."
    );
    return;
  }

  if (!/^wss?:\/\//i.test(WS_URL)) {
    showView("login");
    showLoginError("A URL do servidor WebSocket é inválida.");
    return;
  }

  if (!("WebSocket" in window)) {
    showView("login");
    showLoginError("Este navegador não suporta WebSocket.");
    return;
  }

  setConnection(false, "Conectando ao servidor...");

  try {
    const currentSocket = new WebSocket(WS_URL);
    socket = currentSocket;

    currentSocket.addEventListener("open", () => {
      if (socket !== currentSocket) return;

      connectionAttempts = 0;
      setConnection(true, "Conectado");
      addSystemMessage("Conexão estabelecida.");

      currentSocket.send(
        JSON.stringify({
          type: "join",
          nickname: nickname
        })
      );

      if (messageInput) messageInput.focus();
    });

    currentSocket.addEventListener("message", (event) => {
      if (socket !== currentSocket) return;
      handleServerMessage(event);
    });

    currentSocket.addEventListener("error", () => {
      if (socket !== currentSocket) return;
      setConnection(false, "Problema de conexão");
    });

    currentSocket.addEventListener("close", () => {
      if (socket !== currentSocket) return;

      socket = null;
      setConnection(false, "Desconectado");

      if (manuallyDisconnected) return;

      addSystemMessage("A conexão foi encerrada.");

      /*
       * Reconexão automática com espera progressiva.
       * Não tenta reconectar indefinidamente com intervalos curtos.
       */
      if (nickname && chatView?.classList.contains("active")) {
        scheduleReconnect();
      }
    });
  } catch {
    socket = null;
    setConnection(false, "Falha na conexão");
    addSystemMessage("Não foi possível iniciar a conexão WebSocket.");
    scheduleReconnect();
  }
}

/* Agenda uma tentativa de reconexão. */
function scheduleReconnect() {
  if (manuallyDisconnected || !nickname || reconnectTimer !== null) {
    return;
  }

  connectionAttempts += 1;

  const delay = Math.min(
    1000 * Math.pow(2, connectionAttempts - 1),
    30000
  );

  setConnection(false, "Reconectando em alguns segundos...");

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    if (
      !manuallyDisconnected &&
      nickname &&
      chatView?.classList.contains("active")
    ) {
      connectChat();
    }
  }, delay);
}

/* Valida o apelido e entra no chat. */
loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const value = nicknameInput.value.trim();

  if (
    value.length < MIN_NICKNAME_LENGTH ||
    value.length > MAX_NICKNAME_LENGTH
  ) {
    showLoginError(
      `O apelido precisa ter entre ${MIN_NICKNAME_LENGTH} e ${MAX_NICKNAME_LENGTH} caracteres.`
    );
    return;
  }

  if (loginError) {
    loginError.textContent = "";
    loginError.style.display = "none";
  }

  nickname = value;
  manuallyDisconnected = false;
  connectionAttempts = 0;

  messages?.replaceChildren();

  showView("chat");
  connectChat();
});

/* Envia uma mensagem apenas quando conectado. */
messageForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) return;

  if (text.length > MAX_MESSAGE_LENGTH) {
    addSystemMessage("A mensagem ultrapassa o limite permitido.");
    return;
  }

  if (
    !connected ||
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {
    addSystemMessage("Você está desconectado. Aguarde a reconexão.");
    return;
  }

  try {
    socket.send(
      JSON.stringify({
        type: "message",
        nickname: nickname,
        text: text
      })
    );

    messageInput.value = "";
    messageInput.focus();
  } catch {
    setConnection(false, "Falha ao enviar");
    addSystemMessage("Não foi possível enviar a mensagem.");
  }
});

/* Sai do chat e apaga o estado local do apelido. */
leaveButton?.addEventListener("click", () => {
  manuallyDisconnected = true;
  nickname = "";
  connectionAttempts = 0;

  closeSocket();

  if (nicknameInput) nicknameInput.value = "";
  if (messageInput) messageInput.value = "";

  if (messages) messages.replaceChildren();

  setConnection(false, "Desconectado");
  showView("login");
});

/* Fecha a conexão quando a página é encerrada. */
window.addEventListener("pagehide", () => {
  manuallyDisconnected = true;
  closeSocket();
});

/* Estado inicial da interface. */
setConnection(false, "Aguardando conexão");
showView("login");
```
