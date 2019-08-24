import { Monitor } from "./Monitor";

export interface Config {
  readonly mode: Mode;
  readonly latency: Latency;
  readonly isolation: Isolation;
  readonly asyncCalls: AsyncCalls;
  readonly monitor: Monitor | null;
  readonly tracing: number;
}

export enum Mode {
  Stateless = -1,
  Stateful = 0, // default
  InternalStateful = 1,
}

export type Latency = number | Renew; // milliseconds

export enum Renew {
  Immediately = -1,
  WhenReady = -2,
  OnDemand = -3, // default for cache
  Manually = -4,
  DoesNotCache = -5, // default for transaction
}

export enum Isolation {
  Default = 0, // prolonged for transactions, but consolidated standalone for reaction
  ProlongedTransaction = 1,
  SeparateTransaction = 2,
}

export enum AsyncCalls {
  Prevent = 1, // only one can run at a time (default)
  Restart = 0, // reuse existing (if any)
  Relay = -1, // cancel existing in favor of newer one
  Allow = -2,
}
