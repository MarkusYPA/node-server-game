import { createVNode, mount } from './framework/mini.js'
import { state, subscribe, createReactiveComponent } from './framework/state.js'
import { sendLeaveGame, setupChatHandlers, startClient } from './client.js'
import { stopSequenceClient } from './bomberman/runGame.js'
import { loadAllSounds } from './bomberman/sounds.js'

state.screen = 'start'
state.players = {}          // This can be kept for compatibility, but not used for rendering
state.countdownTime = null  // Initialize countdown time
state.lobbyTime = null
state.playerCount = 0

function StartScreen() {
    return createVNode('div', { id: 'start-menu', class: 'start-menu' },
        createVNode('h1', {}, 'Bomber Bear Multiplayer'),
        createVNode('button', {
            onclick: async () => {
                await startClient()
                state.screen = 'lobby'
            }
        }, 'Start Game')
    )
}

// PlayerBoard component that only re-renders when players state changes
export const PlayerBoardComponent = createReactiveComponent(
    () => {
        return createVNode('div', {
            class: 'scoreboard scoreboard-width'
        },
            createVNode('h2', {}, 'Scoreboard'),
            createVNode('div', { id: 'player-count-container' }, PlayerCountComponent()),
            ...[1, 2, 3, 4].map(i => {
                const player = state.players[i]
                return createVNode('div', {
                    class: `scoreboard-player player-color-${i}${player ? '' : ' inactive'}`
                },
                    // display player points
                    createVNode('span', { class: 'player-points' },
                        player ? player.points ? player.points : '0' : ''
                    ),
                    createVNode('span', { class: 'player-nickname' },
                        player ? player.nickname : `Player ${i}`
                    )
                )
            })
        )
    },
    ['players'] // Only watch the 'players' path
)

function MainLayout({ header, boardId, boardClass }) {
    return createVNode('div', { class: 'game-root' },
        // Header
        header,
        // Body
        createVNode('div', { class: 'game-body' },
            // Main board area
            createVNode('div', { class: 'game-content' },
                createVNode('div', { class: 'game-board-section' },
                    createVNode('div', { id: boardId, class: boardClass })
                )
            ),
            // Sidebar with scoreboard and chat
            createVNode('div', { class: 'sidebar' },
                createVNode('div', { id: 'player-board-container', class: 'player-board-section' }),
                createVNode('div', { class: 'chat-area' },
                    createVNode('div', { id: 'chat', class: 'chat-box' }),
                    createVNode('div', { class: 'chat-input-container' },
                        createVNode('input', { id: 'chatInput', placeholder: 'Type a message...' }),
                        createVNode('button', { id: 'send' }, 'Send')
                    )
                )
            )
        )
    )
}

function LobbyScreen() {
    return MainLayout({
        header: createVNode('div', { class: 'game-header' },
            createVNode('h2', {}, 'Lobby: Waiting for players...'),
            createVNode('div', { id: 'lobby-timer-container' }, LobbyTimerComponent()),
            createVNode('div', { id: 'countdown-container', class: 'timer-section' }, CountdownComponent())
        ),
        boardId: 'lobby',
        boardClass: 'lobby-area'
    })
}

function GameScreen() {
    return MainLayout({
        header: createVNode('div', { class: 'game-header' },
            createVNode('button', {
                id: 'leave-game',
                class: 'leave-button',
                onclick: () => {
                    stopSequenceClient()
                    sendLeaveGame()
                }
            }, 'Leave Game')
        ),
        boardId: 'game',
        boardClass: 'game-area'
    })
}

export function CountdownComponent() {
    if (state.countdownTime === null) {
        return createVNode('div', { id: 'countdown', class: 'countdown-timer' }, '')
    }
    return createVNode('div', { id: 'countdown', class: 'countdown-timer' }, `Game starts in: ${state.countdownTime}s`)
}

export function LobbyTimerComponent() {
    if (state.lobbyTime === null) {
        return createVNode('div', { id: 'lobby-timer', class: 'lobby-timer' }, '')
    }
    return createVNode('div', { id: 'lobby-timer', class: 'lobby-timer' }, `Lobby: Game starts in ${state.lobbyTime}s`)
}

export function PlayerCountComponent() {
    return createVNode('div', { class: 'player-count' },
        `Players in lobby: ${state.playerCount}/4`
    )
}

function App() {
    let screenContent
    if (state.screen === 'start') screenContent = StartScreen()
    else if (state.screen === 'lobby') screenContent = LobbyScreen()
    else if (state.screen === 'game') screenContent = GameScreen()
    else screenContent = createVNode('div', {}, 'Game loading...')

    // Only show chat in lobby and game screens
    const showChat = false /*state.screen === 'lobby'  || state.screen === 'game' */

    return createVNode('div', { id: 'app-root' },
        createVNode('div', { id: 'error-container', class: 'error-container' }),
        screenContent,
        showChat && createVNode('div', { class: 'chat-area' },
            createVNode('div', { id: 'chat', class: 'chat-box' }),
            createVNode('input', { id: 'chatInput', placeholder: 'Type a message...' }),
            createVNode('button', { id: 'send' }, 'Send')
        )
    )
}

// Only re-render the entire app when the screen changes
function update(changedPath) {
    if (!changedPath || changedPath === 'screen') {
        mount(document.body, App())

        // Always mount PlayerBoardComponent in the correct container for the current screen
        // if (state.screen === 'lobby') {
        //     const lobbyBoard = document.getElementById('lobby-board-container')
        //     if (lobbyBoard) {
        //         PlayerBoardComponent.mount(lobbyBoard)
        //     }
        // }
        if (state.screen === 'lobby' || state.screen === 'game') {
            const playerBoard = document.getElementById('player-board-container')
            if (playerBoard) {
                PlayerBoardComponent.mount(playerBoard)
            }
        }
        setupChatHandlers()
    }
}

// Prevent default behavior for arrow keys and space to avoid page scrolling
window.addEventListener('keydown', function (e) {
    const chatInput = document.getElementById('chatInput')
    if (chatInput && document.activeElement === chatInput) {
        return
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(e.key)) {
        e.preventDefault()
    };
})

loadAllSounds()
subscribe(update, ['screen']) // Only watch for screen changes
stopSequenceClient()
state.screen = 'start'
update()
