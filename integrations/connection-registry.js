"use strict";

const crypto = require("crypto");

class ConnectionRegistry {
  constructor({ store }) {
    this.store = store || new Map();
    this.oauthStates = new Map();
  }

  createOAuthState({ provider, userId, redirectTo = "/" }) {
    const state = crypto.randomBytes(24).toString("hex");
    this.oauthStates.set(state, { provider, userId, redirectTo, createdAt: Date.now() });
    return state;
  }

  consumeOAuthState(state, { maxAgeMs = 10 * 60 * 1000 } = {}) {
    const record = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    if (!record) throw new Error("Invalid OAuth state");
    if (Date.now() - record.createdAt > maxAgeMs) throw new Error("Expired OAuth state");
    return record;
  }

  async save({ userId, provider, accountId, accessToken, refreshToken, expiresAt, scopes = [] }) {
    const normalizedAccountId = accountId || "default";
    const key = `${userId}:${provider}:${normalizedAccountId}`;
    const value = { userId, provider, accountId: normalizedAccountId, accessToken, refreshToken, expiresAt, scopes, updatedAt: new Date().toISOString() };
    if (this.store instanceof Map) this.store.set(key, value);
    else await this.store.set(key, value);
    return { key, provider, accountId: normalizedAccountId, scopes, expiresAt };
  }

  async get({ userId, provider, accountId = "default" }) {
    const key = `${userId}:${provider}:${accountId}`;
    return this.store instanceof Map ? this.store.get(key) : this.store.get(key);
  }

  async list({ userId, provider }) {
    if (!(this.store instanceof Map)) {
      if (typeof this.store.list !== "function") throw new Error("Persistent connection store must implement list()");
      return this.store.list({ userId, provider });
    }
    return [...this.store.values()].filter((value) => value.userId === userId && (!provider || value.provider === provider));
  }

  async findProviderConnection({ userId, provider }) {
    const matches = await this.list({ userId, provider });
    return matches.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
  }
}

module.exports = { ConnectionRegistry };