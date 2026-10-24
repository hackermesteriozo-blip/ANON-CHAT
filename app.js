import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const authView = $("authView");
const chatView = $("chatView");
const authForm = $("authForm");
const authError = $("authError");
const displayName = $("displayName");
const nameLabel = $("nameLabel");
const email = $("email");
const password = $("password");
const submitAuth = $("submitAuth");
const switchMode = $("switchMode");
const switchText = $("switchText");
const messagesEl = $("messages");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const charCount = $("charCount");
const toast = $("toast");
let isRegister = false;
let stopMessages = null;
let seenInitialSnapshot = false;
let toastTimer;

function configIsMissing() {
  return !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("COLE_") ||
    !firebaseConfig.projectId || firebaseConfig.projectId === "SEU-PROJETO";
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function friendlyError(error) {
  const code = error?.code || "";
  const known = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/weak-password": "Use uma senha com pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Conta não encontrada. Confira os dados ou crie uma conta.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/operation-not-allowed": "Ative o método E-mail/senha no Firebase Authentication.",
    "permission-denied": "O Firestore bloqueou a operação. Confira as regras de segurança.",
    "unavailable": "Serviço temporariamente indisponível. Verifique sua conexão."
  };
  return known[code] || error?.message || "Não foi possível concluir a operação.";
}
function setRegisterMode(value) {
  isRegister = value;
  $("authTitle").textContent = value ? "Crie sua conta" : "Entre na conversa";
  $("authSubtitle").textContent = value ? "Leva só um momento para começar." : "Acesse sua conta para continuar.";
  displayName.classList.toggle("hidden", !value);
  nameLabel.classList.toggle("hidden", !value);
  displayName.required = value;
  password.autocomplete = value ? "new-password" : "current-password";
  submitAuth.innerHTML = value ? 'Criar conta <span>→</span>' : 'Entrar <span>→</span>';
  switchText.textContent = value ? "Já tem uma conta?" : "Ainda não tem conta?";
  switchMode.textContent = value ? "Entrar" : "Criar conta";
  authError.textContent = "";
}
switchMode.addEventListener("click", () => setRegisterMode(!isRegister));

function initials(name) {
  return (name || "A").trim().slice(0, 1).toUpperCase();
}
function safeText(value) {
  return String(value ?? "");
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
    time.dateTime = data.createdAt.toDate().toISOString();
    time.textContent = data.createdAt.toDate().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
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
  messagesEl.innerHTML = '<div class="empty-state">Carregando mensagens…</div>';
  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(200));
  stopMessages = onSnapshot(q, (snapshot) => {
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
    messagesEl.replaceChildren();
    if (snapshot.empty) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Ainda não há mensagens. Comece a conversa! ✦";
      messagesEl.append(empty);
    } else {
      snapshot.forEach((doc) => messagesEl.append(renderMessage(doc.data(), user.uid)));
    }
    if (nearBottom || !seenInitialSnapshot) messagesEl.scrollTop = messagesEl.scrollHeight;
    seenInitialSnapshot = true;
  }, (error) => {
    messagesEl.innerHTML = '<div class="empty-state">Não foi possível carregar as mensagens.</div>';
    showToast(friendlyError(error));
  });
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  if (configIsMissing()) {
    authError.textContent = "Configure primeiro o arquivo firebase-config.js seguindo o README.";
    return;
  }
  submitAuth.disabled = true;
  submitAuth.textContent = isRegister ? "Criando conta…" : "Entrando…";
  try {
    if (isRegister) {
      const name = displayName.value.trim();
      if (name.length < 2) throw new Error("O nome deve ter pelo menos 2 caracteres.");
      const credential = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
      await updateProfile(credential.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    }
  } catch (error) {
    authError.textContent = friendlyError(error);
  } finally {
    submitAuth.disabled = false;
    setRegisterMode(isRegister);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try { await signOut(auth); showToast("Você saiu da sua conta."); }
  catch (error) { showToast(friendlyError(error)); }
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
$("tipBtn").addEventListener("click", () => showToast("Dica: nunca compartilhe senhas, documentos ou dados privados no chat."));
messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !auth.currentUser) return;
  if (text.length > 1000) return showToast("A mensagem ultrapassou o limite.");
  const user = auth.currentUser;
  messageInput.disabled = true;
  try {
    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      name: (user.displayName || user.email?.split("@")[0] || "Usuário").slice(0, 32),
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

let app, auth, db;
if (configIsMissing()) {
  authError.textContent = "Configuração pendente: edite firebase-config.js antes de usar o chat.";
} else {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, (user) => {
      if (user) {
        authView.classList.add("hidden");
        chatView.classList.remove("hidden");
        const name = user.displayName || user.email?.split("@")[0] || "Usuário";
        $("myName").textContent = name;
        $("myEmail").textContent = user.email || "Conta conectada";
        $("myAvatar").textContent = initials(name);
        startMessages(user);
      } else {
        if (stopMessages) stopMessages();
        stopMessages = null;
        chatView.classList.add("hidden");
        authView.classList.remove("hidden");
        messagesEl.replaceChildren();
      }
    });
  } catch (error) {
    authError.textContent = "Falha ao iniciar Firebase: " + friendlyError(error);
  }
}
