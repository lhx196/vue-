# vue源码阅读笔记

- 目录

```text
code：源码仓库
    src
        ├── compiler        # 编译相关 
        ├── core            # 核心代码 
        ├── platforms       # 不同平台的支持
        ├── server          # 服务端渲染
        ├── sfc             # .vue 文件解析
        ├── shared          # 共享代码
```
## 初始化时生命周期
 - 合并option(mergeOptions合并Vue构造函数的option 与 new Vue过程中option配置项)
 - initLifecycle 初始化生命周期函数
 - initEvents 创建事件对象???父元素传递的自定义事件(暂未深入)
 - initRender 创建渲染函数(挂载createElement函数)
 - callHook(vm, 'beforeCreate') 执行beforeCreate钩子函数
 - initInjections 暂未深入
 - initState 初始化 props、methods、data、computed、watch
 - initProvide 暂未深入
 - callHook(vm, 'created') 执行created钩子函数
 - vm.$mount执行<br>
初始化完成

## observer模块

observer模块在Vue项目中的代码位置是src/core/observer，模块共分为这几个部分：

- Observer: 数据被观察者，将数据赋予访问器属性，观察自身的变化并通知Dep

- Watcher: 数据观察者，数据的变化会通知到Watcher，然后由Watcher进行相应的操作，例如更新视图

- Dep: Observer与Watcher的纽带，当数据变化时，会被Observer观察到，然后由Dep通知到Watcher

### Observer

Observer类定义在src/core/observer/index.js中

```javascript
constructor (value: any) {
  this.value = value
  this.dep = new Dep()
  this.vmCount = 0
  def(value, '__ob__', this)
  if (Array.isArray(value)) {
      const augment = hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}
```
value是需要被观察的数据对象，在构造函数中，会给value增加__ob__属性，作为数据已经被Observer观察的标志。如果value是数组，就使用observeArray遍历value，对value中每一个元素调用observe分别进行观察。如果value是对象，则使用walk遍历value上每个key，对每个key调用defineReactive来获得该key的set/get控制权。<br>

解释下上面用到的几个函数的功能：

- observeArray: 遍历数组，对数组的每个元素调用observe

- observe: 检查对象上是否有__ob__属性，如果存在，则表明该对象已经处于Observer的观察中，如果不存在，则new Observer来观察对象（其实还有一些判断逻辑，为了便于理解就不赘述了）

- walk: 遍历对象的每个key，对对象上每个key的数据调用defineReactive

- defineReactive: 通过Object.defineProperty设置对象的key属性，使得能够捕获到该属性值的set/get动作。一般是由Watcher的实例对象进行get操作，此时Watcher的实例对象将被自动添加到Dep实例的依赖数组中，在外部操作触发了set时，将通过Dep实例的notify来通知所有依赖的watcher进行更新。

### Dep
Dep是Observer与Watcher之间的纽带，也可以认为Dep是服务于Observer的订阅系统。Watcher订阅某个Observer的Dep，当Observer观察的数据发生变化时，通过Dep通知各个已经订阅的Watcher。<br>

Dep提供了几个接口：

- addSub: 接收的参数为Watcher实例，并把Watcher实例存入记录依赖的数组中

- removeSub: 与addSub对应，作用是将Watcher实例从记录依赖的数组中移除

- depend: Dep.target上存放这当前需要操作的Watcher实例，调用depend会调用该Watcher实例的addDep方法

- notify: 通知依赖数组中所有的watcher进行更新操作

### Watcher

Watcher是用来订阅数据的变化的并执行相应操作（例如更新视图）的：
```javascript
 this.vm = vm
  vm._watchers.push(this)
  // options
  if (options) {
    this.deep = !!options.deep
    this.user = !!options.user
    this.lazy = !!options.lazy
    this.sync = !!options.sync
  } else {
    this.deep = this.user = this.lazy = this.sync = false
  }
  this.cb = cb
  this.id = ++uid // uid for batching
  this.active = true
  this.dirty = this.lazy // for lazy watchers
  this.deps = []
  this.newDeps = []
  this.depIds = new Set()
  this.newDepIds = new Set()
  this.expression = process.env.NODE_ENV !== 'production'
    ? expOrFn.toString()
    : ''
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn
  } else {
    this.getter = parsePath(expOrFn)
    if (!this.getter) {
      this.getter = function () {}
      process.env.NODE_ENV !== 'production' && warn(
        `Failed watching path: "${expOrFn}" ` +
        'Watcher only accepts simple dot-delimited paths. ' +
        'For full control, use a function instead.',
        vm
      )
    }
  }
  this.value = this.lazy
    ? undefined
    : this.get()
}
```
参数中，vm表示组件实例，expOrFn表示要订阅的数据字段（字符串表示，例如a.b.c）或是一个要执行的函数，cb表示watcher运行后的回调函数，options是选项对象，包含deep、user、lazy等配置。<br>

watcher实例上有这些方法：

- get: 将Dep.target设置为当前watcher实例，在内部调用this.getter，如果此时某个被Observer观察的数据对象被取值了，那么当前watcher实例将会自动订阅数据对象的Dep实例

- addDep: 接收参数dep(Dep实例)，让当前watcher订阅dep

- cleanupDeps: 清除newDepIds和newDep上记录的对dep的订阅信息

- update: 立刻运行watcher或者将watcher加入队列中等待统一flush

- run: 运行watcher，调用this.get()求值，然后触发回调

- evaluate: 调用this.get()求值

- depend: 遍历this.deps，让当前watcher实例订阅所有dep

- teardown: 去除当前watcher实例所有的订阅

## initState过程

- initData
```text
    1、获取options中配置的data属性(对象或者函数)，通过调用observe(data)方法创建
    2、observe方法内部主要包含new Observer() 创建数据被观察者类

    
```

### 参考文献
- vue.js技术揭秘[https://ustbhuangyi.github.io/vue-analysis]
- Vue原理解析之observer模块[https://segmentfault.com/a/1190000008377887]

