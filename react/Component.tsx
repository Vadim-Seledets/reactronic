// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2020 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

import * as React from 'react'
import { trigger, cached, isolated, Cache } from 'reactronic'

export class Component<P> extends React.Component<P> {
  @cached
  render(): JSX.Element {
    throw new Error('render method is undefined')
  }

  @trigger
  pulse(): void {
    if (this.shouldComponentUpdate())
      isolated(() => this.setState({}))
  }

  shouldComponentUpdate(): boolean {
    return Cache.of(this.render).invalid
  }

  componentDidMount(): void {
    this.pulse()
  }

  componentWillUnmount(): void {
    isolated(Cache.unmount, this)
  }
}
