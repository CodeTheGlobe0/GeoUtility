from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/

env = environ.Env(DEBUG=(bool, True))
# overwrite=True: .env must win over OS variables for local runs. The Docker
# image has no .env (.dockerignore), so compose's environment still applies.
environ.Env.read_env(BASE_DIR / ".env", overwrite=True)

DB_HOST = env("DB_HOST", default="localhost")
DB_NAME = env("DB_NAME", default="globestack")
DB_USER = env("DB_USER", default="postgres")
DB_PASSWORD = env("DB_PASSWORD", default="")
DB_PORT = env.int("DB_PORT", default=5432)
SECRET_KEY = env("SECRET_KEY")
