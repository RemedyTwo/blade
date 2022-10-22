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

let playersHand = [[], []]
let playersPlayedCards = [[], []]

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
            if (playersPlayedCards[i][j][1] == 1) {
                total += CARDS[playersPlayedCards[i][j][0]]
            }
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
        if (playersHand[currentPlayer][playedCardIndex] == "Mirror") {
            tmp = playersPlayedCards[currentPlayer]
            playersPlayedCards[currentPlayer] = playersPlayedCards[1 - currentPlayer]
            playersPlayedCards[1 - currentPlayer] = tmp 
        }
        else if (playersHand[currentPlayer][playedCardIndex] == "Bolt") {
            playersPlayedCards[1 - currentPlayer][playersPlayedCards[1 - currentPlayer].length - 1][1] = 0
        }
        else if (playersHand[currentPlayer][playedCardIndex] == "1" && playersPlayedCards[1 - currentPlayer][playersPlayedCards[1 - currentPlayer].length - 1][1] == 0) {
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