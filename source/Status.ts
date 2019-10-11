// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2019 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import { Stateful } from './impl/Hooks'
import { StatusImpl } from './impl/Status-impl'
import { Action } from './Action'

export abstract class Status extends Stateful {
  abstract readonly busy: boolean
  abstract readonly workerCount: number
  abstract readonly workers: ReadonlySet<Action>
  abstract readonly animationFrameCount: number
  abstract readonly busyWrapUpDelay?: number // milliseconds

  abstract enter(action: Action): void
  abstract leave(action: Action): void

  static create(hint?: string, busyWrapUpDelay?: number): Status { return StatusImpl.create(hint, busyWrapUpDelay) }
}
