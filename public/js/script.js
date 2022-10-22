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
const opponentHand = document.createElement('div')
const opponentCards = document.createElement('div')
const playerCards = document.createElement('div')
const playerHand = document.createElement('div')
opponentHand.className = 'opponent hand'
opponentCards.className = 'opponent cards'
playerCards.className = 'player cards'
playerHand.className = 'player hand'

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
    let message = JSON.parse(event.data)

    switch (message.type) {
        case 'make-lobby-accepted':
            app.innerHTML = `<p>Tu es dans le lobby ${message.lobbyid}. En attente d'un joueur...</p>`
            break

        case 'make-lobby-refused':
            alert('Nom de lobby illégal.')
            break

        case 'lobbys-list':
            let list = document.createElement('ul')
            for (let lobbyId in message.list) {
                let li = document.createElement('li')
                list.appendChild(li)

                let button = document.createElement('button')
                button.type = 'button'
                button.innerHTML = `Join lobby ${message.list[lobbyId]}`
                button.addEventListener('click', () => {
                    socket.send(JSON.stringify({
                        type: 'join-lobby',
                        lobbyid: message.list[lobbyId]
                    }))
                })
                
                li.appendChild(button)
            }
            app.replaceChildren(refreshButton, list)
            break
        
        case 'game-start':
            for(let i = 0; i < message.playerHand.length; i++) {
                opponentHand.appendChild(card.cloneNode())

                let playerCard = card.cloneNode()
                playerCard.innerHTML = message.playerHand[i]
                playerCard.addEventListener('click', () => {
                    socket.send(JSON.stringify({
                        type: 'play-card',
                        card: i
                    }))
                    socket.addEventListener('message', (event) => {
                        if (JSON.parse(event.data).type != 'play-card-accepted') {
                            alert('The card selected can not be played.')
                            return
                        }
                        playerCard.style.removeProperty('transform')
                        playerCard.style.removeProperty('top')
                        playerCard.style.removeProperty('bottom')
                        playerCards.appendChild(playerCard)
                    })
                })
                playerHand.appendChild(playerCard)
            }
            app.replaceChildren(opponentHand, opponentCards, playerCards, playerHand)
            sortPlayerHand()
            updateHandRotation()
            break
        
        case 'play-card-accepted':
            updateHandRotation()
            switch (message.card) {
                case 'Bolt':
                    opponentCards.removeChild(opponentCards.lastChild)
                    break

                case 'Mirror':
                    let tmp = playerCards.innerHTML
                    playerCards.innerHTML = opponentCards.innerHTML
                    opponentCards.innerHTML = tmp
                    break
            }
            break
        
        case 'play-card-opponent':
            opponentHand.childNodes[message.cardIndex].innerHTML = message.card
            opponentHand.childNodes[message.cardIndex].style = ''
            opponentCards.appendChild(opponentHand.childNodes[message.cardIndex])
            updateHandRotation()
            break

        default: 
            console.log('Request not supported.')
            break
    }
})

/**
 * Set rotation and position of the player and the opponent's cards
 */
function updateHandRotation() {
    let degree = -(ROTATION / 2)
    for (let i = 0; i < opponentHand.children.length; i++) {
        opponentHand.children[i].style.transform = `rotate(${-degree}deg)`
        opponentHand.children[i].style.bottom = `${Math.abs(degree)}%`
        degree += ROTATION / (opponentHand.children.length - 1)
    }
    
    degree = -(ROTATION / 2)
    for (let i = 0; i < playerHand.children.length; i++)
    {
        playerHand.children[i].style.transform = `rotate(${degree}deg)`
        playerHand.children[i].style.top = `${Math.abs(degree)}%`
        degree += ROTATION / (playerHand.children.length - 1)
    }
}

/**
 * Sort player cards by their number
 */
function sortPlayerHand() {
    let cards = Array.prototype.slice.call(playerHand.children)
    cards.sort(function(a, b) {
        return a.innerHTML.localeCompare(b.innerHTML);
    })
    
    for (let i = 0; i < cards.length; i++) {
        playerHand.appendChild(cards[i])
    }
}