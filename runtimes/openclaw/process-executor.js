"use strict";

const { spawn } = require("child_process");

function normalizeArgs(args) {
  if (!Array.isArray(args)) {
    throw new Error("OpenClawProcessExecutor args must be an array");
  }
  return args.map((value) => String(value));
}

class OpenClawProcessExecutor {
  constructor(options = {}) {
    const command = String(options.command || "").trim();
    if (!command) {
      throw new Error("OpenClawProcessExecutor requires command");
    }

    this.command = command;
    this.args = normalizeArgs(options.args || []);
    this.cwd = options.cwd;
    this.env = options.env ? { ...process.env, ...options.env } : process.env;
    this.spawnImpl = options.spawnImpl || spawn;
  }

  async execute(task, runtimeContext) {
    const timeoutMs = Number(task && task.timeoutMs) > 0 ? Number(task.timeoutMs) : undefined;
    const payload = JSON.stringify({ task, runtimeContext });

    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(this.command, this.args, {
        cwd: this.cwd,
        env: this.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let timer;

      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        fn(value);
      };

      child.on("error", (error) => {
        settle(reject, new Error(`OpenClaw process failed to start: ${error.message}`));
      });

      if (child.stdout) {
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
      }

      if (child.stderr) {
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
      }

      child.on("close", (code, signal) => {
        if (settled) return;

        if (code !== 0) {
          const detail = stderr.trim() || `exit code ${code}${signal ? ` (${signal})` : ""}`;
          settle(reject, new Error(`OpenClaw process execution failed: ${detail}`));
          return;
        }

        const trimmed = stdout.trim();
        if (!trimmed) {
          settle(reject, new Error("OpenClaw process returned empty stdout"));
          return;
        }

        let result;
        try {
          result = JSON.parse(trimmed);
        } catch (error) {
          settle(reject, new Error(`OpenClaw process returned invalid JSON: ${error.message}`));
          return;
        }

        if (!result || typeof result !== "object" || Array.isArray(result)) {
          settle(reject, new Error("OpenClaw process result must be a JSON object"));
          return;
        }

        settle(resolve, result);
      });

      if (timeoutMs) {
        timer = setTimeout(() => {
          try {
            child.kill("SIGTERM");
          } catch (_) {
            // Best effort: process may have already exited.
          }
          settle(reject, new Error(`OpenClaw process timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      if (!child.stdin) {
        settle(reject, new Error("OpenClaw process stdin is unavailable"));
        return;
      }

      child.stdin.on("error", (error) => {
        settle(reject, new Error(`OpenClaw process stdin failed: ${error.message}`));
      });
      child.stdin.end(`${payload}\n`);
    });
  }
}

module.exports = {
  OpenClawProcessExecutor,
};
