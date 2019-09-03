﻿import test from "ava";
import { sleep } from "./common";
import { ReactiveCache, Transaction, ReentrantCall, Trace as T } from "../src/z.index";
import { DemoModel, DemoView, actual } from "./async";

const etalon: string[] = [
  "Url: reactronic",
  "Log: RTA",
  "[...] Url: reactronic",
  "[...] Log: RTA",
  "Url: reactronic",
  "Log: RTA",
  "Url: nezaboodka.com",
  "Log: RTA, nezaboodka.com/500",
];

test("async", async t => {
  T.level = process.env.AVA_DEBUG === undefined ? 6 : /* istanbul ignore next */ 3;
  const app = Transaction.run(() => new DemoView(new DemoModel()));
  app.model.load.rcache.configure({reentrant: ReentrantCall.ExitWithError});
  try {
    t.throws(() => { app.test = "testing @stateful for fields"; });
    await app.print(); // trigger first run
    const list: Array<{ url: string, delay: number }> = [
      { url: "nezaboodka.com", delay: 500 },
      { url: "google.com", delay: 300 },
      { url: "microsoft.com", delay: 200 },
    ];
    const first = app.model.load(list[0].url, list[0].delay);
    t.throws(() => { list.slice(1).map(x => app.model.load(x.url, x.delay)); });
    await first;
  }
  catch (error) { /* istanbul ignore next */
    actual.push(error.toString()); /* istanbul ignore next */
    if (T.level >= 1 && T.level <= 5) console.log(error.toString());
  }
  finally {
    await sleep(400);
    await ReactiveCache.unmount(app, app.model).whenFinished(true);
  } /* istanbul ignore next */
  if (T.level >= 1 && T.level <= 5)
    for (const x of actual)
      console.log(x);
  const n: number = Math.max(actual.length, etalon.length);
  for (let i = 0; i < n; i++) { /* istanbul ignore next */
    if (T.level >= 1 && T.level <= 5) console.log(`actual[${i}] = ${actual[i]}, etalon[${i}] = ${etalon[i]}`);
    t.is(actual[i], etalon[i]);
  }
});
