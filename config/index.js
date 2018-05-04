module.exports = {
  development: {
    httpPort: 8080,
    secretKey: process.env.SECRET_KEY
  },
  test: {
    httpPort: 8080,
    secretKey: process.env.SECRET_KEY
  },
  production: {
    httpPort: 8080,
    secretKey: process.env.SECRET_KEY
  }
};
