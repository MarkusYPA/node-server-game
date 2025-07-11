import { mount } from './framework/mini.js'
import { state } from './framework/state.js'
import { gameRunning, setMoving, setPlayerId, startSequenceClient, stopSequenceClient } from './bomberbear-render/bomberbear-render.js'
import { clearClientGameState, clientGameState, setPoints, updateClientGameState } from './bomberbear-render/clientstate.js'
import { PlayerCountComponent } from './app.js'
import { endGraphic } from './bomberbear-render/endGraphics.js'

let box // game area
let ws // WebSocket connection
let nickname
let firstState = true
let isLeavingGame = false // Track if user is intentionally leaving
const msgDivs = [] // Store message divs for redrawing

// Function to create beautiful nickname modal
function createNicknameModal() {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div')
        overlay.className = 'nickname-modal-overlay'

        // Create modal content
        const modal = document.createElement('div')
        modal.className = 'nickname-modal'

        // Modal content HTML
        modal.innerHTML = `
            <h2>Enter Player Name</h2>
            <p>Choose a nickname to identify yourself in the game terminal. Maximum 10 characters allowed.</p>
            <input type="text" class="nickname-input" placeholder="PLAYER_NAME" maxlength="10" autocomplete="off">
            <div class="character-count">0/10 characters</div>
            <div class="nickname-modal-buttons">
                <button type="button" class="cancel-btn">Cancel</button>
                <button type="button" class="primary confirm-btn">Connect</button>
            </div>
        `

        const input = modal.querySelector('.nickname-input')
        const charCount = modal.querySelector('.character-count')
        const confirmBtn = modal.querySelector('.confirm-btn')
        const cancelBtn = modal.querySelector('.cancel-btn')

        // Update character count
        function updateCharCount() {
            const length = input.value.length
            charCount.textContent = `${length}/10 characters`
            charCount.style.color = length >= 10 ? '#ff4444' : '#ff8c00'
        }

        // Handle input events
        input.addEventListener('input', updateCharCount)
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                resolve(input.value.trim().slice(0, 12))
                document.body.removeChild(overlay)
            }
        })

        // Handle button clicks
        confirmBtn.addEventListener('click', () => {
            const nickname = input.value.trim()
            if (nickname) {
                resolve(nickname.slice(0, 12))
                document.body.removeChild(overlay)
            } else {
                input.focus()
                input.style.borderColor = '#ff4444'
                setTimeout(() => {
                    input.style.borderColor = '#8b4513'
                }, 1000)
            }
        })

        cancelBtn.addEventListener('click', () => {
            // resolve('Player') // Default nickname if cancelled
            // document.body.removeChild(overlay)

            document.body.removeChild(overlay)
            state.screen = 'start'
        })

        // Add to DOM and focus
        overlay.appendChild(modal)
        document.body.appendChild(overlay)

        // Focus input after a short delay to ensure modal is rendered
        setTimeout(() => {
            input.focus()
            input.select()
        }, 100)
    })
}

// Function to show error messages elegantly
function showErrorMessage(message) {
    const errorContainer = document.getElementById('error-container')
    if (errorContainer) {
        const errorDiv = document.createElement('div')
        errorDiv.className = 'error-message'
        errorDiv.textContent = message
        errorContainer.appendChild(errorDiv)

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv)
            }
        }, 5000)
    } else {
        // Fallback to alert if error container not found
        alert(message)
    }
}

// Function to show new message indicator
function showNewMessageIndicator() {
    const chatBox = document.getElementById('chat')
    let indicator = document.getElementById('new-message-indicator')

    // Create indicator if it doesn't exist
    if (!indicator) {
        indicator = document.createElement('div')
        indicator.id = 'new-message-indicator'
        indicator.className = 'new-message-indicator'
        indicator.textContent = '↓ New messages ↓'
        indicator.onclick = () => {
            chatBox.scrollTop = chatBox.scrollHeight
            indicator.remove()
        }
        chatBox.appendChild(indicator) // Append to chat-box instead of chat-area
    }

    // Reset the fade-out timer
    clearTimeout(indicator.fadeTimer)
    indicator.style.opacity = '1'

    // Auto-fade after 3 seconds
    indicator.fadeTimer = setTimeout(() => {
        if (indicator.parentNode) {
            indicator.style.opacity = '0.7'
        }
    }, 3000)
}

// Track held keys
const held = new Set()
const keyMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ' ': 'bomb',
    Space: 'bomb'          // some browsers use 'Space'
}
const allKeys = ['left', 'right', 'up', 'down', 'bomb']

function sendHeld() {
    // create and send object of booleans from set
    if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = {}
        for (const key of allKeys) {
            payload[key] = held.has(key)
        }
        ws.send(JSON.stringify({ type: 'input', payload }))
    }
}

