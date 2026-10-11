/**
 * src/multitask/worker.ts — WorkerHandle, the lifecycle of one pane.
 */

import { callEnvelope, env_writeChars, env_paste, env_sendKeys, env_closePane, env_dumpScreen, env_listPanes } from "../protocol/envelopes.ts";
import { runZellijStreaming } from "../transport/cli.ts";
import type { SubscribeEventT } from "../transport/types.ts";
import type { PaneId, SessionName, ZjToolContext } from "../types.ts";

export interface WorkerInit {
  session: SessionName;
  paneId: PaneId;
  command: string;
  spawnedAt: number;
}

export class WorkerHandle {
  readonly session: SessionName;
  readonly paneId: PaneId;
  readonly command: string;
  readonly spawnedAt: number;

  constructor(init: WorkerInit) {
    this.session = init.session ?? "";
    this.paneId = init.paneId;
    this.command = init.command;
    this.spawnedAt = init.spawnedAt;
  }

  async write(text: string, _ctx?: ZjToolContext): Promise<void> {
    await callEnvelope(env_writeChars, { paneId: this.paneId, chars: text }, this.session);
  }

  async paste(text: string, _ctx?: ZjToolContext): Promise<void> {
    await callEnvelope(env_paste, { paneId: this.paneId, text }, this.session);
  }

  async sendKeys(keys: string[], _ctx?: ZjToolContext): Promise<void> {
    await callEnvelope(env_sendKeys, { paneId: this.paneId, keys }, this.session);
  }

  async read(opts: { full?: boolean } = {}, _ctx?: ZjToolContext): Promise<string> {
    return await callEnvelope(env_dumpScreen, { paneId: this.paneId, ...(opts.full ? { full: true } : {}) }, this.session);
  }

  async subscribe(opts: { scrollback?: number | boolean; ansi?: boolean } = {}, signal?: AbortSignal): Promise<AsyncIterable<SubscribeEventT>> {
    const args: string[] = [];
    if (this.session) args.push("--session", this.session);
    args.push("subscribe", "--format", "json", "--pane-id", String(this.paneId));
    if (opts.scrollback !== undefined) {
      args.push("--scrollback");
      if (typeof opts.scrollback === "number") args.push(String(opts.scrollback));
    }
    if (opts.ansi) args.push("--ansi");
    return (async function* () {
      for await (const ev of runZellijStreaming(args, {}, signal)) {
        yield ev as SubscribeEventT;
      }
    })();
  }

  async waitExit(opts: { timeoutMs?: number; pollMs?: number } = {}, ctx?: ZjToolContext): Promise<{ exitStatus: number | null; durationMs: number }> {
    const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
    const pollMs = opts.pollMs ?? 250;
    const started = Date.now();
    const deadline = started + timeoutMs;
    let lastSeen: { exited: boolean; exit_status: number | null } | null = null;
    while (Date.now() < deadline) {
      if (ctx?.signal?.aborted) break;
      const r = await callEnvelope(env_listPanes, {}, this.session);
      const panes = r as Array<{ id: number | string; exited: boolean; exit_status: number | null }>;
      const target = panes.find((p) => String(p.id) === String(this.paneId));
      if (!target) {
        return { exitStatus: lastSeen?.exit_status ?? null, durationMs: Date.now() - started };
      }
      lastSeen = target;
      if (target.exited) {
        return { exitStatus: target.exit_status, durationMs: Date.now() - started };
      }
      await new Promise((res) => setTimeout(res, pollMs));
    }
    return { exitStatus: lastSeen?.exit_status ?? null, durationMs: Date.now() - started };
  }

  async close(_ctx?: ZjToolContext): Promise<void> {
    await callEnvelope(env_closePane, { paneId: this.paneId }, this.session);
  }

  toJSON(): WorkerInit {
    return { session: this.session, paneId: this.paneId, command: this.command, spawnedAt: this.spawnedAt };
  }

  static fromJSON(init: WorkerInit): WorkerHandle {
    return new WorkerHandle(init);
  }
}
