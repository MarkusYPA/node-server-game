const speed = 0.15

export default class MiniGame {
    constructor() {
        this.players = {} // id -> { nickname, x, y }
        this.playerSize = 40 // Player size in pixels
        this.gridSize = 25 // Grid size for movement calculations

        this.dimensions = {
            width: 650,
            height: 550
        }

        this.updateBoundaries()
    }

    updateBoundaries() {
        // Game boundary constants based on current dimensions
        this.minX = 0
        this.minY = 0
        this.maxX = (this.dimensions.width - this.playerSize) / this.gridSize
        this.maxY = (this.dimensions.height - this.playerSize) / this.gridSize
        this.corners = {
            1: { x: this.minX, y: this.minY }, // Top-left
            2: { x: this.maxX, y: this.maxY },  // Bottom-right
            3: { x: this.maxX, y: this.minY }, // Top-right
            4: { x: this.minX, y: this.maxY }, // Bottom-left
        }
    }

    addPlayer(id, nickname) {
        if (Object.keys(this.players).length >= 4) return false
        // Place each player in a different corner based on join order
        const { x, y } = this.corners[id]
        this.players[id] = { nickname, x, y, direction: 'right' }      
        return true
    }

    removePlayer(id) {
        delete this.players[id]
    }

    handleInput(id, held) {
        const p = this.players[id]
        if (!p) return
        let dx = 0, dy = 0
        if (held.up) dy -= 1
        if (held.down) dy += 1
        if (held.left) { dx -= 1; p.direction = 'left' }
        if (held.right) { dx += 1; p.direction = 'right' }
        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071
            dy *= 0.7071
        }
        p.x += dx * speed
        p.y += dy * speed

        // Simple clamping to the bounds of the box
        p.x = Math.max(this.minX, Math.min(this.maxX, p.x))
        p.y = Math.max(this.minY, Math.min(this.maxY, p.y))
    }

    getState() {
        return this.players
    }
}
