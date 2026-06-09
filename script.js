const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentLevel = 1;
let gameRunning = true;
let gameOver = false;
let player = { x: 0, y: 0, size: 30, hp: 100, maxHp: 100 };
let keys = [];
let enemies = [];
let walls = [];
let exitPoint = null;
let startDoor = null;
let npcs = [];
let powerups = [];
let shieldActive = false;
let invisibleActive = false;
let shieldEndTime = 0;
let invisibleEndTime = 0;
let stunGunAmmo = 0;
let stunCooldown = false;
let stunCooldownEnd = 0;
let stunnedEnemies = [];
let nearNPC = null;
let npcBubbleTimeout = null;
let playerStatus = "Normal";
let inventoryItems = [];
let draggedItemIndex = null;
let notificationText = "";
let notificationTimer = 0;
let pursuitMode = false;
let glassesActive = false;
let glassesEndTime = 0;

class AStar {
    constructor(walls, canvasWidth, canvasHeight, cellSize = 25) {
        this.walls = walls;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.cellSize = cellSize;
        this.cols = Math.ceil(canvasWidth / cellSize);
        this.rows = Math.ceil(canvasHeight / cellSize);
        this.wallGrid = this.buildWallGrid();
    }

    buildWallGrid() {
        const grid = Array(this.rows).fill().map(() => Array(this.cols).fill(false));
        for (let wall of this.walls) {
            const startCol = Math.floor(wall.x / this.cellSize);
            const endCol = Math.floor((wall.x + wall.width) / this.cellSize);
            const startRow = Math.floor(wall.y / this.cellSize);
            const endRow = Math.floor((wall.y + wall.height) / this.cellSize);
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                        grid[row][col] = true;
                    }
                }
            }
        }
        return grid;
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { row: -1, col: 0, cost: 1 },
            { row: 1, col: 0, cost: 1 },
            { row: 0, col: -1, cost: 1 },
            { row: 0, col: 1, cost: 1 },
            { row: -1, col: -1, cost: 1.4 },
            { row: -1, col: 1, cost: 1.4 },
            { row: 1, col: -1, cost: 1.4 },
            { row: 1, col: 1, cost: 1.4 }
        ];
        for (let dir of directions) {
            const newRow = node.row + dir.row;
            const newCol = node.col + dir.col;
            if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
                if (!this.wallGrid[newRow][newCol]) {
                    neighbors.push({ row: newRow, col: newCol, cost: dir.cost });
                }
            }
        }
        return neighbors;
    }

    heuristic(row1, col1, row2, col2) {
        return Math.abs(row1 - row2) + Math.abs(col1 - col2);
    }

    findPath(startX, startY, targetX, targetY) {
        const startCol = Math.floor(startX / this.cellSize);
        const startRow = Math.floor(startY / this.cellSize);
        const targetCol = Math.floor(targetX / this.cellSize);
        const targetRow = Math.floor(targetY / this.cellSize);
        
        if (startRow < 0 || startRow >= this.rows || startCol < 0 || startCol >= this.cols ||
            targetRow < 0 || targetRow >= this.rows || targetCol < 0 || targetCol >= this.cols) {
            return null;
        }
        
        if (this.wallGrid[startRow][startCol] || this.wallGrid[targetRow][targetCol]) {
            return null;
        }
        
        const openSet = [{ row: startRow, col: startCol }];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        const getKey = (row, col) => `${row},${col}`;
        
        gScore.set(getKey(startRow, startCol), 0);
        fScore.set(getKey(startRow, startCol), this.heuristic(startRow, startCol, targetRow, targetCol));
        
        while (openSet.length > 0) {
            let current = openSet.reduce((min, node) => {
                const currentKey = getKey(node.row, node.col);
                const minKey = getKey(min.row, min.col);
                return fScore.get(currentKey) < fScore.get(minKey) ? node : min;
            });
            
            if (current.row === targetRow && current.col === targetCol) {
                const path = [];
                let curr = current;
                while (curr) {
                    path.unshift({
                        x: curr.col * this.cellSize + this.cellSize / 2,
                        y: curr.row * this.cellSize + this.cellSize / 2
                    });
                    const key = getKey(curr.row, curr.col);
                    curr = cameFrom.get(key);
                }
                return path;
            }
            
            const index = openSet.findIndex(node => node.row === current.row && node.col === current.col);
            openSet.splice(index, 1);
            
            const neighbors = this.getNeighbors(current);
            for (let neighbor of neighbors) {
                const tentativeG = gScore.get(getKey(current.row, current.col)) + neighbor.cost;
                const neighborKey = getKey(neighbor.row, neighbor.col);
                
                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor.row, neighbor.col, targetRow, targetCol));
                    
                    if (!openSet.some(node => node.row === neighbor.row && node.col === neighbor.col)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return null;
    }

    updateWalls(walls) {
        this.walls = walls;
        this.wallGrid = this.buildWallGrid();
    }
}

let aStar = null;

class InventoryItem {
    constructor(id, name, type, emoji, value = 0, ammo = 0) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.emoji = emoji;
        this.value = value;
        this.ammo = ammo;
    }
    
    clone() {
        return new InventoryItem(this.id, this.name, this.type, this.emoji, this.value, this.ammo);
    }
}

function initInventory() {
    inventoryItems = [];
}

function addItemToInventory(item) {
    if (item.type === 'stunGun') {
        for (let existingItem of inventoryItems) {
            if (existingItem.type === 'stunGun') {
                existingItem.ammo += item.ammo;
                updateInventoryUI();
                showNotification(`✨ ${item.name} adicionado! (+${item.ammo} munição)`);
                return;
            }
        }
    }
    inventoryItems.push(item);
    updateInventoryUI();
    showNotification(`✨ ${item.name} adicionado ao inventário! (+${item.value}💰)`);
}

