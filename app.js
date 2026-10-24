
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ======================================================
// ANON CHAT — CONFIGURAÇÃO PRINCIPAL
// ======================================================

const $ = (id) => document.getElementById(id);

const authView = $("authView");
const chatView = $("chatView");
const authForm = $("authForm");
const authError = $("authError");
const displayName = $("displayName");
const submitAuth = $("submitAuth");

const messagesEl = $("messages");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const charCount = $("charCount");
const toast = $("toast");

let app;
let auth;
let db;

let stopMessages = null;
let seenInitialSnapshot = false;
let toastTimer = null;
let entering = false;
let activeUid = null;

// ======================================================
// CONFIGURAÇÃO DO FIREBASE
// ======================================================

function configIsMissing() {
  return !firebaseConfig ||
    !firebaseConfig.apiKey ||
    firebaseConfig.apiKey === "SUA_API_KEY" ||
    firebaseConfig.apiKey.includes("COLE_") ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    firebaseConfig.projectId === "SEU-PROJETO" ||
    !firebaseConfig.appId;
}

// ======================================================
// UTILITÁRIOS
// ======================================================

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function friendlyError(error) {
  const errors = {
    "auth/operation-not-allowed":
      "Ative o login anônimo no Firebase Authentication.",

    "auth/network-request-failed":
      "Falha de conexão. Verifique sua internet.",

    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco.",

    "auth/unauthorized-domain":
      "Adicione o domínio do site em Authentication → Settings → Authorized domains.",

    "permission-denied":
      "O Firestore bloqueou a operação. Confira as regras de segurança.",

    "unavailable":
      "O serviço está temporariamente indisponível.",

    "failed-precondition":
      "O Firestore precisa de configuração adicional."
  };

  return errors[error?.code] ||
    error?.message ||
    "Não foi possível concluir a operação.";
}

function initials(name) {
  return (name || "A").trim().slice(0, 1).toUpperCase();
}

function safeText(value) {
  return String(value ?? "");
}

function validName(value) {
  const name = value.trim();
  return name.length >= 2 && name.length <= 32;
}

function getSavedName() {
  try {
    return sessionStorage.getItem("anonChatName") || "";
  } catch {
    return "";
  }
}

function saveName(name) {
  try {
    sessionStorage.setItem("anonChatName", name);
  } catch {
    // O chat continua funcionando mesmo se o armazenamento estiver indisponível.
  }
}

function clearSavedName() {
  try {
    sessionStorage.removeItem("anonChatName");
  } catch {
    // Não há nada a fazer.
  }
}

// ======================================================
// NAVEGAÇÃO ENTRE ENTRADA E CHAT
// ======================================================

function showLogin() {
  stopMessageListener();

  activeUid = null;

  chatView.classList.add("hidden");
  authView.classList.remove("hidden");

  messagesEl.replaceChildren();

  submitAuth.disabled = false;
  submitAuth.innerHTML = 'Entrar no chat <span>→</span>';

  if (displayName && !displayName.value) {
    displayName.focus();
  }
}

function showChat(user) {
  if (!user) return;

  activeUid = user.uid;

  const name = user.displayName || getSavedName() || "Usuário";

  authView.classList.add("hidden");
  chatView.classList.remove("hidden");

  $("myName").textContent = name;
  $("myAvatar").textContent = initials(name);

  const userStatus = $("myEmail");
  if (userStatus) {
    userStatus.textContent = "Conectado anonimamente";
  }

  startMessages(user);

  messageInput.focus();
}

// ======================================================
// RENDERIZAÇÃO DAS MENSAGENS
// ======================================================

function renderMessage(data, uid) {
  const row = document.createElement("article");

  row.className =
    "message" + (data.uid === uid ? " mine" : "");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = initials(data.name);

  const body = document.createElement("div");
  body.className = "message-body";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const author = document.createElement("b");
  author.textContent = safeText(data.name) || "Usuário";

  const time = document.createElement("time");

  if (data.createdAt?.toDate) {
    const date = data.createdAt.toDate();

    time.dateTime = date.toISOString();

    time.textContent = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } else {
    time.textContent = "agora";
  }

  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = safeText(data.text);

  meta.append(author, time);
  body.append(meta, text);
  row.append(avatar, body);

  return row;
}

// ======================================================
// MENSAGENS EM TEMPO REAL
// ======================================================

function stopMessageListener() {
  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  seenInitialSnapshot = false;
}

