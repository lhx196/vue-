/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML(html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no

  let index = 0
  /**
   * last :html完整文本
   */
  let last, lastTag
  // debugger
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 确保不在脚本/样式之类的纯文本内容元素中
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      /**
       * 如果html字符串是以'<'开头,则有以下几种可能
       * 开始标签:<div>
       * 结束标签:</div>
       * 注释:<!-- 我是注释 -->
       * 条件注释:<!-- [if !IE] --> <!-- [endif] -->
       * DOCTYPE:<!DOCTYPE html>
       * 需要一一去匹配尝试
       */
      if (textEnd === 0) {
        console.log('end0')
        // Comment:
        // <!-- -->注释处理
        // const comment = /^<!\--/
        // 判断当前template开头是否为<!--
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 保留注释处理
            if (options.shouldKeepComment) {
              // 若保留注释，则把注释截取出来传给options.comment，创建注释类型的AST节点
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 使html截取注释后面的部分
            // '<!-- dsfsdf -->' 当运行到此处时，字符串开头已经是<!-- 因此只需要把游标在结束点后设置三位
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // <！[endif]> 清除条件注释
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }
        // End tag:
        // 判断字符串开头 为结束标签
        const endTagMatch = html.match(endTag)
        // 如果正则匹配出为结束标签 则继续移动 html模板标识位 解析结束标签 跳过本次循环
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 调用parseStartTag函数，如果模板字符串符合开始标签的特征，则解析开始标签，并将解析结果返回，如果不符合开始标签的特征，则返回undefined。
        // 解析开始标签 如：<div></div>中 解析前半段标签
        // {"tagName":"div","attrs":[[" id=\"app\"","id","=","app",null,null]],"start":0,"unarySlash":"","end":14}
        // {"tagName":"div","attrs":[[" value=\"valuetext\"","value","=","valuetext",null,null],[" data-num=\"numbertext\"","data-num","=","numbertext",null,null],[" @click=\"FunA\"","@click","=","FunA",null,null]],"start":46,"unarySlash":"","end":105}
        const startTagMatch = parseStartTag()

        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }
      // 处理从模板字符串开头 到 标签识别符号 < 之前的剩余文本
      let text, rest, next
      // 如果html字符串不是以'<'开头,说明'<'前面的都是纯文本，无需处理
      // 那就把'<'以后的内容拿出来赋给rest
      if (textEnd >= 0) {

        rest = html.slice(textEnd)

        while (
          // 不为结束标签
          !endTag.test(rest) &&
          // 不为开始标签
          !startTagOpen.test(rest) &&
          // 不为注释
          !comment.test(rest) &&
          // 不为条件注释
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      // 如果在html字符串中没有找到'<'，表示这一段html字符串都是纯文本
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      // 父元素为script、style、textarea时，其内部的内容全部当做纯文本处理
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  // advance函数是用来移动解析游标的，解析完一部分就把游标向后移动一部分，确保不会重复解析
  function advance(n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag() {
    // console.log(startTagOpen)
    const start = html.match(startTagOpen)
    // console.log(start)
    if (start) {
      /**
       * start: ['<div','div',groups:undefined,index:0,input]
       * match:
          tagName:标签名称
          attrs:属性
          start：属性，事件、自定义属性等 value="valuetext" 类型与等号赋值的接口 头部标记的位置
          end: 上述字段字符串尾部的标识符，通过adcance移动标记位后， index（即当前模板字符串解析到的位置）为尾部标识位置
          unarySlash: 非自闭合标签标记
       */
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // 当模板字符串匹配不为 开始标签的结束符号(即 > ) 时进入循环
      // 每次循环将匹配一个事件绑定、属性、自定义属性等，如下方注释所示
      /**
       * <div a=1 b=2 c=3></div>
       * 从<div之后到开始标签的结束符号'>'之前，一直匹配属性attrs
       * 所有属性匹配完之后，html字符串还剩下
       * 自闭合标签剩下：'/>'
       * 非自闭合标签剩下：'></div>'
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        /**
         * attrs 每次循环的值
          [" id=\"app\"","id","=","app",null,null]
          [" value=\"valuetext\"","value","=","valuetext",null,null]
          [" data-num=\"numbertext\"","data-num","=","numbertext",null,null]
          [" @click=\"FunA\"","@click","=","FunA",null,null]
         */
        // console.log(JSON.stringify(attr))
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      if (end) {
        /**
         * 这里判断了该标签是否为自闭合标签
         * 自闭合标签如:<input type='text' />
         * 非自闭合标签如:<div></div>
         * '></div>'.match(startTagClose) => [">", "", index: 0, input: "></div>", groups: undefined]
         * '/><div></div>'.match(startTagClose) => ["/>", "/", index: 0, input: "/><div></div>", groups: undefined]
         * 因此，我们可以通过end[1]是否是"/"来判断该标签是否是自闭合标签
         */
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        // console.log(match)
        return match
      }
    }
  }

  function handleStartTag(match) {
    // 开始标签的标签名
    const tagName = match.tagName
    // 是否为自闭合标签的标志，自闭合为"",非自闭合为"/"
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }
    // 布尔值，标志是否为自闭合标签
    const unary = isUnaryTag(tagName) || !!unarySlash
    // match.attrs 数组的长度
    const l = match.attrs.length
    const attrs = new Array(l)
    /**
     * 循环生成新的attrs
     *  name --属性名称
     *  value -- 属性值 如果是事件 则value为方法名
     */
    for (let i = 0; i < l; i++) {
      // const args = ["class="a"", "class", "=", "a", undefined, undefined, index: 0, input: "class="a" id="b"></div>", groups: undefined]
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      /**
       * 如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，要对属性值中的换行符或制表符做兼容处理。而shouldDecodeNewlinesForHref为true 意味着Vue在编译模板的时候，要对a标签的 href属性值中的换行符或制表符做兼容处理。
       */
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }
    // 如果该标签是非自闭合标签，则将标签推入栈中 后续在解析结束标签时会从栈顶开始检索
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    if (options.start) {
      // parser/index 中parseHTML 参数传有start
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 如果有标签名称
    // 从栈顶开始寻找与tagName相同标签并记录所在位置pos。若tagName不存在则记为0
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      /**
       * 接着当pos>=0时，开启一个for循环，从栈顶位置从后向前遍历直到pos处，如果发现stack栈中存在索引大于pos的元素，那么该元素一定是缺少闭合标签的。
       * 这是因为在正常情况下，stack栈的栈顶元素应该和当前的结束标签tagName 匹配，也就是说正常的pos应该是栈顶位置，后面不应该再有元素，
       * 如果后面还有元素，那么后面的元素就都缺少闭合标签 那么这个时候如果是在非生产环境会抛出警告，告诉你缺少闭合标签。
       * 除此之外，还会调用 options.end(stack[i].tag, start, end)立即将其闭合，这是为了保证解析结果的正确性。
       */
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 最后把pos位置以后的元素都从stack栈中弹出，以及把lastTag更新为栈顶元素:
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
