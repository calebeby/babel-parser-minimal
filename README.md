# @babel/parser minimal bundle

This is a minimal build of [`@babel/parser`](https://babeljs.io/docs/en/babel-parser), with most of the non-standard/proposal features stripped out. It is heavily minified and any unused code is attempted to be removed. It should work exactly the same as `@babel/parser` (except for unsupported plugins), and any case where it emits different output is a bug.

It includes support for TypeScript and JSX, as well as standardized modern features. It does not support most proposals.

Supported plugins:

- `functionSent`
- `classProperties`
- `classPrivateProperties`
- `classPrivateMethods`
- `moduleStringNames`
- `topLevelAwait`
- `jsx`
- `typescript`

Unsupported plugins:

- `placeholders`
- `flow`
- `estree`
- `decorators`
- `v8intrinsic`
- `importAssertions`
- `moduleAttributes`
- `flowComments`
- `privateIn`
- `recordAndTuple`
- `functionBind`
- `pipelineOperator`
- `throwExpressions`
- `doExpressions`
- `partialApplication`
- `decimal`
- `classStaticBlock`
- `decorators-legacy`
- `exportDefaultFrom`

## Install

```
npm i -D babel-parser-minimal
```

## API

The API is exactly the same as https://babeljs.io/docs/en/babel-parser#api, but if you attempt to use any unsupported plugin, it will throw an error.

## Example

```js
import { parse } from 'babel-parser-minimal'

// TS source code
const input = 'const foo: string = "bar"'
const ast = parse(input, { plugins: ['typescript'] })
```
