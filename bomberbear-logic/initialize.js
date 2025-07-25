import { levelMap, powerUpMap } from './bomberbear-logic.js'
import { Player } from './objects/player.js'
import { BombUp, FlameUp, LifeUp, SpeedUp, WallClip } from './objects/powerup.js'
import { SolidWall, WeakWall } from './objects/walls.js'
import { bbstate } from './bomberbear-state.js'
import { gridStep, halfStep, mult } from './config.js'

export function createPlayer(playerName, id = 1) {
    const playerSpeed = 4.5 * mult
    const playerSize = 55 * mult

    let playerX = halfStep - (playerSize / 2) // player to top left
    let playerY = halfStep - (playerSize / 2)

    if (id === 2) {
        playerX = halfStep - (playerSize / 2) + 12 * gridStep // bottom right
        playerY = halfStep - (playerSize / 2) + 10 * gridStep
    }

    if (id === 3) {
        playerX = halfStep - (playerSize / 2) + 12 * gridStep // top right
        playerY = halfStep - (playerSize / 2)
    }

    if (id === 4) {
        playerX = halfStep - (playerSize / 2) // bottom left
        playerY = halfStep - (playerSize / 2) + 10 * gridStep
    }

    const player = new Player(playerSize, playerSpeed, playerX, playerY, playerName, id)
    return player
};

export function makeLevelMap() {
    // 11 rows and 13 columns
    let map = new Array(11)
    for (let i = 0; i < map.length; i++)  map[i] = new Array(13)
    return map
};

export function makeWalls(level) {
    // place 6 * 5 solid walls inside play area
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 5; j++) {
            const mapX = (1 + i * 2)
            const mapY = (1 + j * 2)
            const x = gridStep * mapX
            const y = gridStep * mapY
            // Create SolidWall instance with level passed
            const newSolid = new SolidWall(x, y, gridStep, level)      // 6 * 5 solid walls
            bbstate.solidWalls.push(newSolid)

            levelMap[mapY][mapX] = 'solidWall'
        };
    };

    // put solid walls around play area
    const yVals = [-1, 11]
    for (let i = 0; i < 15; i++) {
        for (const yVal of yVals) {
            const mapX = i - 1
            const mapY = yVal
            const x = gridStep * mapX
            const y = gridStep * mapY
            const newSolid = new SolidWall(x, y, gridStep, level)
            bbstate.surroundingWalls.push(newSolid)
        }
    };
    const xVals = [-1, 13]
    for (let i = 0; i < 11; i++) {
        for (const xVal of xVals) {
            const mapX = xVal
            const mapY = i
            const x = gridStep * mapX
            const y = gridStep * mapY
            const newSolid = new SolidWall(x, y, gridStep, level)
            bbstate.surroundingWalls.push(newSolid)
        }
    };

    // place weak walls randomly
    while (bbstate.weakWalls.size < 44) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        // don't replace content or put walls in corners
        if (levelMap[mapY][mapX] ||
            (mapX < 2 && mapY < 2) ||
            (mapX > 10 && mapY > 8) ||
            (mapX > 10 && mapY < 2) ||
            (mapX < 2 && mapY > 8)
        ) {
            continue
        };

        const x = gridStep * mapX
        const y = gridStep * mapY
        const name = `weakWall${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
        const newWeak = new WeakWall(x, y, gridStep, level, name)

        bbstate.weakWalls.set(name, newWeak)
        levelMap[mapY][mapX] = name
    };

    // place 8 bomb powerups inside weak walls
    let placements = 0
    while (placements < 8) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX
            const y = gridStep * mapY
            const name = `bombUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
            const newBombUp = new BombUp(x, y, gridStep * 1.0, name, mapY, mapX)
            bbstate.powerups.set(name, newBombUp)
            powerUpMap[mapY][mapX] = [name, newBombUp]
            placements ++
        };
    }

    // place 8 flame powerups inside weak walls
    placements = 0
    while (placements < 8) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX
            const y = gridStep * mapY
            const name = `flameUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
            const newFlameUp = new FlameUp(x, y, gridStep * 1.0, name, mapY, mapX)
            bbstate.powerups.set(name, newFlameUp)
            powerUpMap[mapY][mapX] = [name, newFlameUp]
            placements ++
        };
    }

    // place 3 speed powerups inside weak walls  
    placements = 0
    while (placements < 3) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX
            const y = gridStep * mapY
            const name = `speedUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
            const newSpeedUp = new SpeedUp(x, y, gridStep * 1.0, name, mapY, mapX)
            bbstate.powerups.set(name, newSpeedUp)
            powerUpMap[mapY][mapX] = [name, newSpeedUp]
            placements ++
        };
    }

    // place 2 life powerups inside weak walls  
    placements = 0
    while (placements < 2) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX
            const y = gridStep * mapY
            const name = `lifeUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
            const newLifeUp = new LifeUp(x, y, gridStep * 1.0, name, mapY, mapX)
            bbstate.powerups.set(name, newLifeUp)
            powerUpMap[mapY][mapX] = [name, newLifeUp]
            placements ++
        };
    }

    // place 2 wall clip powerups inside weak walls  
    placements = 0
    while (placements < 2) {
        const mapX = Math.floor(Math.random() * 13)
        const mapY = Math.floor(Math.random() * 11)

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX
            const y = gridStep * mapY
            const name = `wallClip${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`
            const newWallClip = new WallClip(x, y, gridStep * 1.0, name, mapY, mapX)
            bbstate.powerups.set(name, newWallClip)
            powerUpMap[mapY][mapX] = [name, newWallClip]
            placements ++
        };
    }
};
