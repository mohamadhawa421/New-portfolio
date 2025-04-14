module.exports = {
    // ...
    module: {
      rules: [
        {
          test: /\.(mp3|wav|ogg)$/,
          use: {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
            },
          },
        },
      ],
    },
  };