import { parse } from '../dist/babel-parser.js'
import { parse as babelParse } from '@babel/parser'

test('parses', () => {
  const input = 'const foo = "bar"'
  const ast = parse(input)
  expect(ast).toEqual(babelParse(input))
})

test('parses ts', () => {
  const input = 'const foo: string = "hi"'
  const opts = { plugins: ['typescript'] }
  const ast = parse(input, opts)
  expect(ast).toEqual(babelParse(input, opts))
})

test('parses ts', () => {
  const input = 'let f: (this: number) => void;'
  const opts = { plugins: ['typescript'] }
  const ast = parse(input, opts)
  expect(ast).toEqual(babelParse(input, opts))
})

test('parses JSX', () => {
  const input = '<div>First &middot; Second</div>'
  const opts = { plugins: ['jsx'] }
  const ast = parse(input, opts)
  expect(ast).toEqual(babelParse(input, opts))
})

test('passes options', () => {
  const input = 'return "hi"'
  const opts = { allowReturnOutsideFunction: true }
  const ast = parse(input, opts)
  expect(ast).toEqual(babelParse(input, opts))
})
