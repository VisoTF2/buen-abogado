const express = require("express");
const path = require("path");

function startServer() {
  const app = express();

  app.use(express.static(path.join(__dirname)));

  return new Promise((resolve) => {
    const server = app.listen(3000, "127.0.0.1", () => {
      console.log("Servidor interno en:");
      console.log("http://127.0.0.1:3000");

      resolve(server);
    });
  });
}

module.exports = startServer;