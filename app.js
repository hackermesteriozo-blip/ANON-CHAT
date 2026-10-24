
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
let toastTimer;
let entering = false;

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

function friendlyError(error) {
  const errors = {
    "auth/operation-not-allowed":
      "Ative o login anônimo em Firebase Authentication.",
    "auth/network-request-failed":
      "Falha de conexão. Verifique sua internet.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco.",
    "permission-denied":
      "Acesso negado pelo Firestore. Confira as regras.",
    "unavailable":
      "Serviço temporariamente indisponível."
  };

  return errors[error?.code] ||
    error?.message ||
    "Não foi possível concluir a operação.";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function initials(name) {
  return (name || "A").trim().slice(0, 1).toUpperCase();
}

function safeText(value) {
  return String(value ?? "");
}

function currentName(user) {
  return user.displayName ||
    sessionStorage.getItem("anonChatName") ||
    "Usuário";
}

function showChat(user) {
  authView.classList.add("hidden");
  chatView.classList.remove("hidden");

  const name = currentName(user);

  $("myName").textContent = name;
  $("myEmail").textContent = "Conectado anonimamente";
  $("myAvatar").textContent = initials(name);

  startMessages(user);
}

function showLogin() {
  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  chatView.classList.add("hidden");
  authView.classList.remove("hidden");
  messagesEl.replaceChildren();
}

function renderMessage(data, uid) {
  const row = document.createElement("article");
  row.className = "message" + (data.uid === uid ? " mine" : "");

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

function startMessages(user) {
  if (stopMessages) stopMessages();

  seenInitialSnapshot = false;
  messagesEl.innerHTML =
    '<div class="empty-state">Carregando mensagens…</div>';

  const messagesQuery = query(
    collection(db, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  stopMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
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
      messagesEl.innerHTML =
        '<div class="empty-state">Não foi possível carregar as mensagens.</div>';

      showToast(friendlyError(error));
    }
  );
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (entering) return;

  authError.textContent = "";

  if (configIsMissing()) {
    authError.textContent =
      "Configure o arquivo firebase-config.js corretamente.";

    return;
  }

  const name = displayName.value.trim();

  if (name.length < 2) {
    authError.textContent =
      "Digite um nome com pelo menos 2 caracteres.";

    return;
  }

  if (name.length > 32) {
    authError.textContent =
      "O nome deve ter no máximo 32 caracteres.";

    return;
  }

  entering = true;
  submitAuth.disabled = true;
  submitAuth.textContent = "Conectando…";

  try {
    let user = auth.currentUser;

    if (user?.isAnonymous) {
      await updateProfile(user, { displayName: name });
    } else {
      const credential = await signInAnonymously(auth);
      user = credential.user;

      await updateProfile(user, { displayName: name });
    }

    sessionStorage.setItem("anonChatName", name);

    $("myName").textContent = name;
    $("myAvatar").textContent = initials(name);

    showChat(user);
  } catch (error) {
    authError.textContent = friendlyError(error);
  } finally {
    entering = false;
    submitAuth.disabled = false;
    submitAuth.innerHTML = 'Entrar no chat <span>→</span>';
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    if (stopMessages) {
      stopMessages();
      stopMessages = null;
    }

    await signOut(auth);
    sessionStorage.removeItem("anonChatName");
    displayName.value = "";

    showToast("Você saiu do chat.");
  } catch (error) {
    showToast(friendlyError(error));
  }
});

messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length}/1000`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

$("tipBtn").addEventListener("click", () => {
  showToast(
    "Dica: não compartilhe senhas, documentos ou dados privados."
  );
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  const user = auth?.currentUser;

  if (!text || !user) return;

  if (text.length > 1000) {
    showToast("A mensagem ultrapassou o limite.");
    return;
  }

  messageInput.disabled = true;

  try {
    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      name: currentName(user).slice(0, 32),
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

if (configIsMissing()) {
  authError.textContent =
    "Configuração pendente: confira firebase-config.js.";
} else {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, (user) => {
      if (user) {
        showChat(user);
      } else {
        showLogin();
      }
    });
  } catch (error) {
    authError.textContent =
      "Falha ao iniciar Firebase: " + friendlyError(error);
  }
}