function removeItemFromInventory(index) {
    if (index >= 0 && index < inventoryItems.length) {
        const item = inventoryItems[index];
        inventoryItems.splice(index, 1);
        updateInventoryUI();
        return item;
    }
    return null;
}

function moveInventoryItem(fromIndex, toIndex) {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= inventoryItems.length) return false;
    if (toIndex < 0 || toIndex >= inventoryItems.length) return false;
    const item = inventoryItems[fromIndex];
    inventoryItems.splice(fromIndex, 1);
    inventoryItems.splice(toIndex, 0, item);
    updateInventoryUI();
    showNotification(`📦 Item movido para posição ${toIndex + 1}`);
    return true;
}

function useItemByIndex(index) {
    if (index >= 0 && index < inventoryItems.length) {
        const item = inventoryItems[index];
        switch(item.type) {
            case 'glasses':
                activateGlasses();
                removeItemFromInventory(index);
                break;
            case 'shield':
                activateShield();
                removeItemFromInventory(index);
                break;
            case 'invisibility':
                activateInvisibility();
                removeItemFromInventory(index);
                break;
            case 'stunGun':
                if (item.ammo > 0) {
                    stunGunAmmo += item.ammo;
                    showNotification(`🔫 Arma carregada! ${stunGunAmmo} tiros disponíveis.`);
                    removeItemFromInventory(index);
                }
                break;
            default:
                showNotification(`✨ Você usou ${item.name}!`);
                removeItemFromInventory(index);
        }
    }
}

function showNotification(text) {
    notificationText = text;
    notificationTimer = 60;
}

function drawNotification() {
    if (notificationTimer > 0 && notificationText) {
        ctx.font = '12px monospace';
        ctx.fillStyle = '#00ff88';
        ctx.shadowBlur = 0;
        ctx.fillText(notificationText, canvas.width - 250, canvas.height - 20);
        notificationTimer--;
    }
}

function getTotalValue() {
    return inventoryItems.reduce((sum, item) => sum + item.value, 0);
}

function getItemCount() {
    return inventoryItems.length;
}

let optimalFullPath = [];

function calculateOptimalFullPath() {
    if (!aStar) return [];
    
    const activeKeys = keys.filter(k => !k.collected);
    
    let currentPos = { x: player.x + player.size / 2, y: player.y + player.size / 2 };
    let fullPath = [];
    
    if (activeKeys.length > 0) {
        const keyPoints = activeKeys.map(k => ({ x: k.x + 10, y: k.y + 10, key: k }));
        const unvisited = [...keyPoints];
        const orderedPoints = [unvisited.shift()];
        
        while (unvisited.length > 0) {
            let lastPoint = orderedPoints[orderedPoints.length - 1];
            let nearestIdx = 0;
            let minDist = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const dist = Math.hypot(lastPoint.x - unvisited[i].x, lastPoint.y - unvisited[i].y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }
            orderedPoints.push(unvisited[nearestIdx]);
            unvisited.splice(nearestIdx, 1);
        }
        
        for (let i = 0; i < orderedPoints.length; i++) {
            const targetPos = orderedPoints[i];
            const pathSegment = aStar.findPath(currentPos.x, currentPos.y, targetPos.x, targetPos.y);
            if (pathSegment && pathSegment.length > 0) {
                for (let j = 0; j < pathSegment.length; j++) {
                    fullPath.push(pathSegment[j]);
                }
            }
            currentPos = targetPos;
        }
    }
    
    if (exitPoint) {
        const exitPos = { x: exitPoint.x + 15, y: exitPoint.y + 15 };
        const pathToExit = aStar.findPath(currentPos.x, currentPos.y, exitPos.x, exitPos.y);
        if (pathToExit && pathToExit.length > 0) {
            for (let j = 0; j < pathToExit.length; j++) {
                fullPath.push(pathToExit[j]);
            }
        }
    }
    
    return fullPath;
}

function updateTSPRoute() {
    const activeKeys = keys.filter(k => !k.collected);
    if (activeKeys.length > 0) {
        let tempDist = 0;
        for (let i = 1; i < activeKeys.length; i++) {
            tempDist += Math.hypot(activeKeys[i].x - activeKeys[i-1].x, activeKeys[i].y - activeKeys[i-1].y);
        }
        document.getElementById('route-length').textContent = Math.round(tempDist);
    } else {
        document.getElementById('route-length').textContent = '0';
    }
    
    if (glassesActive && aStar) {
        optimalFullPath = calculateOptimalFullPath();
    }
}

function activateGlasses() {
    if (glassesActive) {
        showNotification('⚠️ Óculos TSP já está ativo!');
        return;
    }
    glassesActive = true;
    glassesEndTime = Date.now() + 20000;
    playerStatus = "👓 Óculos TSP Ativo (20s)";
    document.getElementById('player-status').textContent = playerStatus;
    showNotification('👓 Óculos TSP ativado! Rota otimizada visível por 20 segundos!');
    
    if (aStar) {
        optimalFullPath = calculateOptimalFullPath();
    }
    
    setTimeout(() => {
        if (glassesActive && Date.now() >= glassesEndTime) {
            glassesActive = false;
            playerStatus = "Normal";
            document.getElementById('player-status').textContent = playerStatus;
            optimalFullPath = [];
            showNotification('👓 Efeito dos óculos TSP expirou');
        }
    }, 20000);
}

