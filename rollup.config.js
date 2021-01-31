// @ts-check

import nodeResolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import bundleSize from 'rollup-plugin-bundle-size'
import { minify } from 'terser'
import { types as t } from '@babel/core'
import stringLiteralProps from './babel-public-props'
import annotateAsPure from '@babel/helper-annotate-as-pure'

const excludePlugins = new Set([
  'placeholders',
  'flow',
  'decorators',
  'v8intrinsic',
  'importAssertions',
  'moduleAttributes',
  'flowComments',
  'privateIn',
  'recordAndTuple',
  'functionBind',
  'pipelineOperator',
  'throwExpressions',
  'doExpressions',
  'partialApplication',
  'decimal',
  'classStaticBlock',
  'decorators-legacy',
  'exportDefaultFrom',
])
const includePlugins = new Set([
  'estree',
  'functionSent',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'moduleStringNames',
  'topLevelAwait',
  'jsx',
  'typescript',
])

const isPluginAllowed = (pluginName) => {
  if (excludePlugins.has(pluginName)) {
    return false
  }
  if (includePlugins.has(pluginName)) {
    return true
  }
  throw new Error(`unrecognized plugin: ${pluginName}`)
}

const pipelineEnabled = includePlugins.has('pipelineOperator')
const decoratorsEnabled =
  includePlugins.has('decorators') || includePlugins.has('decorators-legacy')

/** @type {import('@babel/core').PluginObj} */
const filterPlugins = {
  visitor: {
    ObjectProperty(path) {
      const { node } = path
      if (t.isIdentifier(node.key)) {
        if (excludePlugins.has(node.key.name)) {
          path.remove()
        }
      }
    },
    MemberExpression(path) {
      const { node } = path
      if (!pipelineEnabled) {
        if (
          t.isIdentifier(node.property) &&
          (node.property.name === 'inPipeline' ||
            node.property.name === 'inFSharpPipelineDirectBody')
        ) {
          if (
            path.parentPath.isAssignmentExpression() &&
            path.parentKey === 'left'
          ) {
            // this.state.inFSharpPipelineDirectBody = false
            path.parentPath.remove()
          } else {
            // if (this.state.inFSharpPipelineDirectBody)
            path.replaceWith(t.booleanLiteral(false))
          }
        }
      }
      if (!decoratorsEnabled) {
        // decorators.length will always be zero
        // also member.decorators.length will always be zero
        if (
          (t.isIdentifier(node.object, { name: 'decorators' }) &&
            t.isIdentifier(node.property, { name: 'length' })) ||
          (t.isMemberExpression(node.object) &&
            t.isIdentifier(node.object.property, { name: 'decorators' }) &&
            t.isIdentifier(node.property, { name: 'length' }))
        ) {
          path.replaceWith(t.numericLiteral(0))
        }
      }
    },
    ClassMethod(path) {
      const { node } = path
      if (
        !pipelineEnabled &&
        t.isIdentifier(node.key) &&
        /pipeline/i.test(node.key.name)
      ) {
        path.remove()
      }
      if (
        !decoratorsEnabled &&
        t.isIdentifier(node.key) &&
        [
          'parseDecorator',
          'parseDecorators',
          'takeDecorators',
          'canHaveLeadingDecorator',
          'parseMaybeDecoratorArguments',
        ].includes(node.key.name)
      ) {
        path.remove()
      }
    },
    CallExpression(path) {
      const { node } = path
      if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property, { name: 'hasPlugin' }) &&
        node.arguments.length === 1 &&
        t.isStringLiteral(node.arguments[0])
      ) {
        const pluginName = node.arguments[0].value
        if (!isPluginAllowed(pluginName)) {
          path.replaceWith(t.booleanLiteral(false))
        }
      } else if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property, { name: 'getPluginOption' }) &&
        node.arguments.length === 2 &&
        t.isStringLiteral(node.arguments[0])
      ) {
        const pluginName = node.arguments[0].value
        if (!isPluginAllowed(pluginName)) {
          path.replaceWith(t.identifier('undefined'))
        }
      } else if (
        !decoratorsEnabled &&
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property) &&
        node.callee.property.name === 'takeDecorators'
      ) {
        path.remove()
      } else if (
        !decoratorsEnabled &&
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property) &&
        (node.callee.property.name === 'parseDecorator' ||
          node.callee.property.name === 'parseDecorators')
      ) {
        // this.parseDecorator() will always throw so replace calls to it with the throw
        // this.parseDecorators() will always throw as well
        const replacePath = path.find((p) => p.isStatement())
        replacePath.replaceWith(
          t.throwStatement(
            t.newExpression(t.identifier('Error'), [
              t.stringLiteral(
                'babel-parser-minimal does not support any of these plugins: decorators-legacy, decorators',
              ),
            ]),
          ),
        )
      } else if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property, { name: 'expectPlugin' }) &&
        (node.arguments.length === 1 || node.arguments.length === 2) &&
        t.isStringLiteral(node.arguments[0])
      ) {
        const pluginName = node.arguments[0].value
        if (!isPluginAllowed(pluginName)) {
          const target = path.parentPath.isExpressionStatement()
            ? path.parentPath
            : path
          target.replaceWith(
            t.throwStatement(
              t.newExpression(t.identifier('Error'), [
                t.stringLiteral(
                  `babel-parser-minimal does not support the ${pluginName} plugin`,
                ),
              ]),
            ),
          )
        }
      } else if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property, { name: 'expectOnePlugin' }) &&
        (node.arguments.length === 1 || node.arguments.length === 2) &&
        t.isArrayExpression(node.arguments[0])
      ) {
        const pluginNames = node.arguments[0].elements.map((el) => {
          if (t.isStringLiteral(el)) return el.value
        })
        if (pluginNames.every((pluginName) => !isPluginAllowed(pluginName))) {
          const target = path.parentPath.isExpressionStatement()
            ? path.parentPath
            : path
          target.replaceWith(
            t.throwStatement(
              t.newExpression(t.identifier('Error'), [
                t.stringLiteral(
                  `babel-parser-minimal does not support any of these plugins: ${pluginNames.join(
                    ', ',
                  )}`,
                ),
              ]),
            ),
          )
          return
        }
        // @ts-ignore
        path.get('arguments.0.elements').forEach((el) => {
          if (!el.isStringLiteral) return
          const pluginName = el.node.value
          if (!isPluginAllowed(pluginName)) el.remove()
        })
      } else if (
        t.isIdentifier(node.callee, { name: 'hasPlugin' }) &&
        node.arguments.length === 2 &&
        t.isIdentifier(node.arguments[0]) &&
        t.isStringLiteral(node.arguments[1])
      ) {
        const pluginName = node.arguments[1].value
        if (!isPluginAllowed(pluginName)) {
          path.replaceWith(t.booleanLiteral(false))
        }
      }
    },
  },
}