document.addEventListener('keydown', (e) => {
    const chatInput = document.getElementById('chatInput')
    if (chatInput && document.activeElement === chatInput) {
        // If chat input is focused, ignore key events
        return
    }
    if (keyMap[e.key] && state.screen !== 'start') {
        const action = keyMap[e.key]
        if (!held.has(action)) {
            held.add(action)
            sendHeld()
        }
        if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
            setMoving(true)
        }
    }
})

document.addEventListener('keyup', (e) => {
    const chatInput = document.getElementById('chatInput')
    if (chatInput && document.activeElement === chatInput) {
        // If chat input is focused, ignore key events
        return
    }
    if (keyMap[e.key] && state.screen !== 'start') {
        if (held.has(keyMap[e.key])) {
            held.delete(keyMap[e.key])
            sendHeld()
        }
        if (!(held.has('left') || held.has('right') || held.has('up') || held.has('down'))) {
            setMoving(false)
        }
    }
})
function updatePoints(points) {
    // update points in clientGameState
    setPoints(points)

    // Remove players from state.players that aren't in clientGameState.points
    for (const id of Object.keys(state.players)) {
        if (!(id in clientGameState.points)) {
            delete state.players[id]
        }
    }
    // update points in framework state to trigger scoreboard re-render
    for (const [id, points] of Object.entries(clientGameState.points)) {
        if (state.players && state.players[id]) {
            state.players[id].points = points
        }
    }
}

function updatePlayerCount() {
    const playerCountElement = document.getElementById('player-count-container')
    if (playerCountElement) {
        mount(playerCountElement, PlayerCountComponent())
    }
}

function makeMessage(msg) {
    // Create message container
    const messageDiv = document.createElement('div')
    const isOwnMessage = msg.nickname === nickname
    messageDiv.className = `chat-message ${isOwnMessage ? 'own' : 'other'}`

    // Create sender name (only show for other people's messages)
    if (!isOwnMessage) {
        const senderDiv = document.createElement('div')
        senderDiv.className = 'message-sender'
        senderDiv.textContent = msg.nickname
        messageDiv.appendChild(senderDiv)
    }

    // Create message bubble with player color
    const bubbleDiv = document.createElement('div')
    bubbleDiv.className = `message-bubble player-color-${msg.playerId}`
    bubbleDiv.textContent = msg.message
    messageDiv.appendChild(bubbleDiv)

    // Create timestamp
    const timestampDiv = document.createElement('div')
    timestampDiv.className = 'message-timestamp'
    const now = new Date()
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    timestampDiv.textContent = timeString

    messageDiv.appendChild(timestampDiv)

    return messageDiv
}

export function redrawAllMessages() {
    const chatBox = document.getElementById('chat')
    if (chatBox) {
        msgDivs.forEach(d => chatBox.appendChild(d))
        chatBox.scrollTop = chatBox.scrollHeight
    }
}

