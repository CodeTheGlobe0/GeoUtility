import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _get_fernet() -> Fernet:
    """
    Derives a valid Fernet key from Django's SECRET_KEY, so no extra secret
    needs to be managed/deployed separately.
    """
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


class EncryptedCharField(models.CharField):
    """
    A CharField that transparently encrypts its value at rest using Fernet.
    Reading the field in Python (e.g. instance.password) always returns the
    decrypted plaintext; only the database column holds ciphertext.
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if not value:
            return value
        return _get_fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if not value:
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Pre-existing plaintext value or a rotated SECRET_KEY — surface
            # it as-is rather than failing the whole request.
            return value
