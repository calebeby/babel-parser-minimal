const { promises: fs } = require('fs')

const main = async () => {
  const typesFile = await fs.readFile(
    'node_modules/@babel/types/lib/index.d.ts',
    'utf8',
  )

  const parserFile = await fs.readFile(
    'node_modules/@babel/parser/lib/index.js',
    'utf8',
  )

  const nodeTypeRgx = /interface \w* extends BaseNode {[^}]*}/gm

  const props = new Set(['identifierName', 'errors'])

  let match

  const getPropsFromInterface = (interface) => {
    const propRgx = /^\s+(\w*)\??:/gm

    while ((match = propRgx.exec(interface))) {
      props.add(match[1])
    }
  }

  while ((match = nodeTypeRgx.exec(typesFile))) {
    getPropsFromInterface(match[0])
  }

  if ((match = /interface BaseNode {[^}]*}/gm.exec(typesFile))) {
    getPropsFromInterface(match[0])
  }

  if ((match = /interface SourceLocation {[^}]*}/gm.exec(typesFile))) {
    getPropsFromInterface(match[0])
  }

  if ((match = /const entities = {[^}]*}/gm.exec(parserFile))) {
    getPropsFromInterface(match[0])
  }

  await fs.writeFile(
    './babel-public-props.js',
    `export default new Set(${JSON.stringify([...props])})`,
  )
}

main()
