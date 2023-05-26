const CLIENTS = new Map() /* { username: 'remedy', lobbyid: '59', deck: ['1', '2', '3'], hand: ['1', '2', '3', '4'], playedCards: [['5', 1], ['6', 1]] } */
const LOBBYS = new Map() /* { lobbyid: '59', players: [socket1, socket2] } */

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
    'Mirror' : 1,
    'Blast' : 1,
    'Force': 1
}
const PER_CARD_AMOUNT = 6
const DECK = new Array(PER_CARD_AMOUNT).fill(Object.keys(CARDS)).flat()

const MESSAGE_INTERPRETATION = {
    'make-lobby': (data, socket) => { // {type: 'make-lobby', username: 'remedy', lobbyid: '53'}
        // random lobby id if it wasn't filled in
        if (data.lobbyid == '') {
            do { 
                data.lobbyid = Math.floor(Math.random() * 100).toString() // TODO: make the random id be filled with characters as well
            } while (LOBBYS.get(data.lobbyid) != null) 
        }
    
        // check if lobby id is already used
        else if (LOBBYS.get(data.lobbyid) != null) {
            return socket.send(JSON.stringify({
                type: 'make-lobby-refused'
            }))
        }
    
        CLIENTS.get(socket).username = data.username
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.set(data.lobbyid, {players: [socket]})
        socket.send(JSON.stringify({
            type: 'make-lobby-accepted',
            lobbyid: data.lobbyid
        }))
    },
    
    'search-lobbys': (data, socket) => { // { type: 'search-lobbys', username: 'remedy' }
        CLIENTS.get(socket).username = data.username
        MESSAGE_INTERPRETATION['refresh-lobbys'](data, socket)
    },

    'refresh-lobbys': (_, socket) => { // { type: 'refresh-lobbys' }
        socket.send(JSON.stringify({
            type: 'lobbys-list',
            list: [... LOBBYS.keys()].reverse()
        }))
    },

    'join-lobby': (data, socket) => {  // { type: 'join-lobby', lobbyid: '53' }
        if (LOBBYS.get(data.lobbyid).players.length <= 0) {
            console.log(`Trying to join an empty lobby: ${data}`)
            return
        } 
    
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.get(data.lobbyid).players.push(socket)
    
        // set player hands
        for (playerSocket of LOBBYS.get(data.lobbyid).players) {
            CLIENTS.get(playerSocket).deck = [...DECK].sort(() => Math.random() - 0.5);
            CLIENTS.get(playerSocket).hand = draw(playerSocket, OPENING_DRAW_AMOUNT).sort()
            CLIENTS.get(playerSocket).playedCards = []
            playerSocket.send(JSON.stringify({
                type: 'game-start', 
                playerHand: CLIENTS.get(playerSocket).hand,
                opponentHand: OPENING_DRAW_AMOUNT
            }))
        }

        tie(data.lobbyid)
    },

    'delete-lobby': (_, socket) => { // { type: 'delete-lobby' }
        LOBBYS.delete(CLIENTS.get(socket).lobbyid)
    },

    'play-card': (data, playerSocket) => { // { type: 'play-card', cardIndex: 7 }
        const currentLobby = LOBBYS.get(CLIENTS.get(playerSocket).lobbyid)

        // check legality of the played card or if it is in fact the player's turn
        if (data.cardIndex < 0 || data.cardIndex >= CLIENTS.get(playerSocket).hand.length || playerSocket != currentLobby.players[currentLobby.turn]) {
            return playerSocket.send(JSON.stringify({
                type: 'play-card-refused',
                cardIndex: data.cardIndex 
            }))
        }

        const opponentSocket = currentLobby.players[1 - currentLobby.turn]
        const playedCard = CLIENTS.get(playerSocket).hand[data.cardIndex]
        switch (playedCard) {
            case 'Bolt':
                if (CLIENTS.get(opponentSocket).playedCards.length == 0) {
                    return playerSocket.send(JSON.stringify({
                        type: 'play-card-refused',
                        cardIndex: data.cardIndex
                    }))
                }
                CLIENTS.get(opponentSocket).playedCards[CLIENTS.get(opponentSocket).playedCards.length - 1][1] = 0
                break
    
            case 'Mirror':
                const tmp = CLIENTS.get(opponentSocket).playedCards
                CLIENTS.get(opponentSocket).playedCards = CLIENTS.get(playerSocket).playedCards
                CLIENTS.get(playerSocket).playedCards = tmp
                break

            case 'Blast':
                // TODO: fill
                break
            
            case 'Force':
                // TODO: fill
                break
    
            default: // number cards
                CLIENTS.get(playerSocket).playedCards.push([playedCard, 1])
                break
        }
        CLIENTS.get(playerSocket).hand.splice(data.cardIndex, 1)
        
        const playerValue = getPlayedCardsTotal(playerSocket), opponentValue = getPlayedCardsTotal(opponentSocket)
        playCard(playerSocket, opponentSocket, data.cardIndex, playedCard, playerValue)
        if (playerValue < opponentValue) {
            playerSocket.send(JSON.stringify({
                type: 'loose'
            }))
            opponentSocket.send(JSON.stringify({
                type: 'win'
            }))
            return LOBBYS.delete(CLIENTS.get(playerSocket).lobbyid)
        }
        else if (playerValue == opponentValue) {
            return tie(CLIENTS.get(playerSocket).lobbyid)
        }
        currentLobby.turn = 1 - currentLobby.turn
        currentLobby.players[currentLobby.turn].send(JSON.stringify({
            type: 'play'
        }))
    }
}

