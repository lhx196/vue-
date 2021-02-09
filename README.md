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

// VUE核心代码是经过下方处理的
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)
```
## web/entry-runtime-with-compiler.js
  1、import Vue from './runtime/index'，引入Vue构造函数，Vue构造函数在runtime文件中复制了$mount，runtime中import Vue from 'core/index'表示vue核心代码再core/index中<br>
  2、entry-runtime-with-compiler中会把runtime的赋值的$mount抽离出来，并在原先$mount执行前添加两步逻辑，一是根据dom操作或者模板字符串，二是用模板字符串获取渲染函数render及静态跟渲染函数数组(此时的渲染函数已经经过new Function生成anonymous function(匿名函数),下方会提及生成过程)<br>

# 初始化init 过程
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
  // runtime/index
  Vue.prototype.$mount = function (
    el?: string | Element,
    hydrating?: boolean
  ): Component {
    el = el && inBrowser ? query(el) : undefined
    return mountComponent(this, el, hydrating)
  }
  ```
  在 entry-runtime-with-compiler 中mountComponent执行前添加了两步逻辑,下方会详细提及<br>
  ```javascript
  // entry-runtime-with-compiler
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
  render - ast渲染函数；staticRenderFns - 静态跟节点渲染函数数组集合<br>
  此时this.$options上已经挂载了render、staticRenderFns<br>
  执行mountComponent逻辑<br>

### compileToFunctions
```javascript
  // src/complier/createCompiler
  // 此处的createCompiler是经过重写的：原函数为baseCompile 经过多次重写
  // 在重写compileToFunctions过程中添加了delimiters属性的判断，若果没有则已key为template模板字符串存储render及staticRenderFns
  const { compile, compileToFunctions } = createCompiler(baseOptions)
```
实际上 compileToFunctions 相当于是一个含有baseCompile闭包的函数,通过调用baseCompile 生成compile(即ast、render、staticRenderFns集合)<br>

compile:ast - ast语法树对象,render - ast转换后的可执行代码字符串，staticRenderFns - 静态根可执行代码字符串数组集合<br>

### baseCompile 过程(此处是未经重写前的createCompiler)
baseCompile其实主要分为两个过程:parse、optimize、generate
- 一、parse主要作用是将模板字符串转化为只有一个根节点的ast语法对象:<br>
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
  1、通过trimEndingWhitespace 去除节点 children 末尾的空格文本节点
  2、processElement处理元素标签：
    - processKey：获取标签上的key属性，并赋值到element.key上
    - processRef：获取标签上的ref属性，并赋值到element.ref上
    - processSlotContent：处理slot属性逻辑
    - processSlotOutlet：处理<slot>标签
    - processComponent：
       * 判断属性是否含有inline-template、is
       * is -- 对应添加ast中componet
       * inline-template -- 对应添加ast中inlineTemplate
    - processAttrs：
       * 对于ast attributes处理(v-on/@) 
       * 利用onRE与dirRE来捕获事件
       * 在对标签属性的处理过程中，判断如果是指令，首先通过 parseModifiers 解析出修饰符，然后判断如果事件的指令，则执行 addHandler(el, name, value, modifiers, false, warn)
       * addHandler 函数看起来长，实际上就做了 3 件事情，首先根据 modifier 修饰符对事件名 name 做处理，接着根据 modifier.native 判断是一个纯原生事件还是普通事件，分别对应 el.nativeEvents 和 el.events，最后按照 name 对事件做归类，并把回调函数的字符串保留到对应的事件中。
```

