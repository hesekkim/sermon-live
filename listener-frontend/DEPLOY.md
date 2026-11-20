# Listener Vercel deployment

The Listener is a separate static Vite application. Configure its Vercel project
with `sermon-live/listener-frontend` as the root directory, `npm run build` as
the build command, and `dist` as the output directory. Vercel serves the UI
only; the browser connects directly to Berlin for HTTPS admission and WSS audio.
Do not add a Vercel Function or WebSocket proxy for relay traffic.

Set `VITE_RELAY_API_BASE_URL` to the public Berlin relay API base ending in
`/api/v1/relay` (for example, `https://relay.example.com/api/v1/relay`).
Configure it independently for Development, Preview, and Production. Preview
should use a staging relay where available. This URL is public and is compiled
into the static bundle; do not put access tokens or credentials in it or in any
`VITE_` variable. The Listener project does not need
`APP_RELAY_PUBLISHER_CREDENTIAL` or any other server secret.

Add the exact deployed Listener origin to Berlin's
`APP_RELAY_ALLOWED_ORIGINS`, including separately approved preview origins.
`APP_RELAY_ALLOWED_ORIGIN_SUFFIXES` can support controlled preview domains, but
only use a suffix whose entire namespace is controlled by the deployment team.
The relay checks WebSocket Origin independently of CORS; both HTTP session
admission and WebSocket Origin policy must allow the intended origin.

The Local PC's Operator UI remains in `sermon-live/frontend`; it is not part
of this Vercel project. Listener builds contain only the Listener route and
public relay endpoint. No Vercel configuration proxies `/ws` or other relay
traffic.

The session link grants Listener access to anyone who has it. Share it only
with the intended audience.

After changing any Vercel environment variable, redeploy the relevant
environment. Confirm that `/listen?session=<session-code>` loads over HTTPS,
that the browser requests the configured Berlin HTTPS endpoint and opens its
WSS Listener URL, and that no short-lived Listener token appears in URL
parameters, storage, or the built assets. Vercel deployment and physical mobile-browser
smoke tests must be completed in the target accounts/devices.
