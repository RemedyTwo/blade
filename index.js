const express = require('express')
const webSocket = require('ws')
const game = require('./app')

const app = express()
const wss = new webSocket.Server({
    port: 8081
})

const port = 8080

app.use(express.static(`${__dirname}/public`))

app.get('/', (req, res) => {
    res.sendFile('public/index.html')
})

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})

wss.on('connection', (socket) => {
    game.newConnection(socket)

    socket.on('message', (message) => {
        game.interpretMessage(JSON.parse(message), socket)
    })

    socket.on('close', () => {
        game.closeConnection(socket)
    })
})