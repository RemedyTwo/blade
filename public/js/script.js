"use strict";
const SOCKET = new WebSocket('ws://localhost:8081/ws')

// constants
const ROTATION = 20
const LISTENERS = []

// HTML elements
const APP = document.getElementById('app')

const MESSAGE_INTERPRETATION = {
    'make-lobby-accepted': (data) => { // { type: 'make-lobby-accepted', lobbyid: data.lobbyid }
        const backButton = document.createElement('button')
        backButton.textContent = 'Go back to main page'
        backButton.addEventListener('click', () => {
            SOCKET.send(JSON.stringify({
                type: 'delete-lobby'
            }))
            mainMenu()
        })

        const paragraph = document.createElement('p')
        paragraph.textContent = `Tu es dans le lobby ${data.lobbyid}. En attente d'un joueur...`
        APP.replaceChildren(backButton, paragraph)
    },

    'make-lobby-refused': (_) => { // { type: 'make-lobby-refused' }
        alert('Nom de lobby illégal.')
    },

    'lobbys-list': (data) => { // { type: 'lobbys-list', list: [1, 2, 3] }
        const backButton = document.createElement('button')
        backButton.textContent = 'Go back to main page'
        backButton.addEventListener('click', () => {
            mainMenu()
        })

        const refreshButton = document.createElement('button')
        refreshButton.textContent = 'Refresh the page'
        refreshButton.addEventListener('click', () => {
            SOCKET.send(JSON.stringify({
                type: 'refresh-lobbys'
            }))
        })
        const list = document.createElement('ul')
        for (const lobby of data.list) {
            const button = document.createElement('button')
            button.type = 'button'
            button.textContent = `Join lobby ${ lobby }`
            button.addEventListener('click', () => { 
                SOCKET.send(JSON.stringify({
                    type: 'join-lobby', 
                    lobbyid: lobby
                })) 
            })

            const li = document.createElement('li')
            li.appendChild(button)
            list.appendChild(li)
        }
        APP.replaceChildren(backButton, refreshButton, list)
    },

    'game-start': (data) => { // { type: 'game-start', playerHand: [1, 2, 3, 'Bolt', 'Mirror'], opponentHand: 10 }
        const BOARD = document.getElementById('board-template')

        APP.replaceChildren(BOARD.content.cloneNode(true))
        setOpponentHand(data.opponentHand)
        setPlayerHand(data.playerHand)
    },

    'play': (_) => { // { type: 'play' }
        addListeners()
    },

    'draw-player': (data) => { // { type: 'draw-player', card: 5, total: 5 }
        const playerPlayedCardsDiv = document.querySelector('.player.played-cards')

        playerPlayedCardsDiv.appendChild(createCard(data.card))
        setPlayerTotal(data.total)
    },

    'draw-opponent': (data) => { // { type: 'draw-opponent', card: 5, total: 5 }
        const opponentPlayedCardsDiv = document.querySelector('.opponent.played-cards')

        opponentPlayedCardsDiv.appendChild(createCard(data.card))
        setOpponentTotal(data.total)
    },

    'play-card-accepted': (data) => {  // { type: 'play-card-accepted', cardIndex: 5, card: 'Bolt', total: 10 }
        const playerHandSelectedCardDiv = document.querySelector('.player.hand').children.item(data.cardIndex)
        const playerPlayedCardsDiv = document.querySelector('.player.played-cards')
        
        clearListeners()
        playerHandSelectedCardDiv.style = ''
        playerPlayedCardsDiv.appendChild(playerHandSelectedCardDiv)
        setPlayerTotal(data.total)
        updatePlayerHand()
    },

    'play-card-refused': (_) => { // { type: 'play-card-refused', cardIndex: 3 }
        alert('The card selected can not be played.')
    },

    'play-card-opponent': (data) => { // { type: 'play-card-opponent', cardIndex: 5, card: 'Bolt', total: 10 }
        const opponentHandSelectedCardDiv = document.querySelector('.opponent.hand').children[data.cardIndex]
        const opponentPlayedCardsDiv = document.querySelector('.opponent.played-cards')
        
        opponentHandSelectedCardDiv.classList.add(`c${data.card}`)
        opponentHandSelectedCardDiv.style = ''
        opponentPlayedCardsDiv.appendChild(opponentHandSelectedCardDiv)

        setOpponentTotal(data.total)
        updateOpponentHand()
    },

    'tie': (_) => { // { type: 'tie' }
        const playerPlayedCardsDiv = document.querySelector('.player.played-cards')
        const opponentPlayedCardsDiv = document.querySelector('.opponent.played-cards')
        
        playerPlayedCardsDiv.replaceChildren()
        opponentPlayedCardsDiv.replaceChildren()

        setPlayerTotal(0)
        setOpponentTotal(0)
    },

    'win': (data) => {
        alert('You won!')
        mainMenu()
    },

    'loose': (data) => {
        alert('You lost!')
        mainMenu()
    }
}

