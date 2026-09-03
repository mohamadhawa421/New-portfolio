module.exports = () => ({
  // Local filesystem uploads are the default. To move media to S3/Cloudinary in
  // production, install the matching provider package and configure it here.
  upload: {
    config: {
      sizeLimit: 20 * 1024 * 1024,
    },
  },
});
