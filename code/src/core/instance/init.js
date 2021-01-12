/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
// 
export function initMixin(Vue: Class<Component>) {
  // new Vue 实际上就是_init方法执行
  Vue.prototype._init = function (options?: Object) {
    // new Vue时调用 this指向vue实例
    const vm: Component = this
    // a uid
    // ??? uid递增? new Vue多次 导致init多次执行?
    // 给每个vue实例分配一个自增的uid
    vm._uid = uid++
    let startTag, endTag
  /* istanbul ignore if */
    
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      /**
       * performance.mark() 浏览器同坐自定义键值记录某一时刻到记录时间的描述 用于求个时间记录的时间差
       * 用于确认初始化时间？
       */
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // ???
    vm._isVue = true

    // merge options

    // ???暂未知_isComponent设置方式
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {

      // vm.constructor : 指向vue构造函数 
      // 合并$option constructor构造函数属性option newVue传进来的option,实例化对象的属性合并
      //  Vue 构造函数的 options 和用户传入的 options 做一层合并，到 vm.$options 上
      vm.$options = mergeOptions(
        // 返回function Vue .option属性 ???猜错是全局注入Vue时加了option配置项
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
      // console.log(vm.$options )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // ???生产环境下接入代码覆盖率工具
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    /**
     * initLifecycle 初始化 watch 当前组件状态等参数
     *  vm._watcher = null
        vm._inactive = null
        vm._directInactive = false
        vm._isMounted = false
        vm._isDestroyed = false
        vm._isBeingDestroyed = false
     */
    initLifecycle(vm)
    /**
     * vm创建_event对象
     * vm._events = Object.create(null)
       vm._hasHookEvent = false
     */
    initEvents(vm)
    /**
     * 初始化render渲染函数
     *   vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
     *  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
     */
    initRender(vm)
    // 执行beforeCreate钩子函数
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    /**
     * 初始化 props、methods、data、computed、watch
     */
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    // 执行created钩子函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
  // console.log(Ctor)
  // ???暂未找到option配置写在哪里
  let options = Ctor.options
  // console.log(options)
  // 构造函数option
  // 如果有父类继承的情况
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 返回构造函数的option
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
