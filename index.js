const express = require('express')
const webSocket = require('ws')

const app = express()
const wss = new webSocket.Server({ 
    port: 8081
})

const port = 8080
const lobbys = new Map()
const clients = new Map()

app.use(express.static(`${__dirname}/public`))

app.get('/', (req, res) => {
    res.sendFile('public/index.html')
})

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})

wss.on('connection', (socket) => {
    const client = {
        username: "",
        lobbyid: ""
    }
    clients.set(socket, client)
    console.log('New client!')

    socket.on('message', (message) => {
        console.log(`New message from a client: ${message}`)
        message = JSON.parse(message)
        switch (message.type) {
            case 'make-lobby': // {type: "make-lobby", username: "remedy", lobbyid: "53"}
                // random lobby id if it wasn't filled in
                if (message.lobbyid == "") {
                    message.lobbyid = Math.floor(Math.random() * 100).toString()
                    console.log(`Since the id field was empty, I've chosen it as ${message.lobbyid}!`)
                }
                // check if lobby id is already used
                if (lobbys.get(message.lobbyid) != null) {
                    socket.send(JSON.stringify({
                        type: 'make-lobby-refused'
                    }))
                    break
                }

                client.username = message.username
                client.lobbyid = message.lobbyid
                lobbys.set(message.lobbyid, {
                    players: [socket]
                })
                socket.send(JSON.stringify({
                    type: 'make-lobby-accepted',
                    lobbyid: message.lobbyid
                }))
                break
            
            case 'search-lobbys': // {type: "search-lobbys", username: "remedy"}
                client.username = message.username
            case 'refresh-lobbys': // {type: "refresh-lobbys"}
                socket.send(JSON.stringify({
                    type: 'lobbys-list',
                    list: [... lobbys.keys()]
                }))
                break
            
            case 'join-lobby': // {type: "join-lobby", lobbyid: "53"}
                client.lobbyid = message.lobbyid
                lobbys.get(message.lobbyid).players.push(socket)

                if (lobbys.get(message.lobbyid).players.length < 2) {
                    break
                } 

                // begin lobby if there is 2 players
                for (let i = 0; i < lobbys.get(message.lobbyid).players.length; i++) {
                    let playerSocket = lobbys.get(message.lobbyid).players[i]
                    let player = clients.get(playerSocket)
                    player.hand = draw(OPENING_DRAW_AMOUNT)
                    player.playedCards = []
                    playerSocket.send(JSON.stringify({
                        type: 'game-start',
                        opponentHand: OPENING_DRAW_AMOUNT,
                        playerHand: player.hand
                    }))
                    console.log(`Player ${i + 1}'s hand: ${player.hand}`)
                }
                break

            case 'play-card': // {type: "play-card", card: 7}
                let playedCard = client.hand[message.card]
                console.log(`The played card ended up being ${playedCard}.`)
                
                // check if played card is legal
                if (message.card < 0 || message.card >= client.hand.length || playedCard == undefined) {
                    socket.send(JSON.stringify({
                        type: 'play-card-refused'
                    }))
                    return
                }

                let opponentSocket = lobbys.get(client.lobbyid).players.find(element => element != socket)
                let opponentPlayedCards = clients.get(opponentSocket).playedCards
                switch (playedCard) {
                    case 'Bolt':
                        if (opponentPlayedCards.length == 0) {
                            socket.send(JSON.stringify({
                                type: 'play-card-refused'
                            }))
                            return
                        }

                        let i = opponentPlayedCards.length - 1
                        opponentPlayedCards[i][1] = 0
                        break

                    case 'Mirror':
                        let tmp = opponentPlayedCards
                        opponentPlayedCards = client.playedCards
                        client.playedCards = tmp
                        break

                    default: // number cards
                        client.playedCards.push([playedCard, 1])
                        break
                }
                client.hand[message.card][1] = -1
                socket.send(JSON.stringify({
                    type: 'play-card-accepted',
                    card: playedCard
                }))
                opponentSocket.send(JSON.stringify({
                    type: 'play-card-opponent',
                    cardIndex: message.card,
                    card: playedCard
                }))

                let opponentValue = getPlayedCardsValue(opponentPlayedCards)
                let playerValue = getPlayedCardsValue(client.playedCards)
                if (playerValue < opponentValue) {
                    socket.send(JSON.stringify({
                        type: 'loose'
                    }))
                    opponentSocket.send(JSON.stringify({
                        type: 'win'
                    }))
                }
                else if (playerValue == opponentValue) {
                    let playerCard = "", opponentCard = ""
                    while (playerCard == opponentCard) {
                        playerCard = drawOne()
                        opponentCard = drawOne()
                        socket.send(JSON.stringify({
                            type: 'tie',
                            card: playerCard
                        }))
                        opponentSocket.send(JSON.stringify({
                            type: 'tie',
                            card: opponentCard
                        }))
                    }
                    client.playedCards = [playerCard]
                    opponentPlayedCards = [opponentCard]
                }
                break

            default: 
                console.log('Request not supported.')
                break
        }
    })

    socket.on('close', () => {
        console.log(`A client is gone! Goodbye ${JSON.stringify(client)}!`)

        if (lobbys.get(client.lobbyid) != null && lobbys.get(client.lobbyid).players.length <= 1) {
            lobbys.delete(client.lobbyid)
            console.log(`${client.lobbyid} has been deleted.`)
        }
        clients.delete(socket)
    })
})

// game logic
const OPENING_DRAW_AMOUNT = 10
const CARDS = {
    '1' : 1, 
    '2' : 2, 
    '3' : 3, 
    '4' : 4, 
    '5' : 5, 
    '6' : 6, 
    '7' : 7, 
    'Bolt' : 1, 
    'Mirror' : 1
}

function drawOne() {
    return Object.keys(CARDS)[Math.floor(Math.random() * Object.keys(CARDS).length)]
}

function draw(n) {
    drawnCards = []
    for (let i = 0; i < n; i++) {
        drawnCards.push(drawOne())
    }
    return drawnCards
}

function tie(player1Id, player2Id) {
    playersPlayedCards = [[], []]
    do {
        playersPlayedCards[0] = [drawOne(), 1]
        playersPlayedCards[1] = [drawOne(), 1]
        clients.get(player1Id).socket
    }
    while (playersPlayedCards[0] == playersPlayedCards[1])

}

function getPlayedCardsValue(playedCards) {
    let total = 0
    for (let i = 0; i < playedCards.length; i++) {
        if (playedCards[i][1] == 1) {
            total += CARDS[playedCards[i][0]]
        }
    } 
    return total
}