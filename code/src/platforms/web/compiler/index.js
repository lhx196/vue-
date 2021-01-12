/* @flow */

import { baseOptions } from './options'
// 根本目录为src 内 complier
import { createCompiler } from 'compiler/index'

// src/complier/createCompiler
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
