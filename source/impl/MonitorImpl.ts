// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2019 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import { misuse } from '../util/Dbg'
import { Hints } from './Snapshot'
import { Transaction } from './Transaction'
import { Monitor, Worker } from '../Monitor'

export class MonitorImpl extends Monitor {
  busy: boolean = false
  workerCount: number = 0
  workers = new Set<Worker>()
  animationFrameCount: number = 0
  delayBeforeIdle?: number = undefined // milliseconds
  private timeout: any = undefined

  enter(worker: Worker): void {
    this.timeout = clear(this.timeout) // yes, on each enter
    if (this.workerCount === 0)
      this.busy = true
    this.workerCount++
    this.workers.add(worker)
  }

  leave(worker: Worker): void {
    this.workers.delete(worker)
    this.workerCount--
    if (this.workerCount === 0)
      this.idle(false)
  }

  private idle(now: boolean): void {
    if (now || this.delayBeforeIdle === undefined) {
      if (this.workerCount > 0 || this.workers.size > 0) /* istanbul ignore next */
        throw misuse('cannot reset monitor having active workers')
      this.busy = false
      this.timeout = clear(this.timeout)
      this.animationFrameCount = 0
    }
    else
      this.timeout = setTimeout(() =>
        Transaction.runEx<void>('Monitor.idle', true, false,
          undefined, undefined, MonitorImpl.idle, this, true), this.delayBeforeIdle)
  }

  static create(hint?: string, prolonged?: number): MonitorImpl {
    return Transaction.run('Monitor.create', MonitorImpl.doCreate, hint, prolonged)
  }

  private static doCreate(hint?: string, delayBeforeIdle?: number): MonitorImpl {
    const m = new MonitorImpl()
    Hints.setHint(m, hint)
    m.delayBeforeIdle = delayBeforeIdle
    return m
  }

  static enter(mon: Monitor, worker: Worker): void {
    mon.enter(worker)
  }

  static leave(mon: Monitor, worker: Worker): void {
    mon.leave(worker)
  }

  static idle(mon: MonitorImpl, now: boolean): void {
    mon.idle(now)
  }
}

function clear(timeout: any): undefined {
  clearTimeout(timeout)
  return undefined
}