- 二、optimize主要作用是优化ast语法树：markStatic(root) 标记静态节点 ，markStaticRoots(root, false) 标记静态根。
```text
Vue 是数据驱动，是响应式的，但是我们的模板并不是所有数据都是响应式的，也有很多数据是首次渲染后就永远不会变化的，那么这部分数据生成的 DOM 也不会变化，我们可以在 patch 的过程跳过对他们的比对。

isStatic 是对一个 AST 元素节点是否是静态的判断，如果是表达式，就是非静态；如果是纯文本，就是静态；对于一个普通元素，如果有 pre 属性，那么它使用了 v-pre 指令，是静态，否则要同时满足以下条件：没有使用 v-if、v-for，没有使用其它指令（不包括 v-once），非内置组件，是平台保留的标签，非带有 v-for 的 template 标签的直接子节点，节点的所有属性的 key 都满足静态 key；这些都满足则这个 AST 节点是一个静态节点。

如果这个节点是一个普通元素，则遍历它的所有 children，递归执行 markStatic。因为所有的 elseif 和 else 节点都不在 children 中， 如果节点的 ifConditions 不为空，则遍历 ifConditions 拿到所有条件中的 block，也就是它们对应的 AST 节点，递归执行 markStatic。在这些递归过程中，一旦子节点有不是 static 的情况，则它的父节点的 static 均变成 false。

markStaticRoots 在上述标记静态节点后，再做一层筛选，剔除只有一个子元素，并且该子元素是纯文本的情况，如:<div>123</div>(目的可能是只有一个纯文本的子元素节点维护成本过高，因此需要剔除)，并左上标记staticRoot；后续在渲染过程中也会用到staticRoot，而staic只是在生成staticRoot过程中衍生出的中间属性，
```
- 三、generate
主要过程包括 genElement(ast, state) 生成 code，再把 code 用 with(this){return ${code}}} 包裹起来。
```javascript
// 常用简称目录
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)

export function installRenderHelpers (target: any) {
  target._o = markOnce
  target._n = toNumber
  target._s = toString
  target._l = renderList
  target._t = renderSlot
  target._q = looseEqual
  target._i = looseIndexOf
  target._m = renderStatic
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode
  target._e = createEmptyVNode
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
}
```
- new CodegenState(options)生成state实例:其中收集module对应的配置，在后续genData过程中，对于ast 标签属性生成 字符串对象中运用的到，如:<BR>
  在生成class和style时
  ```text
  获取所有 modules 中的 genData 函数，其中，class module 和 style module 定义了 genData 函数。比如定义在 src/platforms/web/compiler/modules/class.js 中的 genData 方法：
  function genData (el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
    return data
  }
  在初始化CodegenState过程中，会手机起来，放到state实例dataGenFns上
  export class CodegenState {
  constructor (options: CompilerOptions) {
    // ...
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    // ...
    }
  }

  在后续genElement过程中 执行当前genData 实际上就是执行各个模块收集过来处理ast上属性的方法，如 事件就会 变成on:{}这样的字符串方式
  class、style就如下方展示
  {
    staticClass: "list",
    class: bindCls
  }
  ```
- genElement，通过ast生成可执行的代码字符串，常用函数简称目录如上方所示<br>

首次进入为根元素，在没有其他自定义属性的情况下会直接跳过多次判断，走到else代码块中<br>
else代码块主要逻辑包括:<br>
1、genData：收集标签上的属性及事件<br>
2、genChildren，如果有子元素就开始进行递归，递归逻辑后续提到<br>
3、最终生成  `_c('${el.tag},${data} ,${children}` 这样形式的函数调用字符串，其中children为数组，子元素也与这个模板一直<br>

- 在genElement过程中如果标签含有if for等会执行对应的方法genIf，genFor，在处理过后最终还会继续调用genElement方法(因为genElement最终只有else内才会生成元素生成函数调用的字符串_c()等形式)，同时为该ast属性打上ifProcessed等标记位，目的是为了最终生成成元素时，跳过if for的处理，避免进入死循环，下方只展示if 跟 for的逻辑
```text
  genIf:
  1、通过genIfConditions，需循环ast中ifconditions数组，每次遍历会把第一个删除，直到数组为空
  2、然后通过对 condition.exp 去生成一段三元运算符的代码，: 后是递归调用 genIfConditions，这样如果有多个 conditions，就生成多层三元运算逻辑。这里我们暂时不考虑 v-once 的情况，所以 genTernaryExp 最终是调用了 genElement。

  genFor:
  genFor 的逻辑很简单，首先 AST 元素节点中获取了和 for 相关的一些属性，然后返回了一个代码字符串。
  生成代码字符串可以看code源码，源码内有阅读注释

  staticRoot：
  在上述optimize过程中，会把静态根节点标记出来，此时，该方法就会把静态根ast转化成可执行函数后再存到state.staticRenderFns的数组中
```
### genIf 
- 标记ifProcessed 执行genElement是就不会再次进入genIf
- genIf 主要是通过执行 genIfConditions，它是依次从 ifconditions 获取第一个 condition
- 然后通过对 condition.exp 去生成一段三元运算符的代码，: 后是递归调用 genIfConditions，
- 这样如果有多个 conditions，就生成多层三元运算逻辑。这里我们暂时不考虑 v-once 的情况，所以 genTernaryExp 最终是调用了 genElement。
- 例子如：return (bool == 2) ? genElement(el, state) : _e()

