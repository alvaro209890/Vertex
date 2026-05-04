import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ensureProfile, isBlocked } from '../db/store.js';
const { verify: jwtVerify } = jwt;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'vertex-ad5da';
const JWKS_URL = `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`;

let cachedKeys = null;
let cacheExpiry = 0;

async function fetchPublicKeys() {
  if (cachedKeys && Date.now() < cacheExpiry) {
    return cachedKeys;
  }
  const res = await fetch(JWKS_URL);
  const data = await res.json();
  cachedKeys = data;
  // Cache por 1 hora (ou o que o servidor mandar no cache-control)
  cacheExpiry = Date.now() + 60 * 60 * 1000;
  return data;
}

/**
 * Decodifica a parte header de um JWT sem validar.
 */
function decodeJWTHeader(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Decodifica o payload de um JWT sem validar.
 */
function decodeJWTPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Verifica um ID token do Firebase Auth.
 * @param {string} idToken
 * @returns {Promise<{ uid: string, email?: string }>}
 */
export async function verifyToken(idToken) {
  const header = decodeJWTHeader(idToken);
  if (!header || !header.kid) {
    throw new Error('Token mal formatado: kid ausente');
  }

  const payload = decodeJWTPayload(idToken);
  if (!payload) {
    throw new Error('Token mal formatado: payload invalido');
  }

  // Verifica audience (projectId do Firebase)
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error(`Token audience invalido: esperado ${FIREBASE_PROJECT_ID}, recebido ${payload.aud}`);
  }

  // Verifica issuer
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Token issuer invalido`);
  }

  // Verifica exp
  if (payload.exp * 1000 < Date.now()) {
    throw new Error('Token expirado');
  }

  // Busca a chave pública
  const keys = await fetchPublicKeys();
  const pem = keys[header.kid];
  if (!pem) {
    throw new Error('Chave publica nao encontrada para este token');
  }

  const publicKey = createPublicKey(pem);

  return new Promise((resolve, reject) => {
    jwtVerify(idToken, publicKey, {
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve({ uid: decoded.user_id || decoded.sub, email: decoded.email || '' });
    });
  });
}

/**
 * Express middleware: valida JWT do Firebase Auth.
 * Anexa `req.user = { uid, email }` em caso de sucesso.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticacao ausente' });
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    console.error('Erro ao validar token Firebase:', err.message);
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }

  try {
    req.user = { uid: decoded.uid, email: decoded.email || '' };
    await ensureProfile(req.user.uid, req.user.email);
    if (await isBlocked(req.user.uid)) {
      return res.status(403).json({ error: 'Conta bloqueada' });
    }
    next();
  } catch (err) {
    console.error('Erro ao carregar perfil Firebase:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
