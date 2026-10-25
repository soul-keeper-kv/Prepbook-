// The one port the app runs on, for both start.sh (server/serve.ts) and `npm run dev`.
// One port means one origin, so the browser keeps a single copy of the progress for both
// (localStorage belongs to the origin). Set PORT to override it.
export const APP_PORT = Number(process.env.PORT) || 3303
