Sermon Live for Windows (x64)

This portable package includes the application runtime. Python and Node.js/npm are not required on the operator computer.
Because this package is not code-signed, Windows SmartScreen may show a warning.
Run it only if you obtained it from a source you trust.

FIRST-TIME SETUP

1. Extract the ZIP into a folder that you can keep between updates.
2. Create your Operator credentials before the first launch:

   - Open PowerShell.
   - Run: New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Sermon Live"
   - Run: notepad "$env:LOCALAPPDATA\Sermon Live\.env"
   - Add these two lines, replacing the example values:

     APP_OPERATOR_PASSWORD=choose-a-long-private-password
     APP_OPERATOR_SESSION_SECRET=paste-a-random-secret-here

   Use a password with letters, numbers, and hyphens to avoid .env quoting issues.
   Generate the session secret in PowerShell and copy its output into the file:

     $bytes = New-Object byte[] 48
     $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
     $rng.GetBytes($bytes)
     $rng.Dispose()
     [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

   Save the file. Do not share it. It is stored under your Windows user profile.

RUNNING

1. Start sermon-live.exe and keep its console window open.
2. Open the Operator URL printed in the console, normally http://localhost:8080/operator.
3. If Windows Defender Firewall asks, allow access on Private networks only.
4. Open the printed Listener URL on devices connected to the same trusted Wi-Fi.
5. To stop the server, focus its console and press Ctrl+C.

If Windows did not show a firewall prompt, open Windows Security > Firewall & network
protection > Allow an app through firewall. Add sermon-live.exe and allow it only on
Private networks. Do not enable router port forwarding for Sermon Live.

If you open the Operator UI using the computer's LAN IP instead of localhost, add
that exact origin to APP_ALLOWED_ORIGINS in the .env file, for example:

  APP_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://192.168.1.20:8080

DIAGNOSTICS AND UPDATING

For diagnostic logs, start the app with sermon-live.exe --verbose. Logs are written
under %LOCALAPPDATA%\Sermon Live\logs.

Stop the server, extract the newer ZIP into the same application folder, and replace
the application files. Do not delete %LOCALAPPDATA%\Sermon Live; it contains your
Operator settings, credentials, and any diagnostic logs.
