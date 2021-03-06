// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2020 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import { Stateful } from './impl/Hooks'
import { MonitorImpl } from './impl/MonitorImpl'

export abstract class Monitor extends Stateful {
  abstract readonly isActive: boolean
  abstract readonly workerCount: number
  abstract readonly workers: ReadonlySet<Worker>

  static create(hint?: string, delayBeforeIdle?: number): Monitor { return MonitorImpl.create(hint, delayBeforeIdle) }
}

export interface Worker {
  readonly id: number
  readonly hint: string
  readonly isCanceled: boolean
  readonly isFinished: boolean
  cancel(error: Error, restartAfter?: Worker | null): this
  whenFinished(): Promise<void>
}