function activateShield() {
    if (shieldActive) {
        showNotification('⚠️ Escudo já está ativo!');
        return;
    }
    shieldActive = true;
    shieldEndTime = Date.now() + 7000;
    playerStatus = "🛡️ Escudo Ativo";
    document.getElementById('player-status').textContent = playerStatus;
    showNotification('🛡️ Escudo Ativado! Protegido por 7 segundos!');
    setTimeout(() => {
        if (shieldActive && Date.now() >= shieldEndTime) {
            shieldActive = false;
            playerStatus = "Normal";
            document.getElementById('player-status').textContent = playerStatus;
            showNotification('Escudo expirado');
        }
    }, 7000);
}

function activateInvisibility() {
    if (invisibleActive) {
        showNotification('⚠️ Invisível já está ativo!');
        return;
    }
    invisibleActive = true;
    invisibleEndTime = Date.now() + 5000;
    playerStatus = "✨ Invisível (5s)";
    document.getElementById('player-status').textContent = playerStatus;
    showNotification('✨ Invisibilidade ativada! Invisível por 5 segundos!');
    setTimeout(() => {
        if (invisibleActive && Date.now() >= invisibleEndTime) {
            invisibleActive = false;
            playerStatus = "Normal";
            document.getElementById('player-status').textContent = playerStatus;
            showNotification('Invisibilidade expirada');
        }
    }, 5000);
}

function useStunGun() {
    if (stunGunAmmo <= 0) {
        showNotification('❌ Sem munição! Colete uma arma no mapa.');
        return;
    }
    if (stunCooldown) {
        showNotification(`⏳ Recarregando...`);
        return;
    }
    let closestEnemy = null;
    let closestDist = 150;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = { index: i, x: enemy.x, y: enemy.y };
        }
    }
    if (closestEnemy) {
        stunGunAmmo--;
        stunCooldown = true;
        stunCooldownEnd = Date.now() + 800;
        stunnedEnemies.push({ index: closestEnemy.index, endTime: Date.now() + 3000 });
        showNotification(`🔫 Tiro certeiro! Inimigo atordoado por 3 segundos!`);
        setTimeout(() => { stunCooldown = false; }, 800);
    } else {
        showNotification('❌ Nenhum inimigo próximo!');
    }
}

function updateInventoryUI() {
    updateInventoryGrid();
    document.getElementById('inventoryCount').textContent = getItemCount();
    document.getElementById('inventoryTotalValue').textContent = getTotalValue();
}

function updateInventoryGrid() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (inventoryItems.length === 0) {
        const emptySlot = document.createElement('div');
        emptySlot.style.gridColumn = '1 / -1';
        emptySlot.style.textAlign = 'center';
        emptySlot.style.padding = '40px';
        emptySlot.style.color = '#888';
        emptySlot.innerHTML = '📦 Nenhum item coletado ainda!<br>Explore o mapa para encontrar chaves e power-ups!<br><br>💡 Dica: Arraste os itens para reorganizar!';
        grid.appendChild(emptySlot);
    } else {
        for (let i = 0; i < inventoryItems.length; i++) {
            const item = inventoryItems[i];
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.setAttribute('data-index', i);
            slot.setAttribute('draggable', 'true');
            let ammoHtml = '';
            if (item.type === 'stunGun' && item.ammo > 0) {
                ammoHtml = `<div class="inventory-slot-ammo">🔫${item.ammo}</div>`;
            }
            slot.innerHTML = `
                <div class="inventory-slot-emoji">${item.emoji}</div>
                <div class="inventory-slot-name">${item.name}</div>
                <div class="inventory-slot-value">💰${item.value}</div>
                ${ammoHtml}
                <button class="use-item-btn" data-index="${i}">USAR</button>
            `;
            slot.addEventListener('dragstart', handleDragStart);
            slot.addEventListener('dragend', handleDragEnd);
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('dragleave', handleDragLeave);
            slot.addEventListener('drop', handleDrop);
            grid.appendChild(slot);
        }
        document.querySelectorAll('.use-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'));
                useItemByIndex(index);
            });
        });
    }
}

let dragIndex = null;

function handleDragStart(e) {
    const slot = e.target.closest('.inventory-slot');
    if (!slot) { e.preventDefault(); return false; }
    dragIndex = parseInt(slot.getAttribute('data-index'));
    if (isNaN(dragIndex)) { e.preventDefault(); return false; }
    e.dataTransfer.setData('text/plain', dragIndex);
    e.dataTransfer.effectAllowed = 'move';
    slot.style.opacity = '0.5';
}

function handleDragEnd(e) {
    const slot = e.target.closest('.inventory-slot');
    if (slot) slot.style.opacity = '1';
    document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('drag-over'));
    dragIndex = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slot = e.target.closest('.inventory-slot');
    if (slot && dragIndex !== null) slot.classList.add('drag-over');
}

function handleDragLeave(e) {
    const slot = e.target.closest('.inventory-slot');
    if (slot) slot.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const targetSlot = e.target.closest('.inventory-slot');
    if (!targetSlot) return;
    const targetIndex = parseInt(targetSlot.getAttribute('data-index'));
    if (isNaN(targetIndex)) return;
    if (dragIndex !== null && dragIndex !== targetIndex) moveInventoryItem(dragIndex, targetIndex);
    targetSlot.classList.remove('drag-over');
    dragIndex = null;
}

function checkCollisionWithWalls(x, y, size) {
    for (let wall of walls) {
        if (x < wall.x + wall.width && x + size > wall.x && y < wall.y + wall.height && y + size > wall.y) return true;
    }
    return false;
}

