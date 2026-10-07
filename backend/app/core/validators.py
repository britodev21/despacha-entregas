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


# Unidades federativas do Brasil.
BRAZILIAN_STATES = frozenset({
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
})  # fmt: skip


def normalize_zip_code(value: str) -> str:
    digits = _NON_DIGITS.sub("", value)
    if len(digits) != 8:
        raise ValueError("CEP inválido. Use 8 dígitos, ex.: 01310-100.")
    return digits


def normalize_state(value: str) -> str:
    state = value.strip().upper()
    if state not in BRAZILIAN_STATES:
        raise ValueError("UF inválida. Use a sigla do estado, ex.: SP.")
    return state


def normalize_document(value: str) -> str:
    """CPF (11 dígitos) ou CNPJ (14), validando os dígitos verificadores."""
    digits = _NON_DIGITS.sub("", value)
    if len(digits) == 11 and _valid_cpf(digits):
        return digits
    if len(digits) == 14 and _valid_cnpj(digits):
        return digits
    raise ValueError("CPF ou CNPJ inválido.")


def _check_digit(digits: str, weights: list[int]) -> int:
    remainder = sum(int(d) * w for d, w in zip(digits, weights, strict=False)) % 11
    return 0 if remainder < 2 else 11 - remainder


def _valid_cpf(cpf: str) -> bool:
    if cpf == cpf[0] * 11:  # 000.000.000-00, 111.111.111-11... passam na conta, mas são inválidos
        return False
    first = _check_digit(cpf[:9], list(range(10, 1, -1)))
    second = _check_digit(cpf[:10], list(range(11, 1, -1)))
    return cpf[-2:] == f"{first}{second}"


def _valid_cnpj(cnpj: str) -> bool:
    if cnpj == cnpj[0] * 14:
        return False
    weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    first = _check_digit(cnpj[:12], weights)
    second = _check_digit(cnpj[:13], [6, *weights])
    return cnpj[-2:] == f"{first}{second}"
