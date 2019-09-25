// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2017-2019 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import { Dbg, Utils, undef, Record, ICacheResult, F, Snapshot, Hint } from '../internal/all';
import { Trace } from './Reactivity';

export class Transaction {
  static readonly none: Transaction = new Transaction("<none>");
  static readonly init: Transaction = new Transaction("<init>");
  static _current: Transaction;
  static _inspection: boolean = false;

  readonly margin: number;
  private readonly snapshot: Snapshot; // assigned in constructor
  private workers: number;
  private sealed: boolean;
  private error?: Error;
  private retryAfter?: Transaction;
  private resultPromise?: Promise<void>;
  private resultResolve: (value?: void) => void;
  private resultReject: (reason: any) => void;
  private readonly reaction: { tran?: Transaction };
  readonly trace?: Partial<Trace>; // assigned in constructor

  constructor(hint: string, trace?: Partial<Trace>, token?: any) {
    this.margin = Transaction._current ? Transaction._current.margin + 1 : -1;
    this.snapshot = new Snapshot(hint, token);
    this.workers = 0;
    this.sealed = false;
    this.error = undefined;
    this.retryAfter = undefined;
    this.resultPromise = undefined;
    this.resultResolve = undef;
    this.resultReject = undef;
    this.reaction = { tran: undefined };
    this.trace = trace;
  }

  static get current(): Transaction { return Transaction._current; }
  get id(): number { return this.snapshot.id; }
  get hint(): string { return this.snapshot.hint; }

  run<T>(func: F<T>, ...args: any[]): T {
    this.guard();
    return this.do(undefined, func, ...args);
  }

  inspect<T>(func: F<T>, ...args: any[]): T {
    const restore = Transaction._inspection;
    try {
      Transaction._inspection = true;
      if (Dbg.isOn && Dbg.trace.transactions) Dbg.log("", "  ", `transaction T${this.id} (${this.hint}) is being inspected by T${Transaction._current.id} (${Transaction._current.hint})`);
      return this.do(undefined, func, ...args);
    }
    finally {
      Transaction._inspection = restore;
    }
  }

  commit(): void {
    if (this.workers > 0)
      throw new Error("cannot commit transaction having active workers");
    if (this.error)
      throw new Error(`cannot commit transaction that is already canceled: ${this.error}`);
    this.seal(); // commit immediately, because pending === 0
  }

  seal(): this { // t.seal().waitForEnd().then(onfulfilled, onrejected)
    if (!this.sealed)
      this.run(Transaction.seal, this);
    return this;
  }

  bind<T>(func: F<T>, secondary: boolean = false): F<T> {
    this.guard();
    const self = this;
    const inspect = Transaction._inspection;
    const enter = !secondary ? function() { self.workers++; } : function() { /* nop */ };
    const leave = function(...args: any[]): T { self.workers--; return func(...args); };
    !inspect ? self.do(undefined, enter) : self.inspect(enter);
    const Transaction_do: F<T> = (...args: any[]): T => {
      return !inspect ? self.do<T>(undefined, leave, ...args) : self.inspect<T>(leave, ...args);
    };
    return Transaction_do;
  }

  cancel(error: Error, retryAfterOrIgnore?: Transaction | null): this {
    this.do(undefined, Transaction.seal, this, error,
      retryAfterOrIgnore === null ? Transaction.none : retryAfterOrIgnore);
    return this;
  }

  isCanceled(): boolean {
    return this.error !== undefined;
  }

  isFinished(): boolean {
    return this.sealed && this.workers === 0;
  }

  async whenFinished(includingReaction: boolean): Promise<void> {
    if (!this.isFinished())
      await this.acquirePromise();
    if (includingReaction && this.reaction.tran)
      await this.reaction.tran.whenFinished(true);
  }

  undo(): void {
    const hint = Dbg.isOn && Dbg.trace.hints ? `Tran#${this.snapshot.hint}.undo` : /* istanbul ignore next */ "noname";
    Transaction.runAs(hint, false, undefined, undefined,
      Snapshot.undo, this.snapshot);
  }

  static run<T>(hint: string, func: F<T>, ...args: any[]): T {
    return Transaction.runAs(hint, false, undefined, undefined, func, ...args);
  }

  static runAs<T>(hint: string, separate: boolean, trace: Partial<Trace> | undefined, token: any, func: F<T>, ...args: any[]): T {
    const t: Transaction = Transaction.acquire(hint, separate, trace, token);
    const root = t !== Transaction._current;
    t.guard();
    let result: any = t.do<T>(trace, func, ...args);
    if (root) {
      if (result instanceof Promise)
        result = Transaction.outside(() => {
          return t.autoretry(t.postponed(result), func, ...args);
        });
      t.seal();
    }
    return result;
  }

  static outside<T>(func: F<T>, ...args: any[]): T {
    const outer = Transaction._current;
    try {
      Transaction._current = Transaction.none;
      return func(...args);
    }
    finally {
      Transaction._current = outer;
    }
  }

  // Internal

  private static acquire(hint: string, separate: boolean, trace: Partial<Trace> | undefined, token: any): Transaction {
    const spawn = separate || Transaction._current.isFinished();
    return spawn ? new Transaction(hint, trace, token) : Transaction._current;
  }

