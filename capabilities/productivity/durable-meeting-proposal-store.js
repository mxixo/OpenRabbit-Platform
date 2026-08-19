"use strict";

const fs = require("fs");
const path = require("path");

class DurableMeetingProposalStore {
  constructor({ filePath } = {}) {
    if (!filePath) throw new Error("filePath is required");
    this.filePath = path.resolve(filePath);
    this.ensureFile();
  }

  ensureFile() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, JSON.stringify({ version: 1, items: [] }, null, 2));
  }

  readState() {
    this.ensureFile();
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) throw new Error("Meeting proposal store is invalid");
    return parsed;
  }

  writeState(state) {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, this.filePath);
  }

  save(item) {
    const state = this.readState();
    const index = state.items.findIndex((candidate) => candidate.id === item.id);
    const copy = structuredClone(item);
    if (index >= 0) state.items[index] = copy;
    else state.items.push(copy);
    this.writeState(state);
    return structuredClone(copy);
  }

  get(id) {
    const item = this.readState().items.find((candidate) => candidate.id === id);
    return item ? structuredClone(item) : null;
  }

  list() {
    return this.readState().items.map((item) => structuredClone(item));
  }
}

module.exports = { DurableMeetingProposalStore };
