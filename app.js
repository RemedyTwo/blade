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
    turn: 0/1
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
const DECK = new Array(6).fill(Object.keys(CARDS)).flat()

const MESSAGE_INTERPRETATION = {
    'make-lobby': function(data, socket) { // {type: 'make-lobby', username: 'remedy', lobbyid: '53'}
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
            socket.send(JSON.stringify({type: 'make-lobby-refused'}))
            return
        }
    
        CLIENTS.get(socket).username = data.username
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.set(data.lobbyid, {players: [socket]})
        socket.send(JSON.stringify({type: 'make-lobby-accepted', lobbyid: data.lobbyid}))
    },
    
    'search-lobbys': function(data, socket) { // {type: 'search-lobbys', username: 'remedy'}
        CLIENTS.get(socket).username = data.username
        MESSAGE_INTERPRETATION['refresh-lobbys'](data, socket)
    },

    'refresh-lobbys': function(data, socket) { // {type: 'refresh-lobbys'}
        socket.send(JSON.stringify({type: 'lobbys-list', list: [... LOBBYS.keys()]}))
    },

    'join-lobby': function(data, socket) {  // {type: 'join-lobby', lobbyid: '53'}
        if (LOBBYS.get(data.lobbyid).players.length <= 0) {
            console.log(`Trying to join an empty lobby: ${data}`)
            return
        } 
    
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.get(data.lobbyid).players.push(socket)
    
        for (playerSocket of LOBBYS.get(data.lobbyid).players) {
            CLIENTS.get(playerSocket).deck = [...DECK].sort(() => Math.random() - 0.5);
            CLIENTS.get(playerSocket).hand = draw(playerSocket, OPENING_DRAW_AMOUNT).sort()
            CLIENTS.get(playerSocket).playedCards = []
            playerSocket.send(JSON.stringify({
                type: 'game-start',
                playerHand: CLIENTS.get(playerSocket).hand,
                opponentHand: OPENING_DRAW_AMOUNT
            }))
            console.log(`Player's hand: ${CLIENTS.get(playerSocket).hand}`)
        }
    },

    'play-card': function(data, socket) { // {type: 'play-card', cardIndex: 7}
        // check if played card is legal
        if (data.cardIndex < 0 || data.cardIndex >= CLIENTS.get(socket).hand.length) {
            socket.send(JSON.stringify({type: 'play-card-refused', cardIndex: data.cardIndex}))
            return
        }
    
        let playedCard = CLIENTS.get(socket).hand[data.cardIndex]
        let opponentSocket = LOBBYS.get(CLIENTS.get(socket).lobbyid).players.find(element => element != socket)
    
        switch (playedCard) {
            case 'Bolt':
                if (CLIENTS.get(opponentSocket).playedCards.length == 0) {
                    socket.send(JSON.stringify({type: 'play-card-refused', cardIndex: data.cardIndex}))
                    return
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
            card: playedCard,
            playerHand: CLIENTS.get(socket).hand 
        }))
        opponentSocket.send(JSON.stringify({
            type: 'play-card-opponent',
            cardIndex: data.cardIndex,
            card: playedCard
        }))
    
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
            client.playedCards = [playerCard]
            opponentPlayedCards = [opponentCard]
        }
    },
}

function draw(socket, n = 1) {
    return CLIENTS.get(socket).deck.splice(0, n)
}

function getPlayedCardsValue(playedCards) {
    let value = 0
    for (card of playedCards)
        value += CARDS[card]
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
        console.log('Request not supported.')
        console.log(error)
    }
}

function closeConnection(socket) {
    console.log('A client is gone.')

    if (LOBBYS.get(CLIENTS.get(socket).lobbyid) != null && LOBBYS.get(CLIENTS.get(socket).lobbyid).players.length <= 1) {
        lobbys.delete(CLIENTS.get(socket).lobbyid)
        console.log(`${CLIENTS.get(socket).lobbyid} has been deleted.`)
    }
    CLIENTS.delete(socket)
}

module.exports = { newConnection, interpretMessage, closeConnection }