/** @type {import('@babel/core').PluginObj} */
const removeObjectFreeze = {
  visitor: {
    CallExpression(path) {
      const { node } = path
      if (
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'Object' }) &&
        t.isIdentifier(node.callee.property, { name: 'freeze' }) &&
        node.arguments.length === 1 &&
        t.isObjectExpression(node.arguments[0])
      ) {
        path.replaceWith(node.arguments[0])
      }
    },
  },
}

/** @type {import('@babel/core').PluginObj} */
const injectPluginCheck = {
  visitor: {
    FunctionDeclaration(path) {
      const { node } = path
      if (t.isIdentifier(node.id, { name: 'validatePlugins' })) {
        path
          .get('body')
          .unshiftContainer('body', [
            t.callExpression(
              t.memberExpression(
                t.arrayExpression(
                  [...excludePlugins].map((plugin) => t.stringLiteral(plugin)),
                ),
                t.identifier('forEach'),
              ),
              [
                t.arrowFunctionExpression(
                  [t.identifier('plugin')],
                  t.blockStatement([
                    t.ifStatement(
                      t.callExpression(t.identifier('hasPlugin'), [
                        t.identifier('plugins'),
                        t.identifier('plugin'),
                      ]),
                      t.throwStatement(
                        t.newExpression(t.identifier('Error'), [
                          t.binaryExpression(
                            '+',
                            t.identifier('plugin'),
                            t.stringLiteral(
                              ' is not supported by babel-parser-minimal',
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ],
            ),
          ])
      }
    },
  },
}

/** @type {import('@babel/core').PluginObj} */
const markAsPure = {
  visitor: {
    CallExpression(path) {
      const { node } = path
      // this.match() is pure and we are marking calls to it so terser can sometimes remove them
      if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property, { name: 'match' }) &&
        node.arguments.length === 1
      ) {
        annotateAsPure(path)
      }
    },
  },
}

const nameCache = {}

/** @type {import('rollup').RollupOptions} */
export const config = {
  input: './index.js',
  output: [{ format: 'esm', file: 'dist/babel-parser.js' }],
  plugins: [
    nodeResolve(),
    babel({
      babelHelpers: 'bundled',
      configFile: false,
      plugins: [
        'babel-plugin-un-cjs',
        filterPlugins,
        removeObjectFreeze,
        injectPluginCheck,
        markAsPure,
      ],
    }),
    bundleSize(),
    {
      name: 'terser',
      async renderChunk(code) {
        /** @type {import('terser').MinifyOptions} */
        const opts = {
          module: true,
          ecma: 2020,
          mangle: {
            reserved: [
              'Node',
              'Position',
              'SourceLocation',
              'Token',
              'TokenType',
            ],
            properties: {
              reserved: [...stringLiteralProps, ...includePlugins],
            },
          },
          nameCache,
          compress: {
            passes: 3,
            unsafe: true,
            pure_getters: true,
            keep_fargs: false,
          },
        }
        const res = await minify(code, opts)
        return { code: res.code }
      },
    },
  ],
}

export default config
