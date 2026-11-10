# QA report

## G1 scaffold, November 10, 2026

Windows, Node 20.19.0, npm 11.14.1. `npm ci --prefer-offline --no-audit` installed 213 packages. `npm audit` reported zero vulnerabilities. `npm run lint`, `npm run typecheck`, and `npm run build` exited 0. Vite emitted 224.08 kB of JavaScript (69.61 kB gzip) and a 0.38 kB HTML entry. `npm run dev` started on loopback and an HTTP request to / returned 200 with the project title. The scaffold loads no third-party runtime assets. Browser QA remains pending.
