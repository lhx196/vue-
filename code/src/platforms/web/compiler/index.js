/* @flow */

import { baseOptions } from './options'
// 根本目录为src 内 complier
import { createCompiler } from 'compiler/index'

// src/complier/createCompiler
const { compile, compileToFunctions } = createCompiler(baseOptions)

// compileToFunctions经过ast生成，opt优化，gen生成可执行字符串传，在导出compileToFunctions时，也添加了new Function的逻辑
export { compile, compileToFunctions }
 