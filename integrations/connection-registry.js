"use strict";

const crypto = require("crypto");

class ConnectionRegistry {
  constructor({ store }) {
    this.store = store || new Map();
    this.oauthStates = new Map();
  }

  createOAuthState({ provider, userId, redirectTo = "/" }) {
    const state = crypto.randomBytes(24).toString("hex");
    this.oauthStates.set(state, {
      provider,
      userId,
      redirectTo,
      createdAt: Date.now(),
    });
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
    const key = `${userId}:${provider}:${accountId || "default"}`;
    const value = { userId, provider, accountId, accessToken, refreshToken, expiresAt, scopes, updatedAt: new Date().toISOString() };
    if (this.store instanceof Map) this.store.set(key, value);
    else await this.store.set(key, value);
    return { key, provider, accountId, scopes, expiresAt };
  }

  async get({ userId, provider, accountId = "default" }) {
    const key = `${userId}:${provider}:${accountId}`;
    return this.store instanceof Map ? this.store.get(key) : this.store.get(key);
  }
}

module.exports = { ConnectionRegistry };