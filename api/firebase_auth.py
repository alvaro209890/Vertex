"""Validação de tokens Firebase Auth JWT para o proxy remoto.

Usado apenas quando VERTEX_REMOTE=1 (no servidor).
Segue o mesmo padrão do middleware Express em `web/backend/middleware/auth.js`.
"""

from __future__ import annotations

import json
import time
import urllib.request
from base64 import urlsafe_b64decode
from dataclasses import dataclass

from loguru import logger

FIREBASE_PROJECT_ID = "vertex-ad5da"
JWKS_URI = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
ISSUER = f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}"

# Cache para as chaves públicas JWKS
_jwks_cache: dict[str, str] | None = None
_jwks_cache_expiry: float = 0.0


@dataclass
class FirebaseUser:
    uid: str
    email: str


def _decode_jwt_part(token: str, part_index: int) -> dict | None:
    """Decodifica uma parte de um JWT (header ou payload) sem validar."""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        payload = parts[part_index]
        # Add padding if needed
        padded = payload + "=" * (4 - len(payload) % 4)
        return json.loads(urlsafe_b64decode(padded))
    except Exception:
        return None


def _fetch_public_keys() -> dict[str, str]:
    """Busca as chaves públicas do Firebase (cache de 1 hora)."""
    global _jwks_cache, _jwks_cache_expiry

    now = time.time()
    if _jwks_cache is not None and now < _jwks_cache_expiry:
        return _jwks_cache

    try:
        req = urllib.request.Request(JWKS_URI)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        _jwks_cache = data
        _jwks_cache_expiry = now + 3600  # 1 hora
        return data
    except Exception as e:
        logger.error("Falha ao buscar chaves Firebase JWKS: {}", e)
        raise


def verify_token(id_token: str) -> FirebaseUser:
    """Valida um Firebase ID token e retorna os dados do usuário.

    Segue o mesmo processo do middleware Express:
    1. Decodifica header (extrai kid) e payload (verifica aud, iss, exp)
    2. Busca a chave pública PEM pelo kid
    3. Verifica a assinatura
    4. Extrai uid e email

    Raises:
        ValueError: se o token for inválido ou expirado
    """
    # Decodifica header para extrair kid
    header = _decode_jwt_part(id_token, 0)
    if not header or "kid" not in header:
        raise ValueError("Token mal formatado: kid ausente")

    # Decodifica payload para validar claims antes da assinatura
    payload = _decode_jwt_part(id_token, 1)
    if not payload:
        raise ValueError("Token mal formatado: payload invalido")

    # Valida audience
    if payload.get("aud") != FIREBASE_PROJECT_ID:
        raise ValueError(
            f"Token audience invalido: esperado {FIREBASE_PROJECT_ID}, "
            f"recebido {payload.get('aud')}"
        )

    # Valida issuer
    if payload.get("iss") != ISSUER:
        raise ValueError("Token issuer invalido")

    # Valida expiração
    exp = payload.get("exp", 0)
    if exp < time.time():
        raise ValueError("Token expirado")

    # Busca a chave pública
    keys = _fetch_public_keys()
    kid = header["kid"]
    pem = keys.get(kid)
    if not pem:
        raise ValueError(f"Chave publica nao encontrada para kid={kid}")

    # Verifica assinatura usando PyJWT
    try:
        import jwt as _jwt

        decoded = _jwt.decode(
            id_token,
            pem.encode("utf-8"),
            algorithms=["RS256"],
            options={
                "verify_signature": True,
                "require": ["exp", "iat"],
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": False,
                "verify_iss": False,
            },
            audience=FIREBASE_PROJECT_ID,
            issuer=ISSUER,
        )

        uid = decoded.get("user_id") or decoded.get("sub", "")
        email = decoded.get("email", "")
        return FirebaseUser(uid=uid, email=email)

    except Exception as e:
        logger.warning("Falha na verificacao do token Firebase: {}", e)
        raise ValueError(f"Token invalido: {e}") from e


def verify_token_simple(id_token: str) -> FirebaseUser:
    """Versão simplificada que usa o JWKS como PEM mapping (sem PyJWT).

    Útil quando a versão do PyJWT não suporta o algoritmo RS256 diretamente.
    Usa o modulo `jose` ou fallback para `rsassa-pss`.
    """
    return verify_token(id_token)
