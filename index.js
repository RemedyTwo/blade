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
    game.CLIENTS.set(socket, {username: "", lobbyid: ""})
    console.log('New client!')

    socket.on('message', (message) => {
        console.log(`New message from a client: ${message}`)
        game.interpretMessage(message, socket)
    })

    socket.on('close', () => {
        console.log(`A client is gone! Goodbye ${JSON.stringify(game.CLIENTS.get(socket))}!`)

        if (game.LOBBYS.get(game.CLIENTS.get(socket).lobbyid) != null && game.LOBBYS.get(game.CLIENTS.get(socket).lobbyid).players.length <= 1) {
            lobbys.delete(game.CLIENTS.get(socket).lobbyid)
            console.log(`${game.CLIENTS.get(socket).lobbyid} has been deleted.`)
        }
        game.CLIENTS.delete(socket)
    })
})