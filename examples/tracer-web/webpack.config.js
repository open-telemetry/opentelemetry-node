const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const path = require('path');

const directory = path.resolve(__dirname);

const common = {
  mode: 'development',
  entry: {
    metrics: 'examples/metrics/index.js',
    test: 'examples/test/test.ts',
    fetch: 'examples/fetch/index.js',
    'xml-http-request': 'examples/xml-http-request/index.js',
    zipkin: 'examples/zipkin/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    sourceMapFilename: '[file].map',
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.js[x]?$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.ts$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'ts-loader',
        },
      },
    ],
  },
  resolve: {
    modules: [
      path.resolve(directory),
      'node_modules',
    ],
    extensions: ['.ts', '.js', '.jsx', '.json'],
  },
};

module.exports = webpackMerge(common, {
  devtool: 'eval-source-map',
  devServer: {
    contentBase: path.resolve(__dirname),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
});
