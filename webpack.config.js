const webpack = require('webpack')
const path = require('node:path')
const childProcess = require('node:child_process')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackShellPluginNext = require('webpack-shell-plugin-next')

const SRC_DIR = path.resolve(__dirname, 'src/client')
const BUILD_DIR = path.resolve(__dirname, 'dist')
const BUILD_VERSION = process.env.BUILD_VERSION || childProcess.execSync('git describe --tags').toString().trim()

console.log('BUILD_DIR', BUILD_DIR)
console.log('SRC_DIR', SRC_DIR)
console.log('BUILD_VERSION', BUILD_VERSION)

module.exports = (env, argv) => {
  return {
    mode: 'development',
    entry: [path.join(SRC_DIR, 'index.js')],
    output: {
      path: BUILD_DIR,
      filename: '[name].bundle.js'
    },
    devtool: (argv.mode === 'production') ? 'source-map' : 'eval-cheap-module-source-map',
    devServer: {
      static: BUILD_DIR,
      compress: true,
      hot: true,
      open: true,
      host: 'local-ip',
      port: 'auto',
      proxy: [{
        // in dev, proxy admin api requests coming to webpack dev server
        // to our venus grafana server
        context: '/admin-api/*',
        target: 'http://localhost:8088',
        auth: 'admin:admin',
      }]
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: ['@babel/preset-react', '@babel/preset-env']
            }
          }
        },
        {
          test: /\.html$/,
          loader: 'html-loader'
        },
        {
          mimetype: 'image/svg+xml',
          scheme: 'data',
          type: 'asset/resource',
          generator: {
            filename: 'icons/[hash].svg'
          }
        },
        {
          test: /\.css$/,
          use: [
            env.production ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: () => [
                    require('autoprefixer')
                  ]
                }
              }
            },
          ],
        },
        {
          test: /\.(scss)$/,
          use: [
            {
              loader: env.production ? MiniCssExtractPlugin.loader : 'style-loader'
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: () => [
                    require('autoprefixer')
                  ]
                }
              }
            },
            {
              loader: 'sass-loader'
            }
          ]
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico)$/,
          type: 'asset/resource'
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        // in production, derive admin api host:port from window.location
        // in dev, hardcode to 8088, as webpack will spin up webpack dev server on random port
        // and window.location will point to webpack dev server, instead of venus influx loader
        'VENUS_INFLUX_LOADER_ADMIN_API_PORT': env.production ? undefined : 8088,
        'VENUS_INFLUX_LOADER_BUILD_VERSION': `\"${BUILD_VERSION}\"`,
      }),
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        inject: true,
        template: path.join(SRC_DIR, 'public/index.html')
      }),
      new WebpackShellPluginNext({
        onBuildEnd: {
          scripts: [`echo module.exports.buildVersion=\\"${BUILD_VERSION}\\" >> ./dist/buildInfo.js`],
          blocking: true,
          parallel: false
        }
      }),
    ],
    optimization: {
      minimize: true,
      minimizer: [
          new TerserPlugin(),
      ],
    }
  }
}
