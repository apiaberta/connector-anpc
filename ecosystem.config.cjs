module.exports = {
  apps: [{
    name: 'apiaberta-anpc',
    script: 'src/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
      MONGO_URI: 'mongodb://localhost:27017/apiaberta-anpc'
    }
  }]
}
