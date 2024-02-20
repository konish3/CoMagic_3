const path = require("node:path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const sass = require("sass");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const CONTENT_SCRIPT = path.join(__dirname, "../src/content-script.js");
const BUILD_PATH = path.join(__dirname, "../build");
const SOUNDS_PATH = path.join(__dirname, "../build/sounds");
const isDevelopmentMode = process.env.API_ENV === "development";
const PATCH_TO_CSS = "css/index.css";

const config = {
  mode: isDevelopmentMode ? "development" : "production",
  devtool: isDevelopmentMode ? "source-map" : false,
  optimization: {
    minimize: !isDevelopmentMode,
    minimizer: [new CssMinimizerPlugin()],
  },
  entry: {
    content_script: CONTENT_SCRIPT,
  },
  output: {
    path: BUILD_PATH,
    filename: "js/[name].js",
    sourceMapFilename: "[name].js.map",
    clean: true,
  },
  resolve: {
    extensions: [".*", ".jsx", ".js", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: { babelrc: true },
          },
        ],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          isDevelopmentMode ? "style-loader" : MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
            },
          },
          "sass-loader",
        ],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin({ dry: true }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "public/icons",
          to: "icons",
        },
        {
          from: "public/js",
          to: "js",
        },
        {
          from: "src/sounds",
          to: SOUNDS_PATH,
        },
        {
          from: "src/scss/index.scss",
          to: PATCH_TO_CSS,
          transform: (content, path) => sass.compile(path).css,
        },
        {
          from: "public/manifest.json",
          to: "manifest.json",
        },
      ],
    }),
    new MiniCssExtractPlugin(),
  ],
};

module.exports = config;