  private guard(): void {
    if (this.error) // prevent from continuing canceled transaction
      throw this.error;
    if (this.sealed && Transaction._current !== this)
      throw new Error("cannot run transaction that is already sealed");
  }

  private async autoretry<T>(p: Promise<T>, func: F<T>, ...args: any[]): Promise<T> {
    try {
      const result = await p;
      return result;
    }
    catch (error) {
      if (this.retryAfter && this.retryAfter !== Transaction.none) {
        // if (Dbg.trace.transactions) Dbg.log("", "  ", `transaction T${this.id} (${this.hint}) is waiting for restart`);
        await this.retryAfter.whenFinished(true);
        // if (Dbg.trace.transactions) Dbg.log("", "  ", `transaction T${this.id} (${this.hint}) is ready for restart`);
        return Transaction.runAs<T>(this.hint, true, this.trace, this.snapshot.cache, func, ...args);
      }
      else
        throw error;
    }
  }

  private async postponed<T>(p: Promise<T>): Promise<T> {
    const result = await p;
    await this.whenFinished(false);
    return result;
  }

  // Internal

  private do<T>(trace: Partial<Trace> | undefined, func: F<T>, ...args: any[]): T {
    let result: T;
    const outer = Transaction._current;
    try {
      this.workers++;
      Transaction._current = this;
      this.snapshot.acquire(outer.snapshot);
      result = func(...args);
      if (this.sealed && this.workers === 1) {
        if (!this.error)
          this.checkForConflicts(); // merge with concurrent transactions
        else if (!this.retryAfter)
          throw this.error;
      }
    }
    catch (e) {
      if (!Transaction._inspection)
        this.cancel(e);
      throw e;
    }
    finally { // it's critical to have no exceptions in this block
      this.workers--;
      if (this.sealed && this.workers === 0) {
        !this.error ? this.performCommit() : this.performCancel();
        Object.freeze(this);
      }
      if (this.snapshot.triggers.length > 0)
        this.runTriggers();
      Transaction._current = outer;
    }
    return result;
  }

  private runTriggers(): void {
    const name = Dbg.isOn && Dbg.trace.hints ? `   ■   ■   ■   TRIGGERS(${this.snapshot.triggers.length}) after T${this.id} (${this.snapshot.hint})` : /* istanbul ignore next */ "TRIGGERS";
    // Snapshot.headTimestamp++;
    this.reaction.tran = Transaction.runAs(name, true, this.trace, undefined,
      Transaction.doRunTriggers, this.snapshot.triggers);
  }

  private static doRunTriggers(triggers: ICacheResult[]): Transaction {
    const timestamp = Transaction.current.snapshot.timestamp;
    triggers.map(t => t.renew(timestamp, false, false));
    return Transaction.current;
  }

  private static seal(t: Transaction, error?: Error, retryAfter?: Transaction): void {
    if (!t.error && error) {
      t.error = error;
      t.retryAfter = retryAfter;
    }
    t.sealed = true;
  }

  private checkForConflicts(): void {
    const conflicts = this.snapshot.rebase();
    if (conflicts)
      this.tryResolveConflicts(conflicts);
  }

  private tryResolveConflicts(conflicts: Record[]): void {
    this.error = this.error || new Error(`transaction T${this.id} (${this.hint}) conflicts with other transactions on: ${Hint.conflicts(conflicts)}`);
    throw this.error;
  }

  private performCommit(): void {
    this.snapshot.seal();
    Snapshot.applyDependencies(this.snapshot);
    this.snapshot.archive();
    if (this.resultPromise)
      this.resultResolve();
  }

  private performCancel(): void {
    this.snapshot.seal(this.error);
    this.snapshot.archive();
    if (this.resultPromise)
      if (!this.retryAfter)
        this.resultReject(this.error);
      else
        this.resultResolve();
  }

  private acquirePromise(): Promise<void> {
    if (!this.resultPromise) {
      this.resultPromise = new Promise((resolve, reject) => {
        this.resultResolve = resolve;
        this.resultReject = reject;
      });
    }
    return this.resultPromise;
  }

  private static readableSnapshot(): Snapshot {
    return Transaction._current.snapshot;
  }

  private static writableSnapshot(): Snapshot {
    if (Transaction._inspection)
      throw new Error("cannot make changes during inspection");
    return Transaction._current.snapshot;
  }

  static _init(): void {
    Snapshot.readable = Transaction.readableSnapshot; // override
    Snapshot.writable = Transaction.writableSnapshot; // override
    Transaction.none.sealed = true;
    Transaction.none.snapshot.seal();
    Transaction.init.snapshot.acquire(Transaction.init.snapshot);
    Transaction.init.sealed = true;
    Transaction.init.snapshot.seal();
    Transaction._current = Transaction.none;
    const blank = new Record(Record.blank, Transaction.init.snapshot, {});
    blank.prev.record = blank; // loopback
    blank.freeze();
    Utils.freezeMap(blank.observers);
    Utils.freezeMap(blank.replaced);
    Record.blank = blank;
    Snapshot.lastUsedId = 99;
    Snapshot.headTimestamp = 100;
  }
}

Transaction._init();
