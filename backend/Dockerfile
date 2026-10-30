# bookworm: Microsoft publishes the SQL Server ODBC driver for Debian 12.
FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# unixODBC + msodbcsql18 back pyodbc's SQL Server connections (db_loader.py).
# geopandas/pyogrio wheels bundle GDAL, so no system GDAL is needed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg unixodbc \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
        > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get purge -y curl gnupg && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8006

# migrate applies schema changes to Postgres on start; collectstatic
# fills the shared "static" volume that nginx serves.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8006 --workers 4 --threads 2 --timeout 300"]
