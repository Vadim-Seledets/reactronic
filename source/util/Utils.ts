// The below copyright notice and the license permission notice
// shall be included in all copies or substantial portions.
// Copyright (C) 2016-2020 Yury Chetyrko <ychetyrko@gmail.com>
// License: https://raw.githubusercontent.com/nezaboodka/reactronic/master/LICENSE

export type F<T> = (...args: any[]) => T

export class Utils {
  static get<T>(obj: any, sym: symbol): T {
    return obj[sym]
  }

  static set(obj: any, sym: symbol, value: any): any {
    Object.defineProperty(obj, sym, { value, configurable: false, enumerable: false })
    return obj
  }

  static freezeSet<T>(obj?: Set<T>): void {
    if (obj instanceof Set) {
      const pd = { configurable: false, enumerable: false, get: undef, set: undef }
      Object.defineProperty(obj, 'add', pd)
      Object.defineProperty(obj, 'delete', pd)
      Object.defineProperty(obj, 'clear', pd)
      Object.freeze(obj)
    }
  }

  static freezeMap<K, V>(obj?: Map<K, V>): void {
    if (obj instanceof Map) {
      const pd = { configurable: false, enumerable: false, get: undef, set: undef }
      Object.defineProperty(obj, 'set', pd)
      Object.defineProperty(obj, 'delete', pd)
      Object.defineProperty(obj, 'clear', pd)
      Object.freeze(obj)
    }
  }

  static copyAllMembers(source: any, target: any): any {
    for (const m of Object.getOwnPropertyNames(source))
      target[m] = source[m]
    for (const m of Object.getOwnPropertySymbols(source))
      target[m] = source[m]
    return target
  }

  // static clone(obj: any): any {
  //   const cloned = Object.create(Object.getPrototypeOf(obj))
  //   const descriptors = Object.getOwnPropertyDescriptors(obj)
  //   Object.defineProperties(cloned, descriptors)
  //   return cloned
  // }

  // static copyAllMembers(source: any, target: any): void {
  //   const descriptors = Object.getOwnPropertyDescriptors(source)
  //   Object.defineProperties(target, descriptors)
  // }
}

/* istanbul ignore next */
export function undef(...args: any[]): never {
  throw new Error('this method should never be called')
}

/* istanbul ignore next */
export async function all(promises: Array<Promise<any>>): Promise<any[]> {
  let error: any
  const result = await Promise.all(promises.map(x => x.catch(e => { error = error || e; return e })))
  if (error)
    throw error
  return result
}

/* istanbul ignore next */
export function sleep<T>(timeout: number): Promise<T> {
  return new Promise(function(resolve: any): void {
    setTimeout(resolve.bind(null, () => resolve), timeout)
  })
}
