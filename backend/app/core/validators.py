"""Normalização e validação de dados reutilizadas pelos schemas."""

import re

_NON_DIGITS = re.compile(r"\D")
_SPACES = re.compile(r"\s+")

# Senhas óbvias que passariam no tamanho mínimo. Lista curta de propósito:
# o objetivo é barrar o pior, não substituir um verificador completo.
_COMMON_PASSWORDS = {
    "1234567890",
    "12345678910",
    "0123456789",
    "senha12345",
    "senha123456",
    "password123",
    "qwertyuiop",
    "despacha123",
    "admin12345",
    "abcdefghij",
}

PASSWORD_MIN_LENGTH = 10
# Teto: Argon2 com entradas gigantes vira vetor de negação de serviço.
PASSWORD_MAX_LENGTH = 128


def normalize_name(value: str) -> str:
    """Remove espaços nas pontas e colapsa espaços repetidos."""
    value = _SPACES.sub(" ", value).strip()
    if not value:
        raise ValueError("Informe o nome.")
    return value


def normalize_phone(value: str) -> str:
    """Telefone brasileiro → só dígitos, com código do país.

    "(11) 98765-4321" → "5511987654321"
    """
    digits = _NON_DIGITS.sub("", value)
    if len(digits) in (10, 11):
        digits = "55" + digits
    if len(digits) not in (12, 13) or not digits.startswith("55"):
        raise ValueError("Telefone inválido. Use DDD + número, ex.: (11) 98765-4321.")
    return digits


def validate_password_strength(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"A senha deve ter pelo menos {PASSWORD_MIN_LENGTH} caracteres.")
    if len(value) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"A senha deve ter no máximo {PASSWORD_MAX_LENGTH} caracteres.")
    if len(set(value)) < 4 or value.lower() in _COMMON_PASSWORDS:
        raise ValueError("Senha muito fácil de adivinhar. Escolha outra.")
    return value
