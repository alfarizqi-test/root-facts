const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
    new WorkboxWebpackPlugin.GenerateSW({
      swDest: "service-worker.js",
      clientsClaim: true,
      skipWaiting: true,
      maximumFileSizeToCacheInBytes: 150 * 1024 * 1024,
      runtimeCaching: [
        {
          // Cache model files
          urlPattern: /\/model\//,
          handler: "CacheFirst",
          options: {
            cacheName: "model-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          // Cache HuggingFace/CDN model files
          urlPattern: /^https:\/\/huggingface\.co\//,
          handler: "CacheFirst",
          options: {
            cacheName: "hf-model-cache",
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          // Cache Google Fonts
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "google-fonts",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
        {
          // Cache Lucide icons CDN
          urlPattern: /^https:\/\/unpkg\.com\//,
          handler: "CacheFirst",
          options: {
            cacheName: "cdn-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    }),
  ],
});