### genFor
- genFor 的逻辑很简单，首先 AST 元素节点中获取了和 for 相关的一些属性，然后返回了一个代码字符串。
- 例子如：_l((arr), function(a, b) {
  return genElememt(el, state)
})

- 处理过后的子元素会形成数组，塞到上方第3点位置，形成嵌套

- 最终生成code文本，会套在`with(this){return ${code}}`模板上<br>
with的作用在于，在后面执行函数code的时候，可以直接读取this里面的属性，而不需要通过this.的方法获取，with语法可看额外补充.md

-最后generate过程返回2个属性render：即为ast语法树转换后的可执行函数字符串，staticRenderFns为静态根可执行的渲染函数集合数组

## mountComponent
- 1、callHook(vm, 'beforeMount') beforeMount钩子函数触发
- 2、声明updateComponent更新函数：vm._update(vm._render(), hydrating)：
```text
(1) _render为在generate生成的可执行函数
(2) 在执行的过程会，会执行数组中个个字节的_c生成函数，因此最终该函数的执行结果为生成一个数状结构的vnode
```
- 3、创建渲染Watcher实例，将updateComponent挂载到watch上，并设置before函数(beforeUpdate生命周期函数),在watch实例化的过程中会执行一次updateComponent(详细可看Watcher介绍)
- 4、触发mounted钩子函数<br>
-----------------------------------至此初始化过程结束---------------------------------------------------
# 响应式原理
在写响应式原理前首先了解核心的三个类:Observer  Watcher Dep
### observer模块

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
- 创建一个new Dep实例dep，每一个观察类都会拥有一个独立的dep实例，在vue响应式过程中就是通过dep实例 来进行订阅与发布数据更新
- def函数 会为value(即new Observer()中的引用属性) 添加__ob__  属性，值为Oberver实例，并且通过defineProperty设置访问器属性
- 判断数组是否数组，如果是数组会进行以下处理
```javascript
copyAugment(value, arrayMethods, arrayKeys)
// 
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}
// array.js
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
```
```text
1、通过重写上述的数组的方法，在执行上述数组操作是会触发dep.notify 即任务派发，通知数据层已经更新
2、执行observeArray。即为每个array中的元素调用一次observer方法，数组元素为引用类型的元素也可以得到监听，进行递归，若为基本数据类型，会在observer执行过程中直接返回(observer 实际上就是为每一个引用类型的每个属性添加访问器属性)
3、执行walk方法。walk实际过程即是为对象中的所有属性都调用defineReactive进行处理
4-1、defineReactive处理过程：为对象中的每个属性都创建一个dep实例；let childOb = !shallow && observe(val) 若属性是应用类型，则会递归调用obeserve方法；Object.defineProperty给属性添加get set方法（所有数据类型都会添加，不区分基本和引用类型）
4-2、get:如果本身属性就已经复制了get方法，则会声明getter变量存储起来，在get中去调用getter方法，防止之前设置的访问器属性丢失；调用当前4-1时新增的dep实例 调用订阅的方法；因为在render过程中，会调用已经有ast语法树转化的执行函数去生成vnode，因此在生成的vnode过程中会有一个读取data数据中属性的过重，因此在get中订阅，可以保证需要更新到视图上的data可以准确的添加订阅;
4-3、set:如果value是应用类型，调用observe方法 添加监听；dep.notify调用通知视图更新，在data更新的时候会告诉dep，让dep派发任务通知view层更新渲染
```

value是需要被观察的数据对象，在构造函数中，会给value增加__ob__属性，作为数据已经被Observer观察的标志。如果value是数组，就使用observeArray遍历value，对value中每一个元素调用observe分别进行观察。如果value是对象，则使用walk遍历value上每个key，对每个key调用defineReactive来获得该key的set/get控制权。<br>

解释下上面用到的几个函数的功能：

- observeArray: 遍历数组，对数组的每个元素调用observe

- observe: 检查对象上是否有__ob__属性，如果存在，则表明该对象已经处于Observer的观察中，如果不存在，则new Observer来观察对象（其实还有一些判断逻辑，为了便于理解就不赘述了）

- walk: 遍历对象的每个key，对对象上每个key的数据调用defineReactive

