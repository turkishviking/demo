import { Client } from 'pg';
import { OUTBOX_CHANNEL } from './outbox-event-publisher';
import type { OutboxRelay, RelayLogger } from './outbox-relay';

/**
 * Fait tourner le relais : réveil immédiat sur `NOTIFY outbox_events`, plus un polling de
 * secours (retries en backoff, notifications perdues). Un seul cycle à la fois.
 */
export class OutboxRelayRunner {
  private listener: Client | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private rerunRequested = false;
  private stopped = true;

  constructor(
    private readonly relay: OutboxRelay,
    private readonly databaseUrl: string,
    private readonly pollIntervalMs: number,
    private readonly logger?: RelayLogger,
  ) {}

  async start(): Promise<void> {
    if (!this.stopped) return;
    this.stopped = false;

    this.listener = new Client({ connectionString: this.databaseUrl });
    this.listener.on('notification', () => this.trigger());
    this.listener.on('error', (error) =>
      this.logger?.error('Outbox listener connection error', { error: error.message }),
    );
    await this.listener.connect();
    await this.listener.query(`LISTEN ${OUTBOX_CHANNEL}`);

    this.timer = setInterval(() => this.trigger(), this.pollIntervalMs);
    this.trigger();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
    await this.listener?.end().catch(() => undefined);
    this.listener = undefined;
  }

  /** Demande un cycle ; s'il en tourne déjà un, un nouveau cycle suivra. */
  trigger(): void {
    if (this.stopped) return;
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = this.cycle().finally(() => {
      this.running = undefined;
      if (this.rerunRequested && !this.stopped) {
        this.rerunRequested = false;
        this.trigger();
      }
    });
  }

  private async cycle(): Promise<void> {
    try {
      await this.relay.drain();
    } catch (error) {
      this.logger?.error('Outbox relay cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