export async function startClient() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'New session')
        // Wait a bit to ensure the old connection is properly closed
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    nickname = await createNicknameModal()

    // support https and http connections
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}`)

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
            ws.close()
            showErrorMessage('Connection timeout. Please try again.')
        }
    }, 10000) // 10 second timeout

    ws.addEventListener('open', () => {
        clearTimeout(connectionTimeout)
        ws.send(JSON.stringify({
            type: 'join',
            nickname: nickname,
        }))
    })

    ws.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'lobby') {
            state.lobbyTime = msg.time
        } else if (msg.type === 'lobbyFinished') {
            state.lobbyTime = null
        } else if (msg.type === 'countdown') {
            state.countdownTime = msg.time
        } else if (msg.type === 'countdownFinished') {
            state.screen = 'game' // Switch to game screen
            state.countdownTime = null
        } else if (msg.type === 'playerCount') {
            state.playerCount = msg.count
            updatePlayerCount()
        } else if (msg.type === 'state') {  // for mini game
            // Only update on changes. Keep player points, payload doesn't contain them.
            if (JSON.stringify(state.players) !== JSON.stringify(msg.payload)) {
                // Remove players not present in msg.payload
                for (const id of Object.keys(state.players)) {
                    if (!(id in msg.payload)) {
                        delete state.players[id]
                    }
                }
                for (const [id, playerInfo] of Object.entries(msg.payload)) {
                    if (state.players[id]) {
                        for (const [key, val] of Object.entries(playerInfo)) {
                            state.players[id][key] = val
                        }
                    } else {
                        state.players[id] = playerInfo
                    }
                }

                if (firstState) {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'requestPoints' }))
                    }
                    firstState = false
                }

                renderMiniGame(msg.payload)
            }
        } else if (msg.type === 'chat') {
            const chatBox = document.getElementById('chat')
            if (chatBox) {
                const isAtBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 1
                const messageDiv = makeMessage(msg)
                msgDivs.push(messageDiv)
                chatBox.appendChild(messageDiv)

                if (isAtBottom) {
                    // User was at bottom, auto-scroll to show new message
                    chatBox.scrollTop = chatBox.scrollHeight
                } else {
                    // User is reading older messages, show new message indicator
                    showNewMessageIndicator()
                }
            }

            
        } else if (msg.type === 'duplicateNickname') {
            // Show error message and prompt for new nickname
            showErrorMessage(msg.message)
            // Prompt user to enter a different nickname
            createNicknameModal().then(newNickname => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'join',
                        nickname: newNickname,
                    }))
                }
            })
        } else if (msg.type === 'error') {
            // Display error message to user
            showErrorMessage(msg.message)
        } else if (msg.type === 'startgame') {
            clearClientGameState()  // make sure no old calls try to collapse walls
            updateClientGameState(msg.payload)
            // Ensure box is assigned to the game area element before using it
            box = document.getElementById('game')
            if (box) {
                box.innerHTML = ''
            }
            startSequenceClient()
        } else if (msg.type === 'gamestate') {
            if (firstState) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'requestPointsAndPlayers' }))
                }
                firstState = false
            }
            updateClientGameState(msg.payload)
        } else if (msg.type === 'playerId') {
            setPlayerId(msg.id)
        } else if (msg.type === 'endgame') {
            if (gameRunning) {
                endGraphic(msg.winner)
            }
            updatePoints(msg.points)
        } else if (msg.type === 'back to lobby') {
            if (gameRunning) {
                box.innerHTML = ''          // clear main game graphics
                box.className = 'game-area' // restore default class
                stopSequenceClient('lobby') // stop game loop
            }
        } else if (msg.type === 'points') {
            if (msg.players) {
                state.players = msg.players
            }
            if (state.players) {
                updatePoints(msg.points)
            }
        } else if (msg.type === 'leaveConfirmed') {
            // Server confirmed leave request, close connection gracefully
            isLeavingGame = true
            ws.close(1000, 'User left game')
        }
    })

    // Handle WebSocket close event
    ws.addEventListener('close', (event) => {
        clearTimeout(connectionTimeout)
        console.log('WebSocket connection closed:', event.code, event.reason)

        // Don't show error if user is intentionally leaving the game
        if (isLeavingGame) {
            isLeavingGame = false // Reset flag
            return
        }

        // Only show error for unexpected closures (not normal or manual closures)
        if (event.code !== 1000 && event.code !== 1001) {
            showErrorMessage('Connection lost. Please refresh the page to reconnect.')
        }
    })

    // Handle WebSocket error event  
    ws.addEventListener('error', (error) => {
        clearTimeout(connectionTimeout)
        console.error('WebSocket error:', error)
        showErrorMessage('Connection error occurred. Please check your internet connection.')
    })

    // Add beforeunload event to properly close connection when page is unloaded
    window.addEventListener('beforeunload', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            isLeavingGame = true // User is leaving by closing page
            ws.close(1000, 'Page unload') // Normal closure
        }
    })
}

function renderMiniGame(players) {
    const areaId = state.screen === 'lobby' ? 'lobby' : 'game'
    const box = document.getElementById(areaId)
    if (!box) return

    box.innerHTML = ''
    for (const id in players) {
        const p = players[id]
        const d = document.createElement('div')
        d.className = `player player-color-${id}`
        d.style.left = `${p.x * 25}px`
        d.style.top = `${p.y * 25}px`
        d.textContent = p.direction === 'left' ? '<' : '>'
        d.title = p.nickname
        box.appendChild(d)
    }
}

export function setupChatHandlers() {
    const sendButton = document.getElementById('send')
    const chatInput = document.getElementById('chatInput')
    const chatBox = document.getElementById('chat')
    box = document.getElementById('game')

    if (sendButton && chatInput) {
        sendButton.onclick = () => {
            const msg = chatInput.value.trim()
            if (msg && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'chat', message: msg }))
                chatInput.value = ''
                chatInput.blur() // Remove focus to prevent accidental sending
            }
        }
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                sendButton.click()
            }
        })

        chatBox.addEventListener('scroll', () => {
            const isAtBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 1
            const indicator = document.getElementById('new-message-indicator')

            if (isAtBottom && indicator) {
                indicator.remove()
            }
        })

    }
}

export function sendLeaveGame() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leaveGame' }))
        // Don't set isLeavingGame here - wait for server confirmation
    }
}

export function sendBackToLobby() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'backToLobby' }))
    }
}

export { renderMiniGame }
