import crypto from "crypto";

// Token de sessão de admin assinado (HMAC-SHA256), sem dependências externas.
// Formato: "<payload-base64url>.<assinatura-base64url>"
// O payload só guarda a validade (exp) — não há dado sensível nele, então não
// precisa (nem deve) ser decodificável como segredo, só verificável quanto à
// assinatura e ao prazo.
//
// Isto substitui o antigo esquema em que o PIN do admin ficava embutido em
// texto puro no bundle JS (ADMIN_PIN, em src/data.js) e a "trava" do painel
// era só uma comparação feita no navegador — qualquer pessoa que abrisse o
// código-fonte do site via DevTools via essas constantes. Agora o PIN só
// existe como variável de ambiente no servidor (ADMIN_PIN) e nunca é enviado
// ao cliente; o que o navegador recebe de volta é este token, que não revela
// o PIN e expira sozinho.

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET não configurada (ou muito curta) nas variáveis de ambiente do Vercel."
    );
  }
  return secret;
}

function sign(payloadB64, secret) {
  return base64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

export function createAdminToken() {
  const secret = getSecret();
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = base64url(payload);
  const sig = sign(payloadB64, secret);
  return payloadB64 + "." + sig;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  let secret;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;

  const expectedSig = sign(payloadB64, secret);
  const sigBuf = base64urlToBuffer(sig);
  const expectedBuf = base64urlToBuffer(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const payload = JSON.parse(base64urlToBuffer(payloadB64).toString("utf8"));
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export function getBearerToken(req) {
  const header = req.headers["authorization"] || req.headers["Authorization"];
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

// Comparação de PIN em tempo constante (o PIN tem poucos dígitos, então o
// ganho contra timing attack é pequeno, mas não custa nada fazer certo).
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}