function checkCollisionWithWallsPoint(x, y, radius = 10) {
    for (let wall of walls) {
        if (x + radius > wall.x && x - radius < wall.x + wall.width && y + radius > wall.y && y - radius < wall.y + wall.height) return true;
    }
    return false;
}

function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    if (!checkCollisionWithWalls(newX, player.y, player.size)) player.x = newX;
    if (!checkCollisionWithWalls(player.x, newY, player.size)) player.y = newY;
    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
}

function updateEnemies() {
    const now = Date.now();
    const keysCollected = keys.filter(k => k.collected).length;
    const totalKeys = keys.length;
    if (!pursuitMode && keysCollected === totalKeys - 1) {
        pursuitMode = true;
        showNotification('⚠️ VOCÊ COLETOU A PENÚLTIMA CHAVE! OS INIMIGOS ESTÃO VINDO ATRÁS DE VOCÊ! ⚠️');
        for (let enemy of enemies) { enemy.currentPath = []; enemy.lastPathTime = 0; }
    }
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const isStunned = stunnedEnemies.some(s => s.index === i && now < s.endTime);
        if (isStunned) continue;
        let moveX = 0, moveY = 0;
        if (pursuitMode && aStar) {
            if (now - enemy.lastPathTime > 300 || !enemy.currentPath || enemy.currentPath.length === 0) {
                const targetX = player.x + player.size / 2;
                const targetY = player.y + player.size / 2;
                const path = aStar.findPath(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, targetX, targetY);
                if (path && path.length > 1) { enemy.currentPath = path; enemy.pathIndex = 1; }
                else if (path && path.length === 1) { enemy.currentPath = path; enemy.pathIndex = 0; }
                else enemy.currentPath = [];
                enemy.lastPathTime = now;
            }
            if (enemy.currentPath && enemy.currentPath.length > 0 && enemy.pathIndex < enemy.currentPath.length) {
                const targetPoint = enemy.currentPath[enemy.pathIndex];
                const dx = targetPoint.x - (enemy.x + enemy.size / 2);
                const dy = targetPoint.y - (enemy.y + enemy.size / 2);
                const distance = Math.hypot(dx, dy);
                if (distance < 8) enemy.pathIndex++;
                else { moveX = (dx / distance) * enemy.speed; moveY = (dy / distance) * enemy.speed; }
            } else {
                const dx = (player.x + player.size / 2) - (enemy.x + enemy.size / 2);
                const dy = (player.y + player.size / 2) - (enemy.y + enemy.size / 2);
                const distance = Math.hypot(dx, dy);
                if (distance > 0) { moveX = (dx / distance) * enemy.speed; moveY = (dy / distance) * enemy.speed; }
            }
        } else {
            enemy.patrolAngle += 0.025 * (enemy.speed * 0.8);
            const targetX = enemy.startX + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
            const targetY = enemy.startY + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 0) { moveX = (dx / distance) * (enemy.speed * 0.7); moveY = (dy / distance) * (enemy.speed * 0.7); }
            else { moveX = (Math.sin(Date.now() * 0.002) * 1.5); moveY = (Math.cos(Date.now() * 0.0023) * 1.5); }
        }
        if (moveX !== 0 || moveY !== 0) {
            let newX = enemy.x + moveX;
            let newY = enemy.y + moveY;
            if (!checkCollisionWithWallsPoint(newX + enemy.size / 2, enemy.y + enemy.size / 2, enemy.size / 2)) enemy.x = newX;
            if (!checkCollisionWithWallsPoint(enemy.x + enemy.size / 2, newY + enemy.size / 2, enemy.size / 2)) enemy.y = newY;
            const dxSinceLast = Math.abs(enemy.x - enemy.lastX);
            const dySinceLast = Math.abs(enemy.y - enemy.lastY);
            if (dxSinceLast < 0.3 && dySinceLast < 0.3) {
                enemy.stuckCounter++;
                if (enemy.stuckCounter > 40) {
                    enemy.x += (Math.random() - 0.5) * 20;
                    enemy.y += (Math.random() - 0.5) * 20;
                    enemy.stuckCounter = 0;
                    if (pursuitMode) enemy.currentPath = [];
                }
            } else enemy.stuckCounter = Math.max(0, enemy.stuckCounter - 1);
        }
        enemy.lastX = enemy.x;
        enemy.lastY = enemy.y;
        enemy.x = Math.max(5, Math.min(canvas.width - enemy.size - 5, enemy.x));
        enemy.y = Math.max(5, Math.min(canvas.height - enemy.size - 5, enemy.y));
    }
    stunnedEnemies = stunnedEnemies.filter(s => now < s.endTime);
}

function gameOverSequence() {
    gameRunning = false;
    gameOver = true;
    document.getElementById('gameOverBox').style.display = 'block';
}

function restartGame() {
    document.getElementById('gameOverBox').style.display = 'none';
    loadLevel(currentLevel);
}

