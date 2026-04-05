const express = require('express')
const path = require('path')

function startServer(port = 3000) {
  const app = express()

  app.use(express.static(path.join(__dirname)))

  return new Promise(resolve => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log('Servidor interno en:')
      console.log(`http://127.0.0.1:${port}`)
      resolve(server)
    })
  })
}

if (require.main === module) {
  startServer()
}

module.exports = startServer
