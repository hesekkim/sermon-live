# sermon-live

Korean-to-German live sermon interpreter for a church LAN.

Congregation members open a phone browser on the same Wi-Fi. The operator laptop captures the pulpit mic, sends audio to an injected interpreter (Gemini Live by default, Echo for free local tests), and broadcasts PCM plus subtitles over WebSocket.

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

Open `http://<LAN-IP>:8080/operator` (or Vite `http://localhost:5173/operator`) to choose the interpreter, save the API key, then start capture. Congregation URL is `/listen`.

Frontend (dev):

```powershell
cd sermon-live/frontend
npm install
npm run dev
```

Phones must use the laptop LAN IP, not `localhost`.

## Interpreter injection

`APP_INTERPRETER=echo|gemini|openai`

Pipeline code must not branch on vendor names. Add a new provider by implementing `LiveInterpreter` and registering it in the factory.