function mainMenu() {
    const usernameInput = document.createElement('input')
    usernameInput.id = 'username-input'
    usernameInput.type = 'text'
    usernameInput.placeholder = 'Enter username...'
    
    const lobbyId = document.createElement('input')
    lobbyId.id = 'lobbyid-input'
    lobbyId.type = 'text'
    lobbyId.placeholder = 'Enter lobby name...'
    
    const makeLobby = document.createElement('button')
    makeLobby.id = 'make-lobby'
    makeLobby.type = 'button'
    makeLobby.textContent = 'Create lobby'
    makeLobby.addEventListener('click', () => {
        SOCKET.send(JSON.stringify({
            type: 'make-lobby',
            username: usernameInput.value,
            lobbyid: lobbyId.value
        }))
    })

    const searchLobbys = document.createElement('button')
    searchLobbys.id = 'search-lobbys'
    searchLobbys.type = 'button'
    searchLobbys.textContent = 'Search for lobbys'
    searchLobbys.addEventListener('click', () => {
        SOCKET.send(JSON.stringify({
            type: 'search-lobbys',
            username: usernameInput.value 
        }))
    })

    APP.replaceChildren(usernameInput, lobbyId, makeLobby, searchLobbys)
}

function setOpponentHand(n) {
    const opponentHandDiv = document.querySelector('.opponent.hand')

    opponentHandDiv.replaceChildren()
    for (let i = 0; i < n; i++)
        opponentHandDiv.appendChild(createCard())
    updateOpponentHand()
}

/**
 * Set rotation, position and event listener of the opponent's hand
 */
function updateOpponentHand() {
    const opponentHandCardsDiv = document.querySelector('.opponent.hand').children
    let degree = -(ROTATION / 2)

    for (const cardDiv of opponentHandCardsDiv) {
        cardDiv.style.transform = `rotate(${-degree}deg)`
        cardDiv.style.bottom = `${Math.abs(degree)}%`
        degree += ROTATION / (opponentHandCardsDiv.length - 1)
    }
}

function setPlayerHand(playerHand) {
    const playerHandDiv = document.querySelector('.player.hand')
    
    playerHandDiv.replaceChildren()
    for (const cardName of playerHand)
        playerHandDiv.appendChild(createCard(cardName))
    updatePlayerHand()
}

/**
 * Set rotation, position and event listener of the player's hand
 */
function updatePlayerHand() {
    const playerHandCardsDiv = document.querySelector('.player.hand').children
    let degree = -(ROTATION / 2)

    for (const cardDiv of playerHandCardsDiv) {
        cardDiv.style.transform = `rotate(${degree}deg)`
        cardDiv.style.top = `${Math.abs(degree)}%`
        degree += ROTATION / (playerHandCardsDiv.length - 1)
    }
}

function setPlayerTotal(total) {
    const playerTotal = document.querySelector('.player.total')
    playerTotal.replaceChildren()

    const numberDiv = document.createElement('div')
    numberDiv.classList.add('total-value')

    for (const letter of total.toString()) {
        let currentNumberDiv = numberDiv.cloneNode()
        currentNumberDiv.classList.add(`t${letter}`)
        playerTotal.appendChild(currentNumberDiv)
    }
}

function setOpponentTotal(total) {
    const opponentTotal = document.querySelector('.opponent.total')
    opponentTotal.replaceChildren()

    const numberDiv = document.createElement('div')
    numberDiv.classList.add('total-value')

    for (const letter of total.toString()) {
        let currentNumberDiv = numberDiv.cloneNode()
        currentNumberDiv.classList.add(`t${letter}`)
        opponentTotal.appendChild(currentNumberDiv)
    }
}

/**
 * Add event listeners to each card of the player's hand
 */
function addListeners() {
    clearListeners()
    const playerHandChildren = document.querySelector('.player.hand').children
    for (let i = 0; i < playerHandChildren.length; i++) {
        const playCard = () => { 
            SOCKET.send(JSON.stringify({ 
                type: 'play-card', 
                cardIndex: i 
            }))
        }
        LISTENERS.push(playCard)
        playerHandChildren.item(i).addEventListener('click', playCard)
    }
}

/**
 * Remove event listeners to each card of the player's hand
 */
function clearListeners() {
    const playerHandChildren = document.querySelector('.player.hand').children
    for (const cardDiv of playerHandChildren)
        cardDiv.removeEventListener('click', LISTENERS.shift())
}

function createCard(type = '') {
    const cardDiv = document.createElement('div')
    cardDiv.classList.add('card')
    if (type != '') {
        cardDiv.classList.add(`c${type}`)
    }
    return cardDiv
}

SOCKET.addEventListener('message', (event) => {
    const data = JSON.parse(event.data)
    console.log(data)
    try {
        MESSAGE_INTERPRETATION[data.type](data)
    }
    catch (error) {
        console.error('Request not supported.')
    }
})

const audioPlayer = document.getElementById('audio-player')
audioPlayer.addEventListener('click', () => {
    const audio = document.getElementById('audio')
    if (audio.paused) {
        audio.play()
        audioPlayer.textContent = 'Pause'
    }
    else {
        audio.pause()
        audioPlayer.textContent = 'Play'
    }
})

mainMenu()