function startMessages(user) {
  if (!user || activeUid !== user.uid) return;

  stopMessageListener();

  messagesEl.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "empty-state";
  loading.textContent = "Conectando à conversa…";

  messagesEl.append(loading);

  const messagesQuery = query(
    collection(db, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  stopMessages = onSnapshot(
    messagesQuery,

    (snapshot) => {
      if (!auth.currentUser ||
          auth.currentUser.uid !== user.uid) {
        return;
      }

      const nearBottom =
        messagesEl.scrollHeight -
        messagesEl.scrollTop -
        messagesEl.clientHeight < 100;

      messagesEl.replaceChildren();

      if (snapshot.empty) {
        const empty = document.createElement("div");

        empty.className = "empty-state";
        empty.textContent =
          "Ainda não há mensagens. Comece a conversa! ✦";

        messagesEl.append(empty);
      } else {
        snapshot.forEach((item) => {
          messagesEl.append(
            renderMessage(item.data(), user.uid)
          );
        });
      }

      if (nearBottom || !seenInitialSnapshot) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      seenInitialSnapshot = true;
    },

    (error) => {
      messagesEl.replaceChildren();

      const errorMessage = document.createElement("div");
      errorMessage.className = "empty-state";
      errorMessage.textContent =
        "Não foi possível carregar as mensagens.";

      messagesEl.append(errorMessage);
      showToast(friendlyError(error));
    }
  );
}

// ======================================================
// ENTRAR APENAS COM O NOME
// ======================================================

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (entering) return;

  authError.textContent = "";

  if (configIsMissing()) {
    authError.textContent =
      "Confira a configuração do arquivo firebase-config.js.";

    return;
  }

  const name = displayName.value.trim();

  if (!validName(name)) {
    authError.textContent =
      "Digite um nome entre 2 e 32 caracteres.";

    return;
  }

  entering = true;
  submitAuth.disabled = true;
  submitAuth.textContent = "Conectando…";

  try {
    let user = auth.currentUser;

    if (!user) {
      const credential = await signInAnonymously(auth);
      user = credential.user;
    }

    await updateProfile(user, {
      displayName: name
    });

    saveName(name);

    showChat(user);
  } catch (error) {
    authError.textContent = friendlyError(error);
  } finally {
    entering = false;

    if (!auth.currentUser) {
      submitAuth.disabled = false;
      submitAuth.innerHTML =
        'Entrar no chat <span>→</span>';
    }
  }
});

// ======================================================
// SAIR DO CHAT
// ======================================================

$("logoutBtn").addEventListener("click", async () => {
  try {
    stopMessageListener();

    clearSavedName();

    if (displayName) {
      displayName.value = "";
    }

    await signOut(auth);

    showToast("Você saiu da conversa.");

  } catch (error) {
    showToast(friendlyError(error));
  }
});

// ======================================================
// CONTADOR DE CARACTERES
// ======================================================

messageInput.addEventListener("input", () => {
  charCount.textContent =
    `${messageInput.value.length}/1000`;
});

// ======================================================
// ENTER PARA ENVIAR MENSAGEM
// ======================================================

messageInput.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

// ======================================================
// DICA DE SEGURANÇA
// ======================================================

$("tipBtn").addEventListener("click", () => {
  showToast(
    "Não compartilhe senhas, documentos ou dados privados."
  );
});

// ======================================================
// ENVIAR MENSAGEM
// ======================================================

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  const user = auth?.currentUser;

  if (!text || !user) return;

  if (text.length > 1000) {
    showToast("A mensagem ultrapassou o limite.");
    return;
  }

  if (user.uid !== activeUid) {
    showToast("Sua sessão mudou. Entre novamente.");
    return;
  }

  messageInput.disabled = true;

  try {
    const name =
      (user.displayName || getSavedName() || "Usuário")
        .trim()
        .slice(0, 32);

    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      name,
      createdAt: serverTimestamp()
    });

    messageInput.value = "";
    charCount.textContent = "0/1000";
    messageInput.focus();

  } catch (error) {
    showToast(friendlyError(error));
  } finally {
    messageInput.disabled = false;
  }
});

// ======================================================
// INICIALIZAÇÃO DO ANON CHAT
// ======================================================

if (configIsMissing()) {
  authError.textContent =
    "Configuração pendente: confira firebase-config.js.";

  submitAuth.disabled = true;

} else {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showLogin();
        return;
      }

      const savedName = getSavedName();

      if (user.isAnonymous && savedName) {
        try {
          if (user.displayName !== savedName) {
            await updateProfile(user, {
              displayName: savedName
            });
          }

          showChat(user);
        } catch (error) {
          showToast(friendlyError(error));
          showLogin();
        }
      } else {
        showLogin();
      }
    });

  } catch (error) {
    authError.textContent =
      "Falha ao iniciar Firebase: " + friendlyError(error);

    submitAuth.disabled = true;
  }
}
