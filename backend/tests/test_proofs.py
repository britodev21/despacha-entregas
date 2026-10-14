"""Comprovantes: upload seguro de imagens, permissões e exigências configuráveis."""

import io

import pytest
from PIL import Image

from app.core import storage
from app.core.permissions import Role
from app.modules.deliveries import service as delivery_service
from app.modules.deliveries.models import DeliveryFile


def jpeg(size=(2400, 1800), *, with_exif=True) -> bytes:
    image = Image.new("RGB", size, (200, 120, 40))
    exif = image.getexif()
    if with_exif:
        exif[0x010F] = "Fabricante do celular"  # Make
        exif[0x0110] = "Modelo secreto"  # Model
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif.tobytes())
    return out.getvalue()


def png(size=(400, 150)) -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", size, (0, 0, 0, 0)).save(out, format="PNG")
    return out.getvalue()


@pytest.fixture
def admin_headers(make_user, auth_headers):
    return auth_headers(make_user(Role.ADMIN))


@pytest.fixture
def operator_headers(make_user, auth_headers):
    return auth_headers(make_user(Role.OPERATOR))


@pytest.fixture
def deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511911112222")


@pytest.fixture
def me(auth_headers, deliverer):
    return auth_headers(deliverer)


@pytest.fixture
def delivery(client, operator_headers, deliverer, me):
    customer = client.post(
        "/api/v1/clients",
        json={
            "name": "Maria",
            "addresses": [
                {"street": "Rua A", "number": "1", "neighborhood": "B", "city": "C", "state": "SP"}
            ],
        },
        headers=operator_headers,
    ).json()
    created = client.post(
        "/api/v1/deliveries",
        json={
            "client_id": customer["id"],
            "client_address_id": customer["addresses"][0]["id"],
            "deliverer_id": str(deliverer.id),
        },
        headers=operator_headers,
    ).json()
    client.post(f"/api/v1/me/deliveries/{created['id']}/start", headers=me)
    return created


def upload(client, headers, delivery, kind, data, *, base="/api/v1/me/deliveries"):
    return client.post(
        f"{base}/{delivery['id']}/files",
        data={"kind": kind},
        files={"file": ("foto.jpg", data, "image/jpeg")},
        headers=headers,
    )


# ------------------------------------------------------------- segurança


def test_photo_is_reencoded_resized_and_stripped(client, me, delivery, db):
    response = upload(client, me, delivery, "PROOF_PHOTO", jpeg())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "image/jpeg"
    assert body["url"] == f"/api/v1/files/{body['id']}"

    stored = db.get(DeliveryFile, body["id"])
    with Image.open(storage.resolve(stored.storage_key)) as image:
        assert max(image.size) <= 1600
        assert len(image.getexif()) == 0  # EXIF (aparelho, GPS...) descartado
    assert "foto.jpg" not in stored.storage_key  # nome original nunca usado


def test_fake_image_is_rejected(client, me, delivery):
    response = upload(client, me, delivery, "PROOF_PHOTO", b"<?php echo 'oi'; ?>")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


def test_decompression_bomb_is_rejected(client, me, delivery):
    out = io.BytesIO()
    Image.new("1", (8000, 8000)).save(out, format="PNG")  # arquivo pequeno, 64 Mpx
    response = upload(client, me, delivery, "PROOF_PHOTO", out.getvalue())
    assert response.status_code == 400


def test_upload_size_limit(client, me, delivery, monkeypatch):
    monkeypatch.setattr(delivery_service, "max_upload_bytes", lambda: 1000)
    response = upload(client, me, delivery, "PROOF_PHOTO", jpeg())
    assert response.status_code == 413


def test_deliverer_cannot_upload_before_starting(
    client, operator_headers, deliverer, me, make_user
):
    customer = client.post(
        "/api/v1/clients",
        json={
            "name": "X",
            "addresses": [
                {"street": "A", "number": "1", "neighborhood": "B", "city": "C", "state": "SP"}
            ],
        },
        headers=operator_headers,
    ).json()
    assigned = client.post(
        "/api/v1/deliveries",
        json={
            "client_id": customer["id"],
            "client_address_id": customer["addresses"][0]["id"],
            "deliverer_id": str(deliverer.id),
        },
        headers=operator_headers,
    ).json()
    assert upload(client, me, assigned, "PROOF_PHOTO", jpeg()).status_code == 409


