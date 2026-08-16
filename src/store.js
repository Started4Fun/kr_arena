import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY_STATE = { players: [] };

export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = structuredClone(EMPTY_STATE);
    this.writePromise = Promise.resolve();
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = {
        players: Array.isArray(parsed.players) ? parsed.players : [],
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
    return this.state;
  }

  listPlayers() {
    return [...this.state.players];
  }

  findPlayer(gameName, tagLine) {
    const key = playerKey(gameName, tagLine);
    return this.state.players.find((player) => player.key === key) ?? null;
  }

  async addPlayer({ gameName, tagLine, label = null, puuid = null }) {
    const normalizedTagLine = normalizeTagLine(tagLine);
    const key = playerKey(gameName, normalizedTagLine);
    const existing = this.state.players.find((player) => player.key === key);
    if (existing) {
      existing.label = label || existing.label;
      existing.puuid = puuid || existing.puuid;
      await this.save();
      return { player: existing, created: false };
    }

    const player = {
      key,
      gameName,
      tagLine: normalizedTagLine,
      label,
      puuid,
      addedAt: new Date().toISOString(),
    };
    this.state.players.push(player);
    await this.save();
    return { player, created: true };
  }

  async removePlayer(gameName, tagLine) {
    const key = playerKey(gameName, tagLine);
    const before = this.state.players.length;
    this.state.players = this.state.players.filter((player) => player.key !== key);
    if (this.state.players.length !== before) await this.save();
    return before !== this.state.players.length;
  }

  async save() {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    this.writePromise = this.writePromise.then(async () => {
      await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.writePromise;
  }
}

export function playerKey(gameName, tagLine) {
  return `${gameName.trim().toLocaleLowerCase('en-US')}#${normalizeTagLine(tagLine).toLocaleLowerCase('en-US')}`;
}

export function normalizeTagLine(tagLine) {
  return tagLine.trim().replace(/^#+/, '');
}