function checkCollisions() {
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key.collected) {
            if (player.x < key.x + 20 && player.x + player.size > key.x && player.y < key.y + 20 && player.y + player.size > key.y) {
                key.collected = true;
                addItemToInventory(new InventoryItem(`key_${Date.now()}`, key.name, 'key', key.emoji, key.value));
                updateTSPRoute();
                document.getElementById('keys-collected').textContent = `${keys.filter(k => k.collected).length}/${keys.length}`;
                if (glassesActive && aStar) {
                    optimalFullPath = calculateOptimalFullPath();
                }
            }
        }
    }
    for (let i = 0; i < powerups.length; i++) {
        const powerup = powerups[i];
        if (!powerup.collected) {
            if (player.x < powerup.x + 20 && player.x + player.size > powerup.x && player.y < powerup.y + 20 && player.y + player.size > powerup.y) {
                powerup.collected = true;
                const item = new InventoryItem(`${powerup.type}_${Date.now()}`, powerup.name, powerup.type, powerup.emoji, powerup.value);
                if (powerup.type === 'stunGun') item.ammo = 3;
                addItemToInventory(item);
            }
        }
    }
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (player.x < enemy.x + enemy.size && player.x + player.size > enemy.x && player.y < enemy.y + enemy.size && player.y + player.size > enemy.y) {
            if (!shieldActive && !invisibleActive) { gameOverSequence(); return; }
            else if (shieldActive) {
                showNotification('🛡️ Escudo protegeu do inimigo!');
                enemies.splice(i, 1);
                i--;
                document.getElementById('enemies-left').textContent = enemies.length;
            }
        }
    }
    checkNearNPC();
    const allKeysCollected = keys.length > 0 && keys.every(k => k.collected);
    if (allKeysCollected && exitPoint) {
        if (player.x < exitPoint.x + 30 && player.x + player.size > exitPoint.x && player.y < exitPoint.y + 30 && player.y + player.size > exitPoint.y) {
            completeLevel();
        }
    }
}

function checkNearNPC() {
    let foundNPC = null;
    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc.interacted) {
            if (player.x < npc.x + 40 && player.x + player.size > npc.x - 10 && player.y < npc.y + 40 && player.y + player.size > npc.y - 10) {
                foundNPC = npc;
                break;
            }
        }
    }
    if (foundNPC && foundNPC !== nearNPC) { nearNPC = foundNPC; showNPCDialogBubble(foundNPC, true); }
    else if (!foundNPC && nearNPC) { nearNPC = null; hideNPCDialogBubble(); }
}

function showNPCDialogBubble(npc, showHint = true) {
    const bubble = document.getElementById('npcBubble');
    const bubbleText = document.getElementById('npcBubbleText');
    const hint = document.querySelector('.npc-bubble-hint');
    bubbleText.innerHTML = npc.dialog;
    hint.style.display = showHint ? 'block' : 'none';
    const canvasRect = canvas.getBoundingClientRect();
    const npcScreenX = canvasRect.left + npc.x;
    const npcScreenY = canvasRect.top + npc.y;
    bubble.style.left = `${npcScreenX - 100}px`;
    bubble.style.top = `${npcScreenY - 80}px`;
    bubble.style.display = 'block';
}

function hideNPCDialogBubble() {
    document.getElementById('npcBubble').style.display = 'none';
}

function interactWithNPC() {
    if (nearNPC && !nearNPC.interacted) {
        nearNPC.interacted = true;
        const item = new InventoryItem(nearNPC.item.id, nearNPC.item.name, nearNPC.item.type, nearNPC.item.emoji, nearNPC.item.value);
        if (nearNPC.item.type === 'stunGun') item.ammo = 3;
        addItemToInventory(item);
        hideNPCDialogBubble();
        nearNPC = null;
    }
}

function completeLevel() {
    gameRunning = false;
    const messageBox = document.getElementById('messageBox');
    if (currentLevel === 3) {
        document.getElementById('messageTitle').textContent = '🏆 VITÓRIA! 🏆';
        document.getElementById('messageText').innerHTML = `Parabéns! Você completou o jogo!<br><br>🎒 Inventário final:<br>${inventoryItems.map(i => `${i.emoji} ${i.name}`).join('<br>')}<br><br>💰 Valor total: ${getTotalValue()}`;
    } else {
        document.getElementById('messageTitle').textContent = 'Fase Concluída!';
        document.getElementById('messageText').innerHTML = `✨ Você coletou ${getItemCount()} itens! Prepare-se para a próxima fase!`;
    }
    messageBox.style.display = 'block';
}

function nextLevel() {
    if (currentLevel < 3) { currentLevel++; loadLevel(currentLevel); }
    else { currentLevel = 1; loadLevel(1); }
    document.getElementById('messageBox').style.display = 'none';
}

function toggleInventory() {
    const panel = document.getElementById('inventoryPanel');
    if (panel.style.display === 'none' || panel.style.display === '') { updateInventoryUI(); panel.style.display = 'block'; }
    else panel.style.display = 'none';
}

