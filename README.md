# sermon-live

Korean-to-German live sermon interpreter for a church LAN.

Congregation members open a phone browser on the same Wi-Fi. The operator laptop captures the pulpit mic, sends audio to an injected interpreter (OpenAI Realtime when enabled, Echo for free local tests), and broadcasts PCM plus subtitles over WebSocket.

## Layout

- `backend/` — FastAPI, capture, interpreter adapters, broadcast
- `frontend/` — Vite React listen page and operator desk
- `.agent/rules/` — agent rules (not `.cursor`)

## Run

Backend:

```powershell
cd sermon-live/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python main.py
```

On macOS, install PyAudio with a PortAudio build that includes CoreAudio support and grant Microphone access to the app or terminal running the backend. Operator device settings use CoreAudio inputs by default; use the all-host-API list if an expected physical input is missing.

Open `http://<LAN-IP>:8080/operator` (or Vite `http://localhost:5173/operator`) to choose the interpreter, save the API key, then start capture. Congregation URL is `/listen`.

Before starting the backend, edit `backend/.env` and set both Operator secrets. Generate independent values with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(24))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use the first value for `APP_OPERATOR_PASSWORD` and the second for `APP_OPERATOR_SESSION_SECRET`. The session secret is a server-only signing key, not another password to enter at login, and it is unrelated to the Sermon Session feature. It signs the authenticated cookie so the backend can reject forged or altered sessions. Do not commit `.env` or reuse either value for the other setting. If either value is missing, Operator login and protected APIs stay unavailable. Operator sign-in uses only the local password; no email account or external auth service is involved.

Changing the password does not revoke cookies already issued; they expire after 12 hours. Rotate the session secret as well when immediate revocation of all Operator sessions is required.

`APP_ALLOWED_ORIGINS` must list the exact origin used by the Operator browser. The defaults cover the Vite localhost URLs; if opening the bundled UI through the laptop LAN address, add that exact origin (for example `http://192.168.1.20:8080`). Do not use `*`.

The Operator API, audio tools, and `/ws/operator` require a login. `/health`, `/listen`, and `/ws/listen` remain public to devices on the LAN; anyone on that Wi-Fi can listen to the live audio and captions. For Windows, mark the connected network **Private** and allow Python/sermon-live through Windows Defender Firewall only on **Private networks**. Do not enable router port forwarding for this server.

This setup uses HTTP and `ws://`, not HTTPS/WSS. The password and session cookie can be observed or stolen by an active attacker on the same network; Operator authentication does not remove that transport risk. Use only a trusted private LAN.

Frontend (dev):

```powershell
cd sermon-live/frontend
npm install
npm run dev
```

Phones must use the laptop LAN IP, not `localhost`.

## Interpreter injection

`APP_INTERPRETER=echo|openai`

Pipeline code must not branch on vendor names. Add a new provider by implementing `LiveInterpreter` and registering it in the factory.

## Sermon Session

Sermon Session is intentionally inactive in the application: its API router and Operator page route are not registered, and translation sessions do not load or expose sermon data. The endpoint, store, UI source, and JSON data are retained for possible future work; reactivation requires explicitly registering the routes again.
