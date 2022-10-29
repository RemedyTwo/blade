const SOCKET = new WebSocket('ws://localhost:8081/ws')

// constants
const ROTATION = 20
const LISTENERS = []

// HTML elements
const APP = document.getElementById('app')
const BOARD = document.getElementById('board-template')

document.getElementById('make-lobby').addEventListener('click', () => {
    SOCKET.send(JSON.stringify({
        type: 'make-lobby',
        username: document.getElementById('username-input').value,
        lobbyid: document.getElementById('lobbyid-input').value
    }))
})

document.getElementById('search-lobbys').addEventListener('click', () => {
    SOCKET.send(JSON.stringify({
        type: 'search-lobbys',
        username: document.getElementById('username-input').value 
    }))
})

SOCKET.addEventListener('message', (event) => {
    const data = JSON.parse(event.data)
    console.log(data)
    switch (data.type) {
        case 'make-lobby-accepted': { // { type: 'make-lobby-accepted', lobbyid: data.lobbyid }
            APP.innerHTML = `<p>Tu es dans le lobby ${data.lobbyid}. En attente d'un joueur...</p>`
            break
        }

        case 'make-lobby-refused': { // { type: 'make-lobby-refused' }
            alert('Nom de lobby illégal.')
            break
        }

        case 'lobbys-list': { // { type: 'lobbys-list', list: [1, 2, 3] }
            const refreshButton = document.createElement('button')
            refreshButton.textContent = 'Refresh the page'
            refreshButton.addEventListener('click', () => {
                SOCKET.send(JSON.stringify({
                    type: 'refresh-lobbys'
                }))
            })
            const list = document.createElement('ul')
            for (const lobby of data.list) {
                const li = document.createElement('li')
                list.appendChild(li)

                const button = document.createElement('button')
                button.type = 'button'
                button.innerHTML = `Join lobby ${ lobby }`
                button.addEventListener('click', () => { 
                    SOCKET.send(JSON.stringify({
                        type: 'join-lobby', 
                        lobbyid: lobby
                    })) 
                })
                li.appendChild(button)
            }
            APP.replaceChildren(refreshButton, list)
            break
        }

        case 'game-start': { // { type: 'game-start', playerHand: [1, 2, 3, 'Bolt', 'Mirror'], opponentHand: 10 }
            APP.replaceChildren(BOARD.content.cloneNode(true))
            setOpponentHand(data.opponentHand)
            setPlayerHand(data.playerHand)
            addListeners()
            break
        }

        case 'draw-player': { // { type: 'draw-player', card: 5, begin: true/false }
            APP.querySelector('.player.played-cards').appendChild(createCard(data.card))
            if (!data.begin)
                clearListeners()
            break
        }

        case 'draw-opponent': { // { type: 'draw-opponent', card: 5 }
            const opponentPlayedCardsDiv = APP.querySelector('.opponent.played-cards')
            opponentPlayedCardsDiv.appendChild(createCard(data.card))
            break
        }

        case 'play-card-accepted': {  // { type: 'play-card-accepted', cardIndex: 5, card: 'Bolt' }
            const playerHandSelectedCardDiv = APP.querySelector('.player.hand').children.item(data.cardIndex)
            const playerPlayedCardsDiv = APP.querySelector('.player.played-cards')
            
            playerHandSelectedCardDiv.style = ''
            playerPlayedCardsDiv.appendChild(playerHandSelectedCardDiv)

            LISTENERS.splice(data.cardIndex, 1)
            updatePlayerHand()
            clearListeners()
            break
        }

        case 'play-card-refused': { // { type: 'play-card-refused', cardIndex: 3 }
            const playerHandSelectedCardDiv = APP.querySelector('.player.hand').children.item(data.cardIndex)
            
            playerHandSelectedCardDiv.addEventListener('click', LISTENERS[data.cardIndex], { once: true })
            alert('The card selected can not be played.')
            break
        }

        case 'play-card-opponent': { // { type: 'play-card-opponent', cardIndex: 5, card: 'Bolt' }
            const opponentHandSelectedCardDiv = APP.querySelector('.opponent.hand').children[data.cardIndex]
            const opponentPlayedCardsDiv = APP.querySelector('.opponent.played-cards')
            
            opponentHandSelectedCardDiv.innerHTML = data.card
            opponentHandSelectedCardDiv.style = ''
            opponentPlayedCardsDiv.appendChild(opponentHandSelectedCardDiv)

            updateOpponentHand()
            addListeners()
            break
        }

        default: {
            console.error('Request not supported.')
            break
        }
    }
})

function setOpponentHand(n) {
    const opponentHandDiv = APP.querySelector('.opponent.hand')

    opponentHandDiv.replaceChildren()
    for (let i = 0; i < n; i++)
        opponentHandDiv.appendChild(createCard())
    updateOpponentHand()
}

/**
 * Set rotation, position and event listener of the opponent's hand
 */
function updateOpponentHand() {
    const opponentHandCardsDiv = APP.querySelector('.opponent.hand').children
    let degree = -(ROTATION / 2)

    for (const cardDiv of opponentHandCardsDiv) {
        cardDiv.style.transform = `rotate(${-degree}deg)`
        cardDiv.style.bottom = `${Math.abs(degree)}%`
        degree += ROTATION / (opponentHandCardsDiv.length - 1)
    }
}

function setPlayerHand(playerHand) {
    const playerHandDiv = APP.querySelector('.player.hand')
    
    playerHandDiv.replaceChildren()
    for (const cardName of playerHand)
        playerHandDiv.appendChild(createCard(cardName))
    updatePlayerHand()
}

/**
 * Set rotation, position and event listener of the player's hand
 */
function updatePlayerHand() {
    const playerHandCardsDiv = APP.querySelector('.player.hand').children
    let degree = -(ROTATION / 2)

    for (const cardDiv of playerHandCardsDiv) {
        cardDiv.style.transform = `rotate(${degree}deg)`
        cardDiv.style.top = `${Math.abs(degree)}%`
        degree += ROTATION / (playerHandCardsDiv.length - 1)
    }
}

/**
 * Add event listeners to each card of the player's hand
 */
function addListeners() {
    const playerHandChildren = APP.querySelector('.player.hand').children
    for (let index in playerHandChildren) {
        let playCard = () => { 
            SOCKET.send(JSON.stringify({ 
                type: 'play-card', 
                cardIndex: index 
            }))
        }
        LISTENERS.push(playCard)
        playerHandChildren.item(index).addEventListener('click', playCard, { once: true })
    }
}

/**
 * Remove event listeners to each card of the player's hand
 */
function clearListeners() {
    const playerHandChildren = APP.querySelector('.player.hand').children
    for (const cardDiv of playerHandChildren)
        cardDiv.removeEventListener('click', LISTENERS.shift(), { once: true })
}

function createCard(type = "") {
    const cardDiv = document.createElement('div')
    cardDiv.className = 'card'
    cardDiv.textContent = type
    return cardDiv
}