function draw(socket, n = 1) {
    if (CLIENTS.get(socket).deck.length <= 0) {
        return null
    }
    const drawnCard = CLIENTS.get(socket).deck.splice(0, n)
    return n == 1 ? drawnCard[0] : drawnCard
}

function playCard(playerSocket, opponentSocket, cardIndex, playedCard, playerValue) {
    playerSocket.send(JSON.stringify({
        type: 'play-card-accepted',
        cardIndex: cardIndex,
        card: playedCard,
        total: playerValue
    }))
    opponentSocket.send(JSON.stringify({
        type: 'play-card-opponent',
        cardIndex: cardIndex,
        card: playedCard,
        total: playerValue
    }))
}

function drawCard(playerSocket, opponentSocket, playedCard) {
    playerSocket.send(JSON.stringify({
        type: 'draw-player',
        card: playedCard,
        total: CARDS[playedCard]
    }))
    opponentSocket.send(JSON.stringify({
        type: 'draw-opponent',
        card: playedCard,
        total: CARDS[playedCard]
    }))
}

function tie(lobbyid) {
    const sockets = LOBBYS.get(lobbyid).players
    do {
        sockets[0].send(JSON.stringify({
            type: 'tie'
        }))
        sockets[1].send(JSON.stringify({
            type: 'tie',
        }))

        var player1Draw = draw(sockets[0]), player2Draw = draw(sockets[1])
        drawCard(sockets[0], sockets[1], player1Draw)
        drawCard(sockets[1], sockets[0], player2Draw)
    } while (CARDS[player1Draw] == CARDS[player2Draw])
    CLIENTS.get(sockets[0]).playedCards.push([player1Draw, 1])
    CLIENTS.get(sockets[1]).playedCards.push([player2Draw, 1])
    
    LOBBYS.get(lobbyid).turn = CARDS[player1Draw] > CARDS[player2Draw] ? 1 : 0
    sockets[LOBBYS.get(lobbyid).turn].send(JSON.stringify({
        type: 'play'
    }))
}

function getPlayedCardsTotal(socket) {
    const playedCards = CLIENTS.get(socket).playedCards
    let value = 0
    for (const card of playedCards)
        value += CARDS[card[0]]
    return value
}

function newConnection(socket) {
    console.log('New client connected.')
    CLIENTS.set(socket, {username: '', lobbyid: ''})
}

function interpretMessage(data, socket) {
    try {
        MESSAGE_INTERPRETATION[data.type](data, socket)
    }
    catch (error) {
        console.error('Request not supported.')
    }
}

function closeConnection(socket) {
    console.log('A client is gone.')

    if (LOBBYS.get(CLIENTS.get(socket).lobbyid) != null && LOBBYS.get(CLIENTS.get(socket).lobbyid).players.length <= 1) {
        LOBBYS.delete(CLIENTS.get(socket).lobbyid)
        console.log(`${CLIENTS.get(socket).lobbyid} has been deleted.`)
    }
    CLIENTS.delete(socket)
}

module.exports = { newConnection, interpretMessage, closeConnection }