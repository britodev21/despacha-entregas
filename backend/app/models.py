"""Registro de todos os models.

O Alembic precisa que todos os models estejam importados para comparar o
banco com o código. Ao criar um model novo, importe-o aqui.
"""

from app.core.db import Base
from app.modules.companies.models import Company

__all__ = ["Base", "Company"]
