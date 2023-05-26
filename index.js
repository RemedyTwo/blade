const express = require('express')
const webSocket = require('ws')
const game = require('./app')

const app = express()
const wss = new webSocket.Server({
    port: 8081
})

const port = 7890
const host = '0.0.0.0'

app.use(express.static(`${__dirname}/public`))

app.get('/', (req, res) => {
    res.sendFile('public/index.html')
})

app.listen(port, host, () => {
    console.log(`http://${host}:${port}`)
})

wss.on('connection', (socket) => {
    game.newConnection(socket)

    socket.on('message', (message) => {
        let data = JSON.parse(message)
        console.log(data)
        game.interpretMessage(data, socket)
    })

    socket.on('close', () => {
        game.closeConnection(socket)
    })
})