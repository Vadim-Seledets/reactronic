// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2019 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import { F } from './util/all'
import { Trace } from './Options'
import { Transaction } from './core/Transaction'

export abstract class Action {
  abstract readonly id: number;
  abstract readonly hint: string;

  abstract run<T>(func: F<T>, ...args: any[]): T;
  abstract inspect<T>(func: F<T>, ...args: any[]): T;
  abstract apply(): void;
  abstract seal(): this;
  abstract bind<T>(func: F<T>, secondary: boolean): F<T>;
  abstract cancel(error: Error, retryAfterOrIgnore?: Action | null): this;
  abstract isCanceled(): boolean;
  abstract isFinished(): boolean;
  abstract async whenFinished(includingReaction: boolean): Promise<void>;

  static get current(): Action { return Transaction.current }
  static create(hint: string): Action { return new Transaction(hint) }
  static run<T>(hint: string, func: F<T>, ...args: any[]): T { return Transaction.run<T>(hint, func, ...args) }
  static runEx<T>(hint: string, spawn: boolean, sidebyside: boolean, trace: Partial<Trace> | undefined, token: any, func: F<T>, ...args: any[]): T { return Transaction.runEx<T>(hint, spawn, sidebyside, trace, token, func, ...args) }
  static outside<T>(func: F<T>, ...args: any[]): T { return Transaction.outside<T>(func, ...args) }
}