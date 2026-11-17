module.exports = {
  publicPath: "./",
  transpileDependencies: ["axios"],
  configureWebpack: {
    optimization: {
      splitChunks: {
        maxSize: 500000,
      },
    },
  },
  chainWebpack: (config) => {
    config.module
      .rule("images")
      .use("url-loader")
      .loader("url-loader")
      .tap((options) => {
        // Do not base64 encode image URLs so the module logo file is always emitted
        options.limit = -1;
        return options;
      });
  },
  css: {
    loaderOptions: {
      sass: {
        sassOptions: {
          silenceDeprecations: [
            "import",
            "global-builtin",
            "color-functions",
            "if-function",
            "legacy-js-api",
          ],
        },
      },
    },
  },
};
