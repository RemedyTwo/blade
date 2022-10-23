const socket = new WebSocket('ws://localhost:8081/ws')

// constants
const ROTATION = 20

// HTML elements
const app = document.getElementById('app')
const card = document.createElement('div')
card.className = 'card'
const refreshButton = document.createElement('button')
refreshButton.type = 'button'
refreshButton.innerHTML = 'Refresh the page'
refreshButton.addEventListener('click', () => {
    socket.send(JSON.stringify({
        type: 'refresh-lobbys'
    }))
})
const opponentHandDiv = document.createElement('div')
const opponentPlayedCardsDiv = document.createElement('div')
const playerPlayedCardsDiv = document.createElement('div')
const playerHandDiv = document.createElement('div')
opponentHandDiv.className = 'opponent hand'
opponentPlayedCardsDiv.className = 'opponent cards'
playerPlayedCardsDiv.className = 'player cards'
playerHandDiv.className = 'player hand'

const LISTENERS = []

document.getElementById('make-lobby').addEventListener('click', () => {
    socket.send(JSON.stringify({
        type: 'make-lobby',
        username: document.getElementById('username-input').value,
        lobbyid: document.getElementById('lobbyid-input').value
    }))
})

document.getElementById('search-lobbys').addEventListener('click', () => {
    socket.send(JSON.stringify({
        type: 'search-lobbys',
        username: document.getElementById('username-input').value
    }))
})

socket.addEventListener('message', (event) => {
    let data = JSON.parse(event.data)
    switch (data.type) {
        case 'make-lobby-accepted':
            app.innerHTML = `<p>Tu es dans le lobby ${data.lobbyid}. En attente d'un joueur...</p>`
            break
        
        case 'make-lobby-refused':
            alert('Nom de lobby illégal.')
            break

        case 'lobbys-list':
            let list = document.createElement('ul')
            for (let lobbyId in data.list) {
                let li = document.createElement('li')
                list.appendChild(li)

                let button = document.createElement('button')
                button.type = 'button'
                button.innerHTML = `Join lobby ${data.list[lobbyId]}`
                button.addEventListener('click', () => {
                    socket.send(JSON.stringify({
                        type: 'join-lobby',
                        lobbyid: data.list[lobbyId]
                    }))
                })
                
                li.appendChild(button)
            }
            app.replaceChildren(refreshButton, list)
            break
        
        case 'game-start': // { type: 'game-start', playerHand: [1, 2, 3, 'Bolt', 'Mirror'], opponentHand: 10 }
            setOpponentHand(data.opponentHand)
            setPlayerHand(data.playerHand)
            app.replaceChildren(opponentHandDiv, opponentPlayedCardsDiv, playerPlayedCardsDiv, playerHandDiv)
            break
        
        case 'play-card-accepted': // { type: 'play-card-accepted', cardIndex: 5, card: 'Bolt', playerHand: [1, 2, 'Mirror'] }
            playerHandDiv.children.item(data.cardIndex).style.removeProperty('transform')
            playerHandDiv.children.item(data.cardIndex).style.removeProperty('top')
            playerHandDiv.children.item(data.cardIndex).style.removeProperty('bottom')
            playerPlayedCardsDiv.appendChild(playerHandDiv.children.item(data.cardIndex))
            setPlayerHand(data.playerHand)
            break
        
        case 'play-card-refused': // { type: 'play-card-refused', cardIndex: 3 }
            alert('The card selected can not be played.')
            playerHandDiv.children.item(data.cardIndex).addEventListener('click', () => socket.send(JSON.stringify({ type: 'play-card', cardIndex: data.cardIndex })), {once: true})
            break
        
        case 'play-card-opponent': // { type: 'play-card-opponent', cardIndex: 5, card: 'Bolt' }
            opponentHandDiv.childNodes[data.cardIndex].innerHTML = data.card
            opponentHandDiv.childNodes[data.cardIndex].style = ''
            opponentPlayedCardsDiv.appendChild(opponentHandDiv.childNodes[data.cardIndex])
            updateOpponentHand()
            break

        default: 
            console.log('Request not supported.')
            break
    }
})

function setPlayerHand(playerHand) {
    playerHandDiv.textContent = ''

    let degree = -(ROTATION / 2)
    for(let i = 0; i < playerHand.length; i++) {
        let playerCard = card.cloneNode()
        playerCard.innerHTML = playerHand[i]
        playerCard.style.transform = `rotate(${degree}deg)`
        playerCard.style.top = `${Math.abs(degree)}%`
        
        playerCard.addEventListener('click', () => socket.send(JSON.stringify({ type: 'play-card', cardIndex: i })), {once: true})

        playerHandDiv.appendChild(playerCard)
        degree += ROTATION / (playerHand.length - 1)
    }
}

function setOpponentHand(n) {
    opponentHandDiv.textContent = ''

    let degree = -(ROTATION / 2)
    for (let i = 0; i < n; i++) {
        let opponentCard = card.cloneNode()
        opponentCard.style.transform = `rotate(${-degree}deg)`
        opponentCard.style.bottom = `${Math.abs(degree)}%`

        opponentHandDiv.appendChild(opponentCard)
        degree += ROTATION / (n - 1)
    }
}

/**
 * Set rotation and position of the opponent's cards
 */
function updateOpponentHand() {
    let degree = -(ROTATION / 2)
    for (opponentCard of opponentHandDiv.children) {
        opponentCard.style.transform = `rotate(${-degree}deg)`
        opponentCard.style.bottom = `${Math.abs(degree)}%`
        degree += ROTATION / (opponentHandDiv.children.length - 1)
    }
}

function updatePlayerHand() {
    let degree = -(ROTATION / 2)
    for (let i = 0; i < playerHandDiv.children.length; i++) {
        let playerCard = playerHandDiv.children.item(i)
        playerCard.style.transform = `rotate(${degree}deg)`
        playerCard.style.top = `${Math.abs(degree)}%`
        degree += ROTATION / (playerHandDiv.children.length - 1)

        playerCard.removeEventListener('click', LISTENERS[i], { once: true })
        
        let playCard = () => { socket.send(JSON.stringify({ type: 'play-card', cardIndex: i }))}
        LISTENERS.push(playCard)
        playerCard.addEventListener('click', playCard, { once: true })
    }
}