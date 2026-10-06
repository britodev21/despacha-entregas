"""Registro de todos os models.

O Alembic precisa que todos os models estejam importados para comparar o
banco com o código. Ao criar um model novo, importe-o aqui.
"""

from app.core.db import Base
from app.modules.audit.models import AuditLog
from app.modules.auth.models import RefreshToken
from app.modules.companies.models import Company
from app.modules.users.models import User

__all__ = ["AuditLog", "Base", "Company", "RefreshToken", "User"]
