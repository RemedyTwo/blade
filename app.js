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
    'Mirror' : 1
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

        let player1Socket = LOBBYS.get(data.lobbyid).players[0], player2Socket = LOBBYS.get(data.lobbyid).players[1]
        let player1Draw = null, player2Draw = null
        // set first draw
        while (player1Draw == player2Draw) {
            player1Draw = draw(player1Socket), player2Draw = draw(player2Socket)
            if (CARDS[player1Draw] == CARDS[player2Draw]) {
                player1Socket.send(JSON.stringify({
                    type: 'draw-tie',
                    playerCard: player1Draw,
                    opponentCard: player2Draw
                }))
                player2Socket.send(JSON.stringify({
                    type: 'draw-tie',
                    playerCard: player2Draw,
                    opponentCard: player1Draw 
                }))
            }
            else {
                // set first player
                LOBBYS.get(data.lobbyid).turn = CARDS[player1Draw] > CARDS[player2Draw] ? 0 : 1
                player1Socket.send(JSON.stringify({
                    type: 'draw-player',
                    card: player1Draw,
                    begin: LOBBYS.get(data.lobbyid).turn == 0 ? false : true
                }))
                player1Socket.send(JSON.stringify({
                    type: 'draw-opponent',
                    card: player2Draw
                }))
                player2Socket.send(JSON.stringify({
                    type: 'draw-player',
                    card: player2Draw,
                    begin: LOBBYS.get(data.lobbyid).turn == 0 ? true : false
                }))
                player2Socket.send(JSON.stringify({
                    type: 'draw-opponent',
                    card: player1Draw
                }))
            }
        }
        
        
    },

    'play-card': (data, socket) => { // {type: 'play-card', cardIndex: 7}
        // check if played card is legal and player's turn is good
        if (data.cardIndex < 0 || data.cardIndex >= CLIENTS.get(socket).hand.length || socket == LOBBYS.get(CLIENTS.get(socket).lobbyid).players[LOBBYS.get(CLIENTS.get(socket).lobbyid).turn]) {
            socket.send(JSON.stringify({
                type: 'play-card-refused',
                cardIndex: data.cardIndex 
            }))
            return
        }
    
        let playedCard = CLIENTS.get(socket).hand[data.cardIndex]
        let opponentSocket = LOBBYS.get(CLIENTS.get(socket).lobbyid).players.find(element => element != socket)
    
        switch (playedCard) {
            case 'Bolt':
                if (CLIENTS.get(opponentSocket).playedCards.length == 0) {
                    return socket.send(JSON.stringify({
                        type: 'play-card-refused',
                        cardIndex: data.cardIndex
                    }))
                    
                }
                CLIENTS.get(opponentSocket).playedCards[CLIENTS.get(opponentSocket).playedCards.length - 1][1] = 0
                break
    
            case 'Mirror':
                let tmp = CLIENTS.get(opponentSocket).playedCards
                CLIENTS.get(opponentSocket).playedCards = CLIENTS.get(socket).playedCards
                CLIENTS.get(socket).playedCards = tmp
                break
    
            default: // number cards
                CLIENTS.get(socket).playedCards.push([playedCard, 1])
                break
        }
        CLIENTS.get(socket).hand.splice(data.cardIndex, 1)
        socket.send(JSON.stringify({
            type: 'play-card-accepted',
            cardIndex: data.cardIndex,
            card: playedCard
        }))
        opponentSocket.send(JSON.stringify({
            type: 'play-card-opponent',
            cardIndex: data.cardIndex,
            card: playedCard
        }))
        // switch turn
        LOBBYS.get(CLIENTS.get(socket).lobbyid).turn = 1 - LOBBYS.get(CLIENTS.get(socket).lobbyid).turn
    
        let opponentValue = getPlayedCardsValue(CLIENTS.get(opponentSocket).playedCards)
        let playerValue = getPlayedCardsValue(CLIENTS.get(socket).playedCards)
        if (playerValue < opponentValue) {
            socket.send(JSON.stringify({
                type: 'loose'
            }))
            opponentSocket.send(JSON.stringify({
                type: 'win'
            }))
        }
        else if (playerValue == opponentValue) {
            let playerCard = '', opponentCard = ''
            while (playerCard == opponentCard) {
                playerCard = draw(playerSocket)
                opponentCard = draw(opponentSocket)
                socket.send(JSON.stringify({
                    type: 'tie',
                    card: playerCard
                }))
                opponentSocket.send(JSON.stringify({
                    type: 'tie',
                    card: opponentCard
                }))
            }
            CLIENTS.get(socket).playedCards = [playerCard]
            opponentPlayedCards = [opponentCard]
        }
    },
}

function draw(socket, n = 1) {
    drawnCard = CLIENTS.get(socket).deck.splice(0, n)
    return n == 1 ? drawnCard[0] : drawnCard
}

function getPlayedCardsValue(playedCards) {
    let value = 0
    for (cardDiv of playedCards)
        value += CARDS[cardDiv]
    return value
}

function newConnection(socket) {
    console.log('New client connected.')
    CLIENTS.set(socket, {username: '', lobbyid: ''})
}

function interpretMessage(data, socket) {
    console.log(data)
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