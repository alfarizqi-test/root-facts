const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");

module.exports = merge(common, {
  mode: "development",
  devtool: "eval-source-map",
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 3000,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    historyApiFallback: true,
    // Required for camera access over localhost
    server: "http",
    allowedHosts: "all",
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
