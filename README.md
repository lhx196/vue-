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
入口文件
```javascript
// 在script config中有打包入口
'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
```
## 初始化init 过程
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

## $mount代码位置及执行过程
- 代码位置
  在入口文件处执行import Vue from './runtime/index'<br>
  在runtime index中，赋值一个执行mountComponent高阶函数（mountComponent后续会提到执行过程）
  ```javascript
  Vue.prototype.$mount = function (
    el?: string | Element,
    hydrating?: boolean
  ): Component {
    el = el && inBrowser ? query(el) : undefined
    return mountComponent(this, el, hydrating)
}
  ```
  回到entry-runtime-with-compiler.js文件， 在vue引入后，此时的vue中$mount过载了一个返回值是mountComponent调用的高阶函数<br>
  
  ```javascript
  const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // el 通过传入的options 获取el的dom节点
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    // 获取template渲染模板
    // 如果属性有设置 则获取属性的，否则获取id dom节点outerhtml
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        // 改变文本插入分隔符
        delimiters: options.delimiters,
        // 为true时，保留且渲染模板中的html注释，默认为false
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}
  ```
  此时把之前挂载的mountComponent调用的高阶函数先存储到mount中，在重新挂载$monut，在新$mount执行的最后，去调用mount<br>
  这样的写法，个人目前觉得目的是可以做到模块化，因为mountComponent中含有数据观察者Wacher类的创建，这是属于vue响应式原理的核心代码部分，因此这部分放到core目录下中比较合适
- 执行过程
  首先会根据options中传入的el，通过query(el)来获取渲染模板dom节点<br>
  然后会判断options中是否有配置render函数或者template模板属性<br>
  如果都没有的情况改下，就会通过dom操作，获取outerHTML，设置为模板字符串template，随后调用compileToFunctions
  ```javascript
  const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        // 改变文本插入分隔符
        delimiters: options.delimiters,
        // 为true时，保留且渲染模板中的html注释，默认为false
        comments: options.comments
      }, this)
  ```

### compileToFunctions
```javascript
  // src/complier/createCompiler
  const { compile, compileToFunctions } = createCompiler(baseOptions)
```
实际上 compileToFunctions 相当于是一个含有baseCompile闭包的函数,通过调用baseCompile 生成compile(即ast、render、staticRenderFns集合)<br>

### baseCompile 过程
baseCompile其实主要分为两个过程:parse、generate

### parse
parse实际的执行过程主要是围绕parseHtml这个api去执行<br>
parsehtml实际执行是循环遍历html模板字符串，通过advance api来记录循环过程中模板字符串下标，确保不重复处理已经读取过的部分，在循环过程中有一下判断:<br>
1、确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)<BR>
2、匹配当前剩余模板字符串(每次匹配过后都会通过advance api进行截取，避免重复处理)，按照下方情况去判断<BR>
以\<为第一个字符串处理方法:
- \<!-- 、\<!DOCTYPE html> 、条件注释:\<!-- [if !IE] -->等开头分别进行处理去处理

-  按照正则去匹配开头标签，解析标签对，前半部分，在解析过程中，收集开头标签中的属性绑定及事件绑定的信息，最后再把标签头入栈(其中包含了对单标签的处理)

-  按照正则去匹配结束标签，随后在栈中寻找相对应开头标签，匹配成功后让该开头标签出栈

当存在\<但不为为第一个字符串处理方法:
- <前的所以字符串为文本，若后续还有<字符串，则判断是否为开头、结束标签之类的，如排除后，确定<为文本中的一个字符

当不以<开头，则为文本字符串处理。<br>
3、根据上述判断方式去执行对应的钩子函数，开始标签 -- options.starts，结束标签 -- options.end，文本标签执行chars
```text
钩子很函数的执行过程
  start：
    1、通过createASTElement(tag, attrs, currentParent)方法将标签转化成ast对象，tag：标签名，attrs：属性、事件绑定及指令，currentParent：当前父元素的AST对象(后续提及)
    2、processPre、processFor、processIf、processOnce分别处理pre if once for指令。对标签ast做以下处理：
         * 对标签节点，attrsMap依次做判断，判断 if for once是否含有
         * 对v-for v-if v-once 从attrsList移除
         * 给ast节点添加 el.if el.for el.once属性
         * if 再额外添加ifcondition
         * for 再额外执行parseFor
    3、判断是否单标签：
         * 如果是单标签，则直接执行closeElement(后续分析)
         * 如果不是，则入栈
  end:
    1、出栈，执行如果是单标签，则直接执行closeElement
  chars:
    1、判断是否为空字符串
    2、将text文本转换成ast语法对象，塞入父元素children中，并新增其中的{{}}语法舒心标记expression、token
```
```text
closeElement:

```



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

## parse-html要点
```text
 在解析标签过程中 使用到入栈思路:
 1、在解析过程中首先会剔除单标签
 2、剩余标签都是配对存在的，遵循先进后出的规则
 3、在匹配到符合开始标签时，就会把该标签压入栈中
 4、遇到结束标签时，从依次往里检索，匹配到就出栈
```

### 参考文献
- vue.js技术揭秘[https://ustbhuangyi.github.io/vue-analysis]
- Vue原理解析之observer模块[https://segmentfault.com/a/1190000008377887]
- Vue中文社区[https://vue-js.com/learn-vue/start/]

