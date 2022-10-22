const CLIENTS = new Map()
const LOBBYS = new Map()

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

const MESSAGE_INTERPRETATION = {
    makeLobby: function(data, socket) { // {type: 'make-lobby', username: 'remedy', lobbyid: '53'}
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
        if (LOBBYS.get(data.lobbyid) != null) {
            socket.send(JSON.stringify({type: 'make-lobby-refused'}))
            return
        }
    
        CLIENTS.get(socket).username = data.username
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.set(data.lobbyid, {players: [socket]})
        socket.send(JSON.stringify({type: 'make-lobby-accepted', lobbyid: data.lobbyid}))
    },
    
    searchLobby: function(data, socket) { // {type: 'search-lobbys', username: 'remedy'}
        CLIENTS.get(socket).username = data.username
        MESSAGE_INTERPRETATION.refreshLobby(data, socket)
    },

    refreshLobby: function(data, socket) { // {type: 'refresh-lobbys'}
        socket.send(JSON.stringify({type: 'lobbys-list', list: [... LOBBYS.keys()]}))
    },

    joinLobby: function(data, socket) {  // {type: 'join-lobby', lobbyid: '53'}
        if (LOBBYS.get(data.lobbyid).players.length <= 0) {
            console.log(`Trying to join an empty lobby: ${data}`)
            return
        } 
    
        CLIENTS.get(socket).lobbyid = data.lobbyid
        LOBBYS.get(data.lobbyid).players.push(socket)
    
        for (player of LOBBYS.get(data.lobbyid).players) {
            CLIENTS.get(player).hand = draw(OPENING_DRAW_AMOUNT)
            CLIENTS.get(player).playedCards = []
            player.send(JSON.stringify({
                type: 'game-start',
                playerHand: CLIENTS.get(player).hand,
                opponentHand: OPENING_DRAW_AMOUNT
            }))
            console.log(`Player ${i + 1}'s hand: ${CLIENTS.get(player).hand}`)
        }
    },

    playCard: function(data, socket) { // {type: 'play-card', cardIndex: 7}
        // check if played card is legal
        if (data.cardIndex < 0 || data.cardIndex >= CLIENTS.get(socket).hand.length) {
            socket.send(JSON.stringify({type: 'play-card-refused'}))
            return
        }
    
        let playedCard = CLIENTS.get(socket).hand[data.cardIndex]
        let opponentSocket = LOBBYS.get(CLIENTS.get(socket).lobbyid).players.find(element => element != socket)
    
        switch (playedCard) {
            case 'Bolt':
                if (CLIENTS.get(opponentSocket).playedCards.length == 0) {
                    socket.send(JSON.stringify({type: 'play-card-refused'}))
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
        CLIENTS.get(socket).hand.splice(data.cardIndex)
        socket.send(JSON.stringify({
            type: 'play-card-accepted',
            card: playedCard
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
    },
}

function drawOne() {
    return Object.keys(CARDS)[Math.floor(Math.random() * Object.keys(CARDS).length)]
}

function draw(n) {
    drawnCards = []
    for (let i = 0; i < n; i++)
        drawnCards.push(drawOne())
    return drawnCards
}

function tie() {
    playersPlayedCards = [[], []]
    do {
        playersPlayedCards[0][0] = [drawOne(), 1]
        playersPlayedCards[1][0] = [drawOne(), 1]
    }
    while (playersPlayedCards[0] == playersPlayedCards[1])
}

function getPlayedCardsValue() {
    let total = 0
    let value = []
    for (let i = 0; i < 2; i++) {
        total = 0
        for (let j = 0; j < playersPlayedCards[i].length; j++) {
            if (playersPlayedCards[i][j][1] == 1)
                total += CARDS[playersPlayedCards[i][j][0]]
        } 
        value.push(total)
    }
    return value
}

function gameBegin() {
    playersHand = [draw(OPENING_DRAW_AMOUNT), draw(OPENING_DRAW_AMOUNT)]

    tie()
    let playedCardsValue = getPlayedCardsValue()
    let currentPlayer = playedCardsValue[0] > playedCardsValue[1] ? 0 : 1
    let playedCardIndex = -1
    let tmp = 0
    while (playersHand[0].length > 0 || playersHand[1].length > 0) {
        // TODO: get user input

        // check user input legality
        if (playedCardIndex < 0 || playedCardIndex > playersHand[currentPlayer].length) {
            throw "L'index de la carte joué est illégal."
        }

        // plays the cards
        playersPlayedCards[currentPlayer].push(playersHand[currentPlayer][playedCardIndex])
        playersHand[currentPlayer].splice(playedCardIndex, 1)
        if (playersHand[currentPlayer][playedCardIndex] == 'Mirror') {
            tmp = playersPlayedCards[currentPlayer]
            playersPlayedCards[currentPlayer] = playersPlayedCards[1 - currentPlayer]
            playersPlayedCards[1 - currentPlayer] = tmp 
        }
        else if (playersHand[currentPlayer][playedCardIndex] == 'Bolt') {
            playersPlayedCards[1 - currentPlayer][playersPlayedCards[1 - currentPlayer].length - 1][1] = 0
        }
        else if (playersHand[currentPlayer][playedCardIndex] == '1' && playersPlayedCards[1 - currentPlayer][playersPlayedCards[1 - currentPlayer].length - 1][1] == 0) {
            playersPlayedCards[1 - currentPlayer][playersPlayedCards[1 - currentPlayer].length - 1][1] = 1
        }

        // check if game is over
        playedCardsValue = getPlayedCardsValue()
        if (playedCardsValue[currentPlayer] < playedCardsValue[1 - currentPlayer] || playersHand[currentPlayer].length <= 0) {
            break
        }
        else if (playedCardsValue[currentPlayer] == playedCardsValue[1 - currentPlayer]) {
            tie()
        }
    }
    console.log(`The winner is player ${1 - currentPlayer}.`)
}

function interpretMessage(data, socket) {
    try {
        MESSAGE_INTERPRETATION.get(data.type)(data, socket)
    }
    catch (error) {
        console.log('Request not supported.')
        console.log(error)
    }
}

module.exports = { CLIENTS, LOBBYS, interpretMessage }