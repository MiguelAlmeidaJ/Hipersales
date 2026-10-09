/**
 * PM2 production processes for the existing Python API and Next.js frontend.
 * Run from the repository root: pm2 start ecosystem.config.cjs
 * PostgreSQL and Redis run under systemd; Evolution API uses a third PM2 process.
 */
const path = require("node:path");
const root = __dirname;
module.exports = {
  apps: [
    {
      name: "hipersales-api",
      cwd: root,
      script: path.join(root, "apps/api/app.py"),
      interpreter: process.env.HIPERSALES_PYTHON || (process.platform === "win32" ? "python" : "python3"),
      exec_mode: "fork",
      instances: 1, // In-process schedulers: do not duplicate background jobs.
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 3000,
      env: {
        HOST: "127.0.0.1",
        PORT: "8000",
        PYTHONUNBUFFERED: "1",
        ...(process.env.HYPERSALES_ENV_FILE ? { HYPERSALES_ENV_FILE: process.env.HYPERSALES_ENV_FILE } : {}),
      },
    },
    {
      name: "hipersales-web",
      cwd: path.join(root, "apps/web"),
      script: path.join(root, "apps/web/node_modules/next/dist/bin/next"),
      args: "start -H 127.0.0.1 -p 3000",
      interpreter: process.execPath,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "750M",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        HIPERSALES_API_ORIGIN: process.env.HIPERSALES_API_ORIGIN || "http://127.0.0.1:8000",
      },
    },
    {
      name: "hipersales-evolution",
      cwd: process.env.HIPERSALES_EVOLUTION_DIR || path.join(root, "services/evolution-api"),
      script: "npm",
      args: "run start:prod",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1200M",
      restart_delay: 5000,
      env: { NODE_ENV: "production" },
    },
  ],
};
