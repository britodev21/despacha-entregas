import uuid

from pydantic import BaseModel, ConfigDict


class ProofSettings(BaseModel):
    """O que o entregador precisa registrar ao finalizar (configurável)."""

    model_config = ConfigDict(extra="forbid")

    require_recipient_name: bool = False
    require_photo: bool = False
    require_signature: bool = False


class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")  # tolera chaves antigas no JSONB

    proof: ProofSettings = ProofSettings()


class CompanyOut(BaseModel):
    id: uuid.UUID
    name: str
    timezone: str
    settings: CompanySettings


class CompanySettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    proof: ProofSettings
