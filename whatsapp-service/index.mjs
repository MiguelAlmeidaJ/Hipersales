import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.HYPERSALES_API_BASE || "http://127.0.0.1:8000";
const TOKEN =
  process.env.HYPERSALES_WHATSAPP_TOKEN ||
  readFileSync(join(__dirname, "..", ".whatsapp-internal-token"), "utf8").trim();
const AUTH_DIR = process.env.HYPERSALES_WHATSAPP_AUTH_DIR || join(__dirname, "auth");
const POLL_MS = Number(process.env.HYPERSALES_WHATSAPP_POLL_MS || 5000);

let socket = null;
let connected = false;
let polling = false;
let lastQrToken = "";
let reconnecting = false;
const sentMessageOutbox = new Map();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function messageStatusLabel(status) {
  const labels = {
    0: "erro",
    1: "pendente",
    2: "aceito pelo servidor",
    3: "entregue no aparelho",
    4: "lido",
    5: "reproduzido",
  };
  return labels[status] || `status ${status}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Hipersales-Token": TOKEN,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }
  return data;
}

async function postState(payload) {
  try {
    await api("/api/internal/whatsapp/state", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    log("Falha ao atualizar estado no HiperSales:", error.message);
  }
}

async function isEnabled() {
  try {
    const result = await api("/api/internal/whatsapp/settings");
    return Boolean(result.whatsapp?.enabled);
  } catch (error) {
    log("Falha ao ler configuracao:", error.message);
    return false;
  }
}

async function readSettings() {
  const result = await api("/api/internal/whatsapp/settings");
  return result.whatsapp || {};
}

function clearAuthState() {
  try {
    rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (error) {
    log("Falha ao limpar sessao do WhatsApp:", error.message || error);
  }
}

function jidFromPhone(phone) {
  const digits = String(phone || "").replace(/\D+/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

async function resolveWhatsAppJid(phone) {
  const fallbackJid = jidFromPhone(phone);
  if (!fallbackJid || !socket?.onWhatsApp) {
    return fallbackJid;
  }
  const results = await socket.onWhatsApp(fallbackJid);
  const match = Array.isArray(results) ? results.find((item) => item?.exists) : null;
  return match?.jid || "";
}

async function markMessage(id, sent, error = "") {
  await api(`/api/internal/whatsapp/outbox/${id}`, {
    method: "POST",
    body: JSON.stringify({ sent, error }),
  });
}

async function pollPendingMessages() {
  if (!connected || !socket || polling) return;
  polling = true;
  try {
    const result = await api("/api/internal/whatsapp/pending");
    const messages = result.messages || [];
    for (const message of messages) {
      const jid = await resolveWhatsAppJid(message.phone);
      if (!jid) {
        await markMessage(message.id, false, "Numero nao encontrado no WhatsApp.");
        continue;
      }
      try {
        const sent = await socket.sendMessage(jid, { text: message.body });
        if (sent?.key?.id) {
          sentMessageOutbox.set(sent.key.id, message.id);
        }
        await markMessage(message.id, true);
        log(`WhatsApp enviado para ${message.phone} em ${jid} (outbox #${message.id}, msg ${sent?.key?.id || "sem-id"})`);
      } catch (error) {
        await markMessage(message.id, false, error.message || String(error));
        log(`Falha ao enviar WhatsApp #${message.id}:`, error.message || error);
      }
    }
  } catch (error) {
    log("Falha ao buscar fila de WhatsApp:", error.message);
  } finally {
    polling = false;
  }
}

async function connect() {
  if (socket) return;
  const settings = await readSettings().catch((error) => {
    log("Falha ao ler configuracao:", error.message);
    return {};
  });
  lastQrToken = settings.qr_token || lastQrToken;
  if (!settings.enabled) {
    connected = false;
    await postState({ connected: false, qr_payload: "", last_error: "" });
    log("WhatsApp desativado nas configuracoes. Aguardando...");
    setTimeout(connect, 10000);
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  socket = makeWASocket({
    auth: state,
    version,
    browser: ["HiperSales Web", "Chrome", "1.0"],
    logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" }),
    printQRInTerminal: false,
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      connected = false;
      await postState({ connected: false, qr_payload: qr, last_error: "" });
      log("Novo QR do WhatsApp gerado.");
    }

    if (connection === "open") {
      connected = true;
      const instanceId = socket.user?.id || "";
      await postState({ connected: true, qr_payload: "", instance_id: instanceId, last_error: "" });
      log("WhatsApp conectado.");
    }

    if (connection === "close") {
      connected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const message = lastDisconnect?.error?.message || "Conexao fechada.";
      await postState({ connected: false, last_error: message });
      log("WhatsApp desconectado:", message);
      if (!loggedOut) {
        setTimeout(connect, 5000);
      } else {
        log("Sessao encerrada no WhatsApp. Gere um novo QR no HiperSales.");
      }
    }
  });

  socket.ev.on("messages.update", (updates) => {
    for (const update of updates || []) {
      const messageId = update?.key?.id;
      if (!messageId || !sentMessageOutbox.has(messageId)) continue;
      const outboxId = sentMessageOutbox.get(messageId);
      log(`WhatsApp status ${messageStatusLabel(update.update?.status)} (outbox #${outboxId}, msg ${messageId})`);
      if ([3, 4, 5].includes(update.update?.status)) {
        sentMessageOutbox.delete(messageId);
      }
    }
  });
}

setInterval(pollPendingMessages, POLL_MS);
setInterval(async () => {
  if (reconnecting) return;
  try {
    const settings = await readSettings();
    if (!settings.enabled) {
      if (socket) {
        reconnecting = true;
        try {
          await socket.logout();
        } catch {
          socket.end?.();
        }
        clearAuthState();
        socket = null;
        connected = false;
        reconnecting = false;
      }
      return;
    }
    if (settings.qr_token && settings.qr_token !== lastQrToken) {
      reconnecting = true;
      lastQrToken = settings.qr_token;
      connected = false;
      try {
        if (socket) {
          await socket.logout().catch(() => socket?.end?.());
        }
      } catch {
        // Ignore stale sockets while forcing a new QR.
      }
      clearAuthState();
      socket = null;
      reconnecting = false;
      connect().catch((error) => log("Falha ao reconectar WhatsApp:", error.message || error));
    }
  } catch (error) {
    log("Falha ao monitorar configuracao:", error.message);
  } finally {
    reconnecting = false;
  }
}, 5000);
connect().catch(async (error) => {
  await postState({ connected: false, last_error: error.message || String(error) });
  log("Falha ao iniciar WhatsApp:", error.message || error);
  setTimeout(connect, 10000);
});
