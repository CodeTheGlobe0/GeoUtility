# GeoUtility GIS & Planning Portal

A premium, modern web application for GIS data quality checks and planning management. It features a Django REST framework backend with JWT authentication and Celery task execution, combined with a responsive, glassmorphic React/Vite frontend built around OpenLayers interactive maps.

---

## 🛠️ Technology Stack

- **Backend**: Python, Django, Django REST Framework, Simple JWT, Celery, Redis.
- **Frontend**: React, Vite, OpenLayers (GIS mapping), Vanilla CSS (Glassmorphism layout).
- **Tooling**: `pip` (or `uv`), `Node.js` & `npm`.

---

## 🚀 Setup & Installation

Follow these steps to set up the project locally on your machine.

### Prerequisites

Ensure you have the following installed:
- Python 3.10+
- Node.js 18+ (with npm)
- Redis Server (required for Celery tasks broker)

---

### 🐍 1. Backend Configuration (Django)

1. Open your terminal and navigate to the project root directory.
2. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the virtual environment:
   - **Windows**:
     ```powershell
     .venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```
4. Install all backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
5. Apply database migrations:
   ```bash
   python backend/manage.py migrate
   ```
6. Create an Administrative Superuser account (needed to access the Admin Dashboard):
   ```bash
   python backend/manage.py createsuperuser
   ```
7. Start your local Redis Server (broker).
8. Start the Celery task worker in a separate terminal:
   ```bash
   # Make sure your virtual env is active
   cd backend
   celery -A config worker --pool=solo -l info
   ```
9. Start the Django development server:
   ```bash
   python manage.py runserver
   ```
   The backend API will run at `http://127.0.0.1:8000/`.

---

### ⚛️ 2. Frontend Configuration (React + Vite)

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install all frontend node package dependencies:
   ```bash
   npm install
   ```
3. Launch the Vite local development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173/` (or the port specified in terminal output).
4. **Login**: Sign in using the Superuser credentials created in Step 6 of the backend configuration.

---

## 📦 Building for Production

To build a minified, production-ready bundle of the React application:
```bash
cd frontend
npm run build
```
This compiles all files and outputs them into the `frontend/dist/` directory.