# ------------------------------------------------------------- download


def test_download_permissions(
    client, me, delivery, operator_headers, make_user, auth_headers, other_company
):
    file_url = upload(client, me, delivery, "PROOF_PHOTO", jpeg()).json()["url"]

    ok = client.get(file_url, headers=operator_headers)
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "image/jpeg"
    assert client.get(file_url, headers=me).status_code == 200

    other_deliverer = auth_headers(make_user(Role.DELIVERER, phone="5511933334444"))
    assert client.get(file_url, headers=other_deliverer).status_code == 404
    outsider = auth_headers(make_user(Role.ADMIN, company=other_company))
    assert client.get(file_url, headers=outsider).status_code == 404
    assert client.get(file_url).status_code == 401


# ---------------------------------------------------------- exigências


def test_settings_are_admin_only_and_readable_by_team(client, admin_headers, operator_headers, me):
    payload = {"proof": {"require_photo": True}}
    assert (
        client.patch("/api/v1/company/settings", json=payload, headers=operator_headers).status_code
        == 403
    )
    response = client.patch("/api/v1/company/settings", json=payload, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["settings"]["proof"]["require_photo"] is True

    seen_by_deliverer = client.get("/api/v1/company", headers=me).json()
    assert seen_by_deliverer["settings"]["proof"] == {
        "require_recipient_name": False,
        "require_photo": True,
        "require_signature": False,
    }
    bad = {"proof": {"require_photo": True, "require_selfie": True}}
    assert (
        client.patch("/api/v1/company/settings", json=bad, headers=admin_headers).status_code == 422
    )


def test_required_proof_items_are_enforced(client, admin_headers, me, delivery):
    client.patch(
        "/api/v1/company/settings",
        json={
            "proof": {
                "require_recipient_name": True,
                "require_photo": True,
                "require_signature": True,
            }
        },
        headers=admin_headers,
    )
    complete_url = f"/api/v1/me/deliveries/{delivery['id']}/complete"

    missing = client.post(complete_url, json={}, headers=me)
    assert missing.status_code == 400
    assert missing.json()["error"]["code"] == "PROOF_INCOMPLETE"
    assert "foto" in missing.json()["error"]["message"]

    assert upload(client, me, delivery, "PROOF_PHOTO", jpeg()).status_code == 201
    assert upload(client, me, delivery, "PROOF_SIGNATURE", png()).status_code == 201
    done = client.post(complete_url, json={"received_by_name": "João"}, headers=me)
    assert done.status_code == 200
    kinds = sorted(f["kind"] for f in done.json()["files"])
    assert kinds == ["PROOF_PHOTO", "PROOF_SIGNATURE"]

    # Finalizada: não recebe mais arquivos.
    assert upload(client, me, delivery, "PROOF_PHOTO", jpeg()).status_code == 409


def test_operator_completion_bypasses_requirements(
    client, admin_headers, operator_headers, delivery
):
    client.patch(
        "/api/v1/company/settings",
        json={"proof": {"require_photo": True}},
        headers=admin_headers,
    )
    response = client.post(
        f"/api/v1/deliveries/{delivery['id']}/complete",
        json={"received_by_name": "Confirmado por telefone"},
        headers=operator_headers,
    )
    assert response.status_code == 200


def test_occurrence_with_photo(client, me, delivery, db):
    photo = upload(client, me, delivery, "OCCURRENCE_PHOTO", jpeg()).json()
    proof_photo = upload(client, me, delivery, "PROOF_PHOTO", jpeg()).json()
    issues_url = f"/api/v1/me/deliveries/{delivery['id']}/issues"

    wrong = client.post(
        issues_url, json={"type": "REFUSED", "photo_file_id": proof_photo["id"]}, headers=me
    )
    assert wrong.status_code == 404

    body = client.post(
        issues_url, json={"type": "DAMAGED_PRODUCT", "photo_file_id": photo["id"]}, headers=me
    ).json()
    occurrence_id = body["occurrences"][0]["id"]
    linked = next(f for f in body["files"] if f["id"] == photo["id"])
    assert linked["occurrence_id"] == occurrence_id