- defineReactive: 通过Object.defineProperty设置对象的key属性，使得能够捕获到该属性值的set/get动作。一般是由Watcher的实例对象进行get操作，此时Watcher的实例对象将被自动添加到Dep实例的依赖数组中，在外部操作触发了set时，将通过Dep实例的notify来通知所有依赖的watcher进行更新。let childOb = !shallow && observe(val) - 若有该属性是应用类型，则会继续调用observe进行深度递归；childOb.dep.depend() - 在读取属性，若属性也是应用类型存在childOb，那在子属性图依赖数组dep中中也需要添加当前父属性节点，让免子属性变化时也通知副属性

### Dep
Dep是Observer与Watcher之间的纽带，也可以认为Dep是服务于Observer的订阅系统。Watcher订阅某个Observer的Dep，当Observer观察的数据发生变化时，通过Dep通知各个已经订阅的Watcher。<br>

Dep提供了几个接口：

- addSub: 接收的参数为Watcher实例，并把Watcher实例存入记录依赖的数组中(其中newDepIds为set数据结构，再添加之前会有has判断避免重复添加依赖)

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
```text
在执行 cleanupDeps 函数的时候，会首先遍历 deps，移除对 dep.subs 数组中 Wathcer 的订阅，然后把 newDepIds 和 depIds 交换，newDeps 和 deps 交换，并把 newDepIds 和 newDeps 清空。

那么为什么需要做 deps 订阅的移除呢，在添加 deps 的订阅过程，已经能通过 id 去重避免重复订阅了。

考虑到一种场景，我们的模板会根据 v-if 去渲染不同子模板 a 和 b，当我们满足某种条件的时候渲染 a 的时候，会访问到 a 中的数据，这时候我们对 a 使用的数据添加了 getter，做了依赖收集，那么当我们去修改 a 的数据的时候，理应通知到这些订阅者。那么如果我们一旦改变了条件渲染了 b 模板，又会对 b 使用的数据添加了 getter，如果我们没有依赖移除的过程，那么这时候我去修改 a 模板的数据，会通知 a 数据的订阅的回调，这显然是有浪费的。

因此 Vue 设计了在每次添加完新的订阅，会移除掉旧的订阅，这样就保证了在我们刚才的场景中，如果渲染 b 模板的时候去修改 a 模板的数据，a 数据订阅回调已经被移除了，所以不会有任何浪费，真的是非常赞叹 Vue 对一些细节上的处理。

```

- update: 立刻运行watcher或者将watcher加入队列中等待统一flush

- run: 运行watcher，调用this.get()求值，然后触发回调

- evaluate: 调用this.get()求值

- depend: 遍历this.deps，让当前watcher实例订阅所有dep

- teardown: 去除当前watcher实例所有的订阅

## initState过程
```text
  在init过程中，会触发initstate过程，initState 方法主要是对 props、methods、data、computed 和 wathcer 等属性做了初始化操作。这里我们重点分析 props 和 data，对于其它属性的初始化我们之后再详细分析
    1、props 的初始化主要过程，就是遍历定义的 props 配置。遍历的过程主要做两件事情：一个是调用 defineReactive 方法把每个 prop 对应的值变成响应式，可以通过 vm._props.xxx 访问到定义 props 中对应的属性。对于 defineReactive 方法，我们稍后会介绍；另一个是通过 proxy 把 vm._props.xxx 的访问代理到 vm.xxx 上；
    2、data 的初始化主要过程也是做两件事，一个是对定义 data 函数返回对象的遍历，通过 proxy 把每一个值 vm._data.xxx 都代理到 vm.xxx 上；另一个是调用 observe 方法观测整个 data 的变化，把 data 也变成响应式，可以通过 vm._data.xxx 访问到定义 data 返回函数中对应的属性，observe
```
## initData(data的响应式流程原理 -- mvc)
- 通过observer函数，为data里面的所有属性进行递归遍历，并生成对应的依赖类dep,若属性是数组会从写数组更新的方法，后续执行defineReactive，为每个属性添加get/set访问器属性和生成独立的依赖类dep；
- 在初始化的过程中，mountComponent中生成一个渲染Watcher，该Watcher的get方法是_render生成vnode 再执行update更新视图
- 在初次渲染时，会获取data上的属性，并触发get访问器，此时会往依赖类dep添加渲染Watcher监听；
- 在data发生修改时 get方法会执行dep的notify方法，执行订阅队列中的渲染Watcer中的更新方法，更新方法会生成新的Vnode，patch新旧vnode后再更新视图

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
- Vue源码学习[https://blog.windstone.cc/vue/source-study/vdom/topics/dom-binding.html]
