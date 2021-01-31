module.exports = (api) => {
  const isTest = api.env('test')

  if (!isTest) return {}

  return {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }
}