function draw() {
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    
    if (glassesActive && optimalFullPath && optimalFullPath.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        let firstPoint = optimalFullPath[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < optimalFullPath.length; i++) {
            ctx.lineTo(optimalFullPath[i].x, optimalFullPath[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        for (let i = 0; i < optimalFullPath.length - 1; i += 15) {
            const p1 = optimalFullPath[i];
            const p2 = optimalFullPath[i + 1];
            if (p1 && p2) {
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const arrowX = p1.x + Math.cos(angle) * 8;
                const arrowY = p1.y + Math.sin(angle) * 8;
                ctx.fillStyle = '#00ff88';
                ctx.font = '12px monospace';
                ctx.fillText('▶', arrowX - 4, arrowY - 4);
            }
        }
        
        for (let i = 0; i < optimalFullPath.length; i += 20) {
            ctx.beginPath();
            ctx.fillStyle = '#00ff88';
            ctx.arc(optimalFullPath[i].x, optimalFullPath[i].y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.setLineDash([]);
    }
    
    ctx.fillStyle = '#2a2a3e';
    for (let wall of walls) {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        ctx.strokeStyle = '#3a3a4e';
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }
    
    if (startDoor) {
        ctx.fillStyle = '#0088cc';
        ctx.fillRect(startDoor.x, startDoor.y, 30, 30);
        ctx.fillStyle = '#00ccff';
        ctx.fillRect(startDoor.x + 4, startDoor.y + 4, 22, 22);
        ctx.font = '26px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🚪', startDoor.x + 4, startDoor.y + 26);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#88ddff';
        ctx.fillText('SAÍDA', startDoor.x + 2, startDoor.y - 2);
    }
    
    for (let powerup of powerups) {
        if (!powerup.collected) {
            ctx.font = '28px Arial';
            ctx.fillStyle = '#ffaa00';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ffaa00';
            ctx.fillText(powerup.emoji, powerup.x, powerup.y + 25);
            ctx.shadowBlur = 0;
            ctx.font = '8px monospace';
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(powerup.name, powerup.x - 5, powerup.y + 40);
        }
    }
    
    for (let npc of npcs) {
        if (!npc.interacted) {
            ctx.fillStyle = '#44ff88';
            ctx.beginPath();
            ctx.arc(npc.x + 15, npc.y + 15, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '24px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🧙', npc.x + 3, npc.y + 28);
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('💬 F', npc.x + 5, npc.y - 5);
        }
    }
    
    for (let key of keys) {
        if (!key.collected) {
            ctx.font = '30px Arial';
            ctx.fillStyle = '#ffd700';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffd700';
            ctx.fillText('🔑', key.x, key.y + 25);
            ctx.shadowBlur = 0;
            ctx.font = '8px monospace';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(key.name, key.x - 5, key.y + 40);
        }
    }
    
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const isStunned = stunnedEnemies.some(s => s.index === i && Date.now() < s.endTime);
        if (isStunned) {
            ctx.fillStyle = '#888888';
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '22px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('😵', enemy.x + 3, enemy.y + enemy.size - 5);
        } else {
            if (pursuitMode) {
                ctx.fillStyle = '#ff3333';
                ctx.beginPath();
                ctx.arc(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(enemy.x + enemy.size * 0.35, enemy.y + enemy.size * 0.35, 4, 0, Math.PI * 2);
                ctx.arc(enemy.x + enemy.size * 0.65, enemy.y + enemy.size * 0.35, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '22px Arial';
                ctx.fillText('👹', enemy.x + 3, enemy.y + enemy.size - 5);
            } else {
                ctx.fillStyle = '#884444';
                ctx.beginPath();
                ctx.arc(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '22px Arial';
                ctx.fillText('👹', enemy.x + 3, enemy.y + enemy.size - 5);
            }
        }
    }
    
    const allKeysCollected = keys.length > 0 && keys.every(k => k.collected);
    if (exitPoint) {
        if (allKeysCollected) {
            ctx.fillStyle = '#00ff88';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(exitPoint.x, exitPoint.y, 30, 30);
            ctx.globalAlpha = 1;
            ctx.font = '30px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🚪', exitPoint.x + 2, exitPoint.y + 28);
            ctx.font = '9px monospace';
            ctx.fillStyle = '#aaffaa';
            ctx.fillText('SAÍDA', exitPoint.x + 2, exitPoint.y - 2);
        } else {
            ctx.fillStyle = '#444444';
            ctx.fillRect(exitPoint.x, exitPoint.y, 30, 30);
            ctx.font = '30px Arial';
            ctx.fillStyle = '#888888';
            ctx.fillText('🔒', exitPoint.x + 2, exitPoint.y + 28);
            ctx.font = '10px monospace';
            ctx.fillStyle = '#888888';
            ctx.fillText(`${keys.filter(k => !k.collected).length} chaves restantes`, exitPoint.x - 10, exitPoint.y - 20);
        }
    }
    
    if (invisibleActive) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#00aaff';
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '25px Arial';
    ctx.fillText('😀', player.x + 5, player.y + 25);
    ctx.globalAlpha = 1;
    
    if (glassesActive) {
        ctx.beginPath();
        ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2 + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        const remaining = Math.ceil((glassesEndTime - Date.now()) / 1000);
        if (remaining > 0) { ctx.font = '10px monospace'; ctx.fillStyle = '#00ff88'; ctx.fillText(`👓 ${remaining}s`, player.x + 35, player.y + 5); }
    }
    
    if (shieldActive) {
        ctx.beginPath();
        ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2 + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2 + 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#44ffaa';
        ctx.lineWidth = 2;
        ctx.stroke();
        const remaining = Math.ceil((shieldEndTime - Date.now()) / 1000);
        if (remaining > 0) { ctx.font = '10px monospace'; ctx.fillStyle = '#00ff88'; ctx.fillText(`🛡️ ${remaining}s`, player.x + 35, player.y + 15); }
    }
    
    if (invisibleActive && invisibleEndTime > Date.now()) {
        const remaining = Math.ceil((invisibleEndTime - Date.now()) / 1000);
        ctx.font = '10px monospace'; ctx.fillStyle = '#aa88ff'; ctx.fillText(`✨ ${remaining}s`, player.x + 35, player.y + 30);
    }
    
    if (pursuitMode && !allKeysCollected) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff0000';
        ctx.fillText('⚠️ INIMIGOS EM PERSGUIÇÃO! ⚠️', canvas.width / 2 - 130, 30);
        ctx.shadowBlur = 0;
    }
    
    if (!glassesActive && keys.some(k => !k.collected) && inventoryItems.some(i => i.type === 'glasses')) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#ffaa00';
        ctx.fillText('💡 Use os Óculos TSP do seu inventário para ver a rota otimizada!', canvas.width / 2 - 200, canvas.height - 10);
    }
    
    drawNotification();
}

function loadLevel(level) {
    const levelData = levels[level];
    if (!levelData) return false;
    player = { ...levelData.playerStart, size: 30, hp: 100, maxHp: 100 };
    startDoor = { ...levelData.startDoor };
    keys = levelData.keys.map(k => ({ ...k, collected: false }));
    enemies = levelData.enemies.map((e, idx) => ({
        ...e, x: e.x, y: e.y, startX: e.x, startY: e.y, size: e.size || 25, speed: e.speed || 2,
        currentPath: [], pathIndex: 0, lastPathTime: 0, patrolAngle: Math.random() * Math.PI * 2,
        patrolRadius: e.patrolRadius || 100, stuckCounter: 0, lastX: e.x, lastY: e.y
    }));
    walls = levelData.walls;
    exitPoint = levelData.exit;
    npcs = levelData.npcs.map(npc => ({ ...npc, interacted: false }));
    powerups = levelData.powerups.map(p => ({ ...p, collected: false }));
    aStar = new AStar(walls, canvas.width, canvas.height, 25);
    pursuitMode = false;
    glassesActive = false;
    initInventory();
    shieldActive = false;
    invisibleActive = false;
    stunGunAmmo = 0;
    stunnedEnemies = [];
    gameOver = false;
    gameRunning = true;
    optimalFullPath = [];
    playerStatus = "Normal";
    document.getElementById('player-status').textContent = playerStatus;
    updateTSPRoute();
    document.getElementById('level').textContent = level;
    document.getElementById('keys-collected').textContent = `0/${keys.length}`;
    document.getElementById('enemies-left').textContent = enemies.length;
    updateInventoryUI();
    return true;
}

const levels = {
    1: {
        playerStart: { x: 100, y: 100 },
        startDoor: { x: 100, y: 100 },
        keys: [
            { x: 620, y: 150, value: 10, name: "Chave Bronze", emoji: "🔑" },
            { x: 550, y: 520, value: 15, name: "Chave Prata", emoji: "🔑" },
            { x: 150, y: 550, value: 10, name: "Chave Bronze", emoji: "🔑" }
        ],
        enemies: [
            { x: 350, y: 350, speed: 2, size: 25, patrolRadius: 100 },
            { x: 500, y: 150, speed: 2, size: 25, patrolRadius: 100 }
        ],
        walls: [
            { x: 300, y: 0, width: 20, height: 250 },
            { x: 500, y: 350, width: 20, height: 250 },
            { x: 0, y: 300, width: 250, height: 20 },
            { x: 550, y: 100, width: 250, height: 20 }
        ],
        exit: { x: 100, y: 100 },
        npcs: [
            { x: 400, y: 100, dialog: "Olá aventureiro! Pegue este óculos especial. Quando ativado, ele mostrará a rota otimizada entre as chaves desviando das paredes!", item: { id: "glasses1", name: "Óculos TSP", type: "glasses", emoji: "👓", value: 50 } }
        ],
        powerups: [
            { x: 650, y: 250, type: "shield", name: "Escudo Protetor", emoji: "🛡️", value: 30 },
            { x: 50, y: 450, type: "invisibility", name: "Poção de Invisibilidade", emoji: "✨", value: 40 },
            { x: 350, y: 520, type: "stunGun", name: "Arma de Atordoamento", emoji: "🔫", value: 45 }
        ]
    },
    2: {
        playerStart: { x: 50, y: 50 },
        startDoor: { x: 50, y: 50 },
        keys: [
            { x: 680, y: 80, value: 10, name: "Chave Bronze", emoji: "🔑" },
            { x: 600, y: 550, value: 20, name: "Chave Ouro", emoji: "🌟" },
            { x: 100, y: 530, value: 15, name: "Chave Prata", emoji: "🔑" }
        ],
        enemies: [
            { x: 250, y: 250, speed: 2.2, size: 25, patrolRadius: 120 },
            { x: 450, y: 200, speed: 2.2, size: 25, patrolRadius: 120 },
            { x: 600, y: 400, speed: 2.2, size: 25, patrolRadius: 120 },
            { x: 150, y: 450, speed: 2.2, size: 25, patrolRadius: 120 }
        ],
        walls: [
            { x: 200, y: 0, width: 20, height: 300 },
            { x: 400, y: 200, width: 20, height: 200 },
            { x: 600, y: 0, width: 20, height: 350 },
            { x: 0, y: 400, width: 350, height: 20 },
            { x: 450, y: 500, width: 350, height: 20 },
            { x: 300, y: 300, width: 100, height: 20 }
        ],
        exit: { x: 50, y: 50 },
        npcs: [
            { x: 200, y: 100, dialog: "Os inimigos estão cada vez mais fortes! Pegue este escudo para se proteger, mas lembre-se, ele dura apenas 7 segundos!", item: { id: "shield1", name: "Escudo Protetor", type: "shield", emoji: "🛡️", value: 30 } }
        ],
        powerups: [
            { x: 650, y: 300, type: "stunGun", name: "Arma de Atordoamento", emoji: "🔫", value: 45 },
            { x: 50, y: 250, type: "invisibility", name: "Poção de Invisibilidade", emoji: "✨", value: 40 },
            { x: 350, y: 550, type: "shield", name: "Escudo Protetor", emoji: "🛡️", value: 30 }
        ]
    },
    3: {
        playerStart: { x: 50, y: 50 },
        startDoor: { x: 50, y: 50 },
        keys: [
            { x: 650, y: 120, value: 10, name: "Chave Bronze", emoji: "🔑" },
            { x: 700, y: 400, value: 20, name: "Chave Ouro", emoji: "🌟" },
            { x: 150, y: 550, value: 25, name: "Chave Lendária", emoji: "💎" }
        ],
        enemies: [
            { x: 100, y: 200, speed: 2.5, size: 25, patrolRadius: 140 },
            { x: 500, y: 150, speed: 2.5, size: 25, patrolRadius: 140 },
            { x: 200, y: 400, speed: 2.5, size: 25, patrolRadius: 140 },
            { x: 650, y: 450, speed: 2.5, size: 25, patrolRadius: 140 },
            { x: 100, y: 300, speed: 2.5, size: 25, patrolRadius: 140 },
            { x: 450, y: 500, speed: 2.5, size: 25, patrolRadius: 140 }
        ],
        walls: [
            { x: 300, y: 0, width: 20, height: 250 },
            { x: 300, y: 100, width: 20, height: 190 },
            { x: 450, y: 0, width: 20, height: 300 },
            { x: 600, y: 200, width: 20, height: 250 },
            { x: 0, y: 250, width: 250, height: 20 },
            { x: 250, y: 400, width: 200, height: 20 },
            { x: 500, y: 500, width: 300, height: 20 },
            { x: 360, y: 300, width: 20, height: 150 },
            { x: 550, y: 350, width: 20, height: 100 }
        ],
        exit: { x: 50, y: 50 },
        npcs: [
            { x: 400, y: 100, dialog: "A fase final! Pegue esta arma de atordoamento. Ela tem 3 tiros e pode atordoar inimigos por 3 segundos. Use ESPAÇO para atirar!", item: { id: "stun1", name: "Arma de Atordoamento", type: "stunGun", emoji: "🔫", value: 45, ammo: 3 } }
        ],
        powerups: [
            { x: 680, y: 250, type: "shield", name: "Escudo Protetor", emoji: "🛡️", value: 30 },
            { x: 80, y: 150, type: "glasses", name: "Óculos TSP", emoji: "👓", value: 50 },
            { x: 400, y: 550, type: "invisibility", name: "Poção de Invisibilidade", emoji: "✨", value: 40 }
        ]
    }
};

function handleEnterToRestart() {
    const messageBox = document.getElementById('messageBox');
    const gameOverBox = document.getElementById('gameOverBox');
    if (gameOverBox && gameOverBox.style.display === 'block') { restartGame(); return true; }
    if (messageBox && messageBox.style.display === 'block') { nextLevel(); return true; }
    return false;
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'enter' || key === 'return') {
        const messageBox = document.getElementById('messageBox');
        const gameOverBox = document.getElementById('gameOverBox');
        if ((gameOverBox && gameOverBox.style.display === 'block') || (messageBox && messageBox.style.display === 'block')) {
            e.preventDefault();
            handleEnterToRestart();
        }
    }
});

const gameOverButton = document.querySelector('#gameOverBox button');
if (gameOverButton) {
    const newGameOverButton = gameOverButton.cloneNode(true);
    gameOverButton.parentNode.replaceChild(newGameOverButton, gameOverButton);
    newGameOverButton.addEventListener('click', (e) => { e.preventDefault(); restartGame(); });
}

const messageButton = document.querySelector('#messageBox button');
if (messageButton) {
    const newMessageButton = messageButton.cloneNode(true);
    messageButton.parentNode.replaceChild(newMessageButton, messageButton);
    newMessageButton.addEventListener('click', (e) => { e.preventDefault(); nextLevel(); });
}

const keysPressed = {};

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'i' && gameRunning && !gameOver) { toggleInventory(); e.preventDefault(); }
    if (key === 'escape') { document.getElementById('inventoryPanel').style.display = 'none'; e.preventDefault(); }
    if (key === 'f' && gameRunning && !gameOver) { interactWithNPC(); e.preventDefault(); }
    if (key === ' ' && gameRunning && !gameOver) { useStunGun(); e.preventDefault(); }
    if (gameRunning && !gameOver) {
        switch(key) {
            case 'arrowup': case 'w': keysPressed.up = true; break;
            case 'arrowdown': case 's': keysPressed.down = true; break;
            case 'arrowleft': case 'a': keysPressed.left = true; break;
            case 'arrowright': case 'd': keysPressed.right = true; break;
        }
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    switch(key) {
        case 'arrowup': case 'w': keysPressed.up = false; break;
        case 'arrowdown': case 's': keysPressed.down = false; break;
        case 'arrowleft': case 'a': keysPressed.left = false; break;
        case 'arrowright': case 'd': keysPressed.right = false; break;
    }
});

document.getElementById('closeInventory')?.addEventListener('click', () => {
    document.getElementById('inventoryPanel').style.display = 'none';
});

function updateMovement() {
    if (!gameRunning || gameOver) return;
    let dx = 0, dy = 0;
    if (keysPressed.up) dy = -4;
    if (keysPressed.down) dy = 4;
    if (keysPressed.left) dx = -4;
    if (keysPressed.right) dx = 4;
    if (dx !== 0 || dy !== 0) movePlayer(dx, dy);
}

function gameLoop() {
    if (gameRunning && !gameOver) {
        updateMovement();
        updateEnemies();
        checkCollisions();
        if (glassesActive && aStar && Date.now() % 30 < 15) {
            optimalFullPath = calculateOptimalFullPath();
        }
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function init() {
    loadLevel(1);
    gameLoop();
}

init();