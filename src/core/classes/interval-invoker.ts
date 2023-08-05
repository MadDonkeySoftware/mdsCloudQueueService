import { BaseLogger } from 'pino';

export class IntervalInvoker {
  #pollInterval: number;
  #logger: BaseLogger;
  #callback: () => Promise<void>;
  #handle: NodeJS.Timeout | null;
  #running: boolean;

  constructor({
    pollInterval,
    logger,
    callback,
  }: {
    pollInterval: number;
    logger: BaseLogger;
    callback: () => Promise<void>;
  }) {
    this.#pollInterval = pollInterval;
    this.#logger = logger;
    this.#callback = callback;

    this.#handle = null;
    this.#running = false;
  }

  startMonitor() {
    this.#handle = setTimeout(this.#tick.bind(this), this.#pollInterval);
    this.#running = true;
  }

  stopMonitor() {
    this.#running = false;
    clearTimeout(this.#handle!);
  }

  async #tick() {
    clearTimeout(this.#handle!);

    try {
      await this.#callback();
    } catch (err) {
      this.#logger.error({ err }, 'Error invoking resources');
    }

    // NOTE: Ignoring this block because of troubles with jest timers and async/await
    /* istanbul ignore next */
    if (this.#running) {
      this.#handle = setTimeout(this.#tick.bind(this), this.#pollInterval);
    }
  }
}
