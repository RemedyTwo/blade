const CLIENTS = new Map()
/* 
{
    username: 'remedy',
    lobbyid: '59',
    deck: ['1', '2', '3'],
    hand: ['1', '2', '3', '4'],
    playedCards: [['5', 1], ['6', 1]]
} 
*/
const LOBBYS = new Map()
/* 
{
    lobbyid: '59',
    players: [socket1, socket2],
    begin: 0/1
} 
*/

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
        // checks message validity
        if (!('type' in data) || !('username' in data) || !('lobbyid' in data)) {
            console.log(`Invalid message: ${data}`)
            return
        }
    
        // random lobby id if it wasn't filled in
        if (data.lobbyid == '') {
            // TODO: make the random id be filled with characters as well
            do { 
                data.lobbyid = Math.floor(Math.random() * 100).toString()
            }
            while (LOBBYS.get(data.lobbyid) != null) 
        }
    
        // check if lobby id is already used
        else if (LOBBYS.get(data.lobbyid) != null) {
            socket.send(JSON.stringify({
                type: 'make-lobby-refused'
            }))
            return
        }
    
        CLIENTS.get(socket).username = data.username
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.set(data.lobbyid, {players: [socket]})
        socket.send(JSON.stringify({
            type: 'make-lobby-accepted',
            lobbyid: data.lobbyid
        }))
    },
    
    'search-lobbys': (data, socket) => { // {type: 'search-lobbys', username: 'remedy'}
        CLIENTS.get(socket).username = data.username
        MESSAGE_INTERPRETATION['refresh-lobbys'](data, socket)
    },

    'refresh-lobbys': (data, socket) => { // {type: 'refresh-lobbys'}
        socket.send(JSON.stringify({
            type: 'lobbys-list',
            list: [... LOBBYS.keys()].reverse()
        }))
    },

    'join-lobby': (data, socket) => {  // {type: 'join-lobby', lobbyid: '53'}
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

    'play-card': (data, playerSocket) => { // {type: 'play-card', cardIndex: 7}
        let currentLobby = LOBBYS.get(CLIENTS.get(playerSocket).lobbyid)
        let opponentSocket = currentLobby.players[1 - currentLobby.turn]

        // check if played card is legal and it is in fact player's turn
        if (data.cardIndex < 0 || data.cardIndex >= CLIENTS.get(playerSocket).hand.length || playerSocket != currentLobby.players[currentLobby.turn]) {
            playerSocket.send(JSON.stringify({
                type: 'play-card-refused',
                cardIndex: data.cardIndex 
            }))
            return
        }
    
        let playedCard = CLIENTS.get(playerSocket).hand[data.cardIndex]
    
        // put card in playedCards
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
                let tmp = CLIENTS.get(opponentSocket).playedCards
                CLIENTS.get(opponentSocket).playedCards = CLIENTS.get(playerSocket).playedCards
                CLIENTS.get(playerSocket).playedCards = tmp
                break
    
            default: // number cards
                CLIENTS.get(playerSocket).playedCards.push([playedCard, 1])
                break
        }
        CLIENTS.get(playerSocket).hand.splice(data.cardIndex, 1)
        
        let playerValue = getPlayedCardsTotal(playerSocket), opponentValue = getPlayedCardsTotal(opponentSocket)
        playerSocket.send(JSON.stringify({
            type: 'play-card-accepted',
            cardIndex: data.cardIndex,
            card: playedCard,
            total: playerValue
        }))
        opponentSocket.send(JSON.stringify({
            type: 'play-card-opponent',
            cardIndex: data.cardIndex,
            card: playedCard,
            total: playerValue
        }))

        // checks if someone won or tie
        if (playerValue < opponentValue) {
            playerSocket.send(JSON.stringify({
                type: 'loose'
            }))
            opponentSocket.send(JSON.stringify({
                type: 'win'
            }))
        }
        else if (playerValue == opponentValue) {
            tie(CLIENTS.get(playerSocket).lobbyid)
        }
        else {
            currentLobby.turn = 1 - currentLobby.turn
            currentLobby.players[currentLobby.turn].send(JSON.stringify({
                type: 'play'
            }))
        }

        // switch turn

    }
}

function draw(socket, n = 1) {
    if (CLIENTS.get(socket).deck.length <= 0) {
        return null
    }
    drawnCard = CLIENTS.get(socket).deck.splice(0, n)
    return n == 1 ? drawnCard[0] : drawnCard
}

function tie(lobbyid) {
    sockets = LOBBYS.get(lobbyid).players
    do {
        var player1Draw = draw(sockets[0]), player2Draw = draw(sockets[1])
        if (CARDS[player1Draw] == CARDS[player2Draw]) {
            sockets[0].send(JSON.stringify({
                type: 'draw-tie',
                playerCard: player1Draw,
                opponentCard: player2Draw
            }))
            sockets[1].send(JSON.stringify({
                type: 'draw-tie',
                playerCard: player2Draw,
                opponentCard: player1Draw 
            }))
        }
    } while (CARDS[player1Draw] == CARDS[player2Draw])
    CLIENTS.get(sockets[0]).playedCards.push([player1Draw, 1])
    CLIENTS.get(sockets[1]).playedCards.push([player2Draw, 1])
    sockets[0].send(JSON.stringify({
        type: 'draw-player',
        card: player1Draw,
        total: CARDS[player1Draw]
    }))
    sockets[0].send(JSON.stringify({
        type: 'draw-opponent',
        card: player2Draw,
        total: CARDS[player2Draw]
    }))
    sockets[1].send(JSON.stringify({
        type: 'draw-player',
        card: player2Draw,
        total: CARDS[player2Draw]
    }))
    sockets[1].send(JSON.stringify({
        type: 'draw-opponent',
        card: player1Draw,
        total: CARDS[player1Draw]
    }))
    LOBBYS.get(lobbyid).turn = CARDS[player1Draw] > CARDS[player2Draw] ? 1 : 0
    sockets[LOBBYS.get(lobbyid).turn].send(JSON.stringify({
        type: 'play'
    }))
}

function getPlayedCardsTotal(socket) {
    let playedCards = CLIENTS.get(socket).playedCards
    let value = 0
    for (let card of playedCards)
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
        console.error(error)
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