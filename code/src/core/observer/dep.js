/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 发布订阅
 * 每个发布订阅类都有自己的uid
 * subs存放需要通知的watcher
 * addSub 订阅，把需要通知watchers存入subs中
 * removeSub 移除订阅
 * ???depend
 * notify 遍历通知subs中的watch并执行update方法
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub(sub: Watcher) {
    // 引用类型 indexof 找到数组中当前 所在位置 slice(index，1)去除sub位置
    remove(this.subs, sub)
  }

  depend() {
    if (Dep.target) {
      // 执行watcher addDep
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    // 数组深拷贝
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 升序
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []
// 标记当前的Dep对象
export function pushTarget(target: ?Watcher) {
  // console.log(target)
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
