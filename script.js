// ==================== CONFIGURAÇÕES DO JOGO ====================
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        let currentLevel = 1;
        let gameRunning = true;
        
        let player = { x: 0, y: 0, size: 30 };
        let keys = [];
        let enemies = [];
        let walls = [];
        let exitPoint = null;
        
        class Inventory {
            constructor() {
                this.items = [];
            }
            
            addItem(item) {
                this.items.push(item);
                this.sortByValue();
                this.updateUI();
            }
            
            removeItem(index) {
                if (index >= 0 && index < this.items.length) {
                    this.items.splice(index, 1);
                    this.updateUI();
                    return true;
                }
                return false;
            }
            
            getItems() {
                return [...this.items];
            }
            
            getItemCount() {
                return this.items.length;
            }
            
            sortByValue() {
                this.items = this.mergeSort(this.items);
            }
            
            mergeSort(arr) {
                if (arr.length <= 1) return arr;
                
                const mid = Math.floor(arr.length / 2);
                const left = this.mergeSort(arr.slice(0, mid));
                const right = this.mergeSort(arr.slice(mid));
                
                return this.merge(left, right);
            }
            
            merge(left, right) {
                let result = [];
                let i = 0, j = 0;
                
                while (i < left.length && j < right.length) {
                    if (left[i].value >= right[j].value) {
                        result.push(left[i++]);
                    } else {
                        result.push(right[j++]);
                    }
                }
                
                return result.concat(left.slice(i)).concat(right.slice(j));
            }
            
            updateUI() {
                const container = document.getElementById('inventory');
                container.innerHTML = '';
                
                if (this.items.length === 0) {
                    const emptySlot = document.createElement('div');
                    emptySlot.className = 'inventory-slot empty';
                    emptySlot.textContent = '🔓 Vazio';
                    container.appendChild(emptySlot);
                } else {
                    this.items.forEach((item, idx) => {
                        const slot = document.createElement('div');
                        slot.className = 'inventory-slot';
                        slot.textContent = `${item.emoji} ${item.name} (Valor: ${item.value})`;
                        container.appendChild(slot);
                    });
                }
            }
        }
        
        let inventory = new Inventory();
        
        class TSP {
            constructor() {
                this.cache = new Map();
            }
            
            nearestNeighbor(points) {
                if (points.length <= 1) return { route: points, distance: 0 };
                
                const unvisited = [...points];
                const route = [unvisited.shift()];
                let totalDistance = 0;
                
                while (unvisited.length > 0) {
                    let lastPoint = route[route.length - 1];
                    let nearestIdx = 0;
                    let minDist = Infinity;
                    
                    for (let i = 0; i < unvisited.length; i++) {
                        const dist = this.distance(lastPoint, unvisited[i]);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestIdx = i;
                        }
                    }
                    
                    totalDistance += minDist;
                    route.push(unvisited[nearestIdx]);
                    unvisited.splice(nearestIdx, 1);
                }
                
                totalDistance += this.distance(route[route.length - 1], route[0]);
                
                return { route, distance: totalDistance };
            }
            
            twoOpt(route, distance) {
                let improved = true;
                let bestRoute = [...route];
                let bestDistance = distance;
                
                while (improved) {
                    improved = false;
                    
                    for (let i = 0; i < bestRoute.length - 1; i++) {
                        for (let j = i + 1; j < bestRoute.length; j++) {
                            const newRoute = this.twoOptSwap(bestRoute, i, j);
                            const newDistance = this.calculateTotalDistance(newRoute);
                            
                            if (newDistance < bestDistance) {
                                bestRoute = newRoute;
                                bestDistance = newDistance;
                                improved = true;
                            }
                        }
                    }
                }
                
                bestDistance += this.distance(bestRoute[bestRoute.length - 1], bestRoute[0]);
                
                return { route: bestRoute, distance: bestDistance };
            }
            
            twoOptSwap(route, i, j) {
                const newRoute = [...route];
                let left = i + 1;
                let right = j;
                
                while (left < right) {
                    [newRoute[left], newRoute[right]] = [newRoute[right], newRoute[left]];
                    left++;
                    right--;
                }
                
                return newRoute;
            }
            
            calculateTotalDistance(route) {
                let total = 0;
                for (let i = 0; i < route.length - 1; i++) {
                    total += this.distance(route[i], route[i + 1]);
                }
                return total;
            }
            
            distance(p1, p2) {
                return Math.hypot(p1.x - p2.x, p1.y - p2.y);
            }
            
            calculateOptimalRoute(points) {
                if (points.length === 0) return { route: [], distance: 0 };
                if (points.length === 1) return { route: points, distance: 0 };
                let result = this.nearestNeighbor(points);
                
                if (points.length <= 15) {
                    result = this.twoOpt(result.route, result.distance);
                }
                
                return result;
            }
        }
        
        let tsp = new TSP();
        let optimalRoute = [];
        
        // ==================== A* PATHFINDING ====================
        const GRID_SIZE = 40; // 40x40 pixel cells
        
        class Node {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.g = 0; // cost from start
                this.h = 0; // heuristic to goal
                this.f = 0; // g + h
                this.parent = null;
            }
        }
        
        class AStar {
            constructor(gridWidth, gridHeight, gridSize) {
                this.gridWidth = gridWidth;
                this.gridHeight = gridHeight;
                this.gridSize = gridSize;
            }
            
            heuristic(a, b) {
                // Manhattan distance
                return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            }
            
            getNeighbors(node) {
                const neighbors = [];
                const directions = [
                    { dx: 0, dy: -1 }, // up
                    { dx: 1, dy: 0 },  // right
                    { dx: 0, dy: 1 },  // down
                    { dx: -1, dy: 0 }  // left
                ];
                
                for (let dir of directions) {
                    const newX = node.x + dir.dx;
                    const newY = node.y + dir.dy;
                    
                    if (newX >= 0 && newX < this.gridWidth && newY >= 0 && newY < this.gridHeight) {
                        neighbors.push(new Node(newX, newY));
                    }
                }
                
                return neighbors;
            }
            
            isWalkable(gridX, gridY) {
                const pixelX = gridX * this.gridSize;
                const pixelY = gridY * this.gridSize;
                
                // Check if this grid cell collides with any wall
                for (let wall of walls) {
                    if (pixelX < wall.x + wall.width &&
                        pixelX + this.gridSize > wall.x &&
                        pixelY < wall.y + wall.height &&
                        pixelY + this.gridSize > wall.y) {
                        return false;
                    }
                }
                return true;
            }
            
            findPath(startX, startY, endX, endY) {
                const startGridX = Math.floor(startX / this.gridSize);
                const startGridY = Math.floor(startY / this.gridSize);
                const endGridX = Math.floor(endX / this.gridSize);
                const endGridY = Math.floor(endY / this.gridSize);
                
                const startNode = new Node(startGridX, startGridY);
                const endNode = new Node(endGridX, endGridY);
                
                const openSet = [startNode];
                const closedSet = [];
                
                while (openSet.length > 0) {
                    // Find node with lowest f score
                    let current = openSet[0];
                    let currentIndex = 0;
                    
                    for (let i = 1; i < openSet.length; i++) {
                        if (openSet[i].f < current.f) {
                            current = openSet[i];
                            currentIndex = i;
                        }
                    }
                    
                    if (current.x === endNode.x && current.y === endNode.y) {
                        // Path found, reconstruct it
                        const path = [];
                        let temp = current;
                        while (temp) {
                            path.unshift({
                                x: temp.x * this.gridSize + this.gridSize / 2,
                                y: temp.y * this.gridSize + this.gridSize / 2
                            });
                            temp = temp.parent;
                        }
                        return path.length > 1 ? path : [];
                    }
                    
                    openSet.splice(currentIndex, 1);
                    closedSet.push(current);
                    
                    const neighbors = this.getNeighbors(current);
                    
                    for (let neighbor of neighbors) {
                        if (!this.isWalkable(neighbor.x, neighbor.y)) {
                            continue;
                        }
                        
                        if (closedSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                            continue;
                        }
                        
                        const tempG = current.g + 1;
                        let newPath = false;
                        
                        const inOpen = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
                        
                        if (inOpen) {
                            if (tempG < inOpen.g) {
                                inOpen.g = tempG;
                                inOpen.parent = current;
                                inOpen.f = inOpen.g + inOpen.h;
                            }
                        } else {
                            neighbor.g = tempG;
                            neighbor.h = this.heuristic(neighbor, endNode);
                            neighbor.f = neighbor.g + neighbor.h;
                            neighbor.parent = current;
                            openSet.push(neighbor);
                            newPath = true;
                        }
                    }
                    
                    if (openSet.length === 0) {
                        // No path found
                        return [];
                    }
                }
                
                return [];
            }
        }
        
        let aStar = new AStar(Math.ceil(canvas.width / GRID_SIZE), Math.ceil(canvas.height / GRID_SIZE), GRID_SIZE);
        
        // ==================== CONFIGURAÇÃO DAS FASES ====================
        const levels = {
            1: { // Fácil
                playerStart: { x: 100, y: 100 },
                keys: [
                    { x: 400, y: 200, value: 10, name: "Chave Bronze", emoji: "🔑" },
                    { x: 600, y: 400, value: 15, name: "Chave Prata", emoji: "🔑" },
                    { x: 200, y: 500, value: 10, name: "Chave Bronze", emoji: "🔑" }
                ],
                enemies: [
                    { x: 350, y: 350, movePattern: "horizontal", range: 150 },
                    { x: 500, y: 150, movePattern: "vertical", range: 100 }
                ],
                walls: [
                    { x: 300, y: 0, width: 20, height: 250 },
                    { x: 500, y: 350, width: 20, height: 250 },
                    { x: 0, y: 300, width: 250, height: 20 },
                    { x: 550, y: 100, width: 250, height: 20 }
                ],
                exit: { x: 700, y: 550 }
            },
            2: { // Médio
                playerStart: { x: 50, y: 50 },
                keys: [
                    { x: 300, y: 150, value: 10, name: "Chave Bronze", emoji: "🔑" },
                    { x: 500, y: 300, value: 20, name: "Chave Ouro", emoji: "🌟" },
                    { x: 400, y: 500, value: 15, name: "Chave Prata", emoji: "🔑" }
                ],
                enemies: [
                    { x: 250, y: 250, movePattern: "circular", radius: 80 },
                    { x: 450, y: 200, movePattern: "horizontal", range: 200 },
                    { x: 600, y: 400, movePattern: "vertical", range: 150 },
                    { x: 150, y: 450, movePattern: "circular", radius: 60 }
                ],
                walls: [
                    { x: 200, y: 0, width: 20, height: 300 },
                    { x: 400, y: 200, width: 20, height: 200 },
                    { x: 600, y: 0, width: 20, height: 350 },
                    { x: 0, y: 400, width: 350, height: 20 },
                    { x: 450, y: 500, width: 350, height: 20 },
                    { x: 300, y: 300, width: 100, height: 20 }
                ],
                exit: { x: 750, y: 50 }
            },
            3: { // Difícil
                playerStart: { x: 50, y: 50 },
                keys: [
                    { x: 200, y: 200, value: 10, name: "Chave Bronze", emoji: "🔑" },
                    { x: 400, y: 100, value: 20, name: "Chave Ouro", emoji: "🌟" },
                    { x: 500, y: 300, value: 25, name: "Chave Lendária", emoji: "💎" }
                ],
                enemies: [
                    { x: 300, y: 200, movePattern: "circular", radius: 100 },
                    { x: 500, y: 150, movePattern: "horizontal", range: 250 },
                    { x: 200, y: 400, movePattern: "vertical", range: 200 },
                    { x: 650, y: 450, movePattern: "circular", radius: 90 },
                    { x: 100, y: 300, movePattern: "horizontal", range: 180 },
                    { x: 450, y: 500, movePattern: "vertical", range: 150 }
                ],
                walls: [
                    { x: 300, y: 0, width: 20, height: 250 },
                    { x: 300, y: 100, width: 20, height: 200 },
                    { x: 450, y: 0, width: 20, height: 300 },
                    { x: 600, y: 200, width: 20, height: 250 },
                    { x: 0, y: 250, width: 250, height: 20 },
                    { x: 250, y: 400, width: 200, height: 20 },
                    { x: 500, y: 500, width: 300, height: 20 },
                    { x: 350, y: 300, width: 20, height: 150 },
                    { x: 550, y: 350, width: 20, height: 100 }
                ],
                exit: { x: 700, y: 550 }
            }
        };
        
        let enemyAngles = [];
        function loadLevel(level) {
            const levelData = levels[level];
            if (!levelData) return false;
            
            player = { ...levelData.playerStart, size: 30 };
            keys = levelData.keys.map(k => ({ ...k, collected: false }));
            enemies = levelData.enemies.map((e, idx) => ({
                ...e,
                x: e.x,
                y: e.y,
                startX: e.x,
                startY: e.y,
                angle: enemyAngles[idx] || 0,
                path: [],
                pathIndex: 0,
                lastPathUpdate: 0
            }));
            walls = levelData.walls;
            exitPoint = levelData.exit;
            inventory = new Inventory();
            updateTSPRoute();
            
            document.getElementById('level').textContent = level;
            document.getElementById('keys-collected').textContent = '0';
            document.getElementById('enemies-left').textContent = enemies.length;
            
            gameRunning = true;
            
            return true;
        }
        
        function updateTSPRoute() {
            const activeKeys = keys.filter(k => !k.collected);
            if (activeKeys.length > 0) {
                const points = activeKeys.map(k => ({ x: k.x, y: k.y }));
                const result = tsp.calculateOptimalRoute(points);
                optimalRoute = result.route;
                document.getElementById('route-length').textContent = Math.round(result.distance);
            } else {
                optimalRoute = [];
                document.getElementById('route-length').textContent = '0';
            }
        }
        
        function checkCollisionWithWalls(x, y, size) {
            for (let wall of walls) {
                if (x < wall.x + wall.width &&
                    x + size > wall.x &&
                    y < wall.y + wall.height &&
                    y + size > wall.y) {
                    return true;
                }
            }
            return false;
        }
        
        function movePlayer(dx, dy) {
            const newX = player.x + dx;
            const newY = player.y + dy;
            
            if (!checkCollisionWithWalls(newX, player.y, player.size)) {
                player.x = newX;
            }
            if (!checkCollisionWithWalls(player.x, newY, player.size)) {
                player.y = newY;
            }

            player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
            player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
        }
        
        function updateEnemies() {
            const now = Date.now();
            const PATHFINDING_UPDATE_INTERVAL = 500; // Update path every 500ms
            const ENEMY_SPEED = 2;
            
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                
                // Update pathfinding at intervals to improve performance
                if (now - enemy.lastPathUpdate > PATHFINDING_UPDATE_INTERVAL) {
                    enemy.path = aStar.findPath(enemy.x, enemy.y, player.x, player.y);
                    enemy.pathIndex = 0;
                    enemy.lastPathUpdate = now;
                }
                
                // Follow the path
                if (enemy.path && enemy.path.length > 0 && enemy.pathIndex < enemy.path.length) {
                    const targetPoint = enemy.path[enemy.pathIndex];
                    const dx = targetPoint.x - enemy.x;
                    const dy = targetPoint.y - enemy.y;
                    const distance = Math.hypot(dx, dy);
                    
                    if (distance < ENEMY_SPEED) {
                        // Move to next waypoint
                        enemy.pathIndex++;
                    } else {
                        // Move towards target
                        const moveX = (dx / distance) * ENEMY_SPEED;
                        const moveY = (dy / distance) * ENEMY_SPEED;
                        
                        const newX = enemy.x + moveX;
                        const newY = enemy.y + moveY;
                        
                        // Check wall collision
                        if (!checkCollisionWithWalls(newX, enemy.y, 25)) {
                            enemy.x = newX;
                        }
                        if (!checkCollisionWithWalls(enemy.x, newY, 25)) {
                            enemy.y = newY;
                        }
                    }
                }
                
                // Keep enemies in bounds
                enemy.x = Math.max(0, Math.min(canvas.width - 25, enemy.x));
                enemy.y = Math.max(0, Math.min(canvas.height - 25, enemy.y));
            }
        }
        
        function checkCollisions() {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (!key.collected) {
                    if (player.x < key.x + 20 &&
                        player.x + player.size > key.x &&
                        player.y < key.y + 20 &&
                        player.y + player.size > key.y) {
                        key.collected = true;
                        inventory.addItem({
                            name: key.name,
                            value: key.value,
                            emoji: key.emoji
                        });
                        updateTSPRoute();
                        document.getElementById('keys-collected').textContent = keys.filter(k => k.collected).length;
                    }
                }
            }
            
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (player.x < enemy.x + 25 &&
                    player.x + player.size > enemy.x &&
                    player.y < enemy.y + 25 &&
                    player.y + player.size > enemy.y) {
                    loseGame();
                    return;
                }
            }
            
            const allKeysCollected = keys.every(k => k.collected);
            if (allKeysCollected && exitPoint) {
                if (player.x < exitPoint.x + 30 &&
                    player.x + player.size > exitPoint.x &&
                    player.y < exitPoint.y + 30 &&
                    player.y + player.size > exitPoint.y) {
                    completeLevel();
                }
            }
        }
        
        function loseGame() {
            gameRunning = false;
            const messageBox = document.getElementById('messageBox');
            
            document.getElementById('messageTitle').textContent = '💀 DERROTA! 💀';
            document.getElementById('messageText').innerHTML = `
                Você foi capturado por um inimigo!<br><br>
                Chaves coletadas: ${inventory.getItemCount()}<br>
                Tente novamente!
            `;
            document.querySelector('.message button').textContent = 'Tentar Novamente';
            
            messageBox.style.display = 'block';
        }
        
        function completeLevel() {
            gameRunning = false;
            const messageBox = document.getElementById('messageBox');
            
            if (currentLevel === 3) {
                document.getElementById('messageTitle').textContent = '🏆 VITÓRIA! 🏆';
                document.getElementById('messageText').innerHTML = `
                    Parabéns! Você completou o jogo!<br><br>
                    Inventário final:<br>
                    ${inventory.getItems().map(i => `${i.emoji} ${i.name} (Valor: ${i.value})`).join('<br>')}
                `;
            } else {
                document.getElementById('messageTitle').textContent = 'Fase Concluída!';
                document.getElementById('messageText').innerHTML = `Você coletou ${inventory.getItemCount()} itens! Prepare-se para a próxima fase!`;
            }
            document.querySelector('.message button').textContent = 'Próxima Fase';
            
            messageBox.style.display = 'block';
        }
        
        function nextLevel() {
            document.getElementById('messageBox').style.display = 'none';
            if (currentLevel < 3) {
                currentLevel++;
                loadLevel(currentLevel);
            } else {
                currentLevel = 1;
                loadLevel(1);
            }
        }
        
        function draw() {
            ctx.fillStyle = '#0a0a15';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }

            if (optimalRoute.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                
                const firstPoint = optimalRoute[0];
                ctx.moveTo(firstPoint.x + 10, firstPoint.y + 10);
                
                for (let i = 1; i < optimalRoute.length; i++) {
                    ctx.lineTo(optimalRoute[i].x + 10, optimalRoute[i].y + 10);
                }
                
                if (optimalRoute.length > 1) {
                    ctx.lineTo(optimalRoute[0].x + 10, optimalRoute[0].y + 10);
                }
                
                ctx.stroke();
                ctx.setLineDash([]);
            }
        
            ctx.fillStyle = '#2a2a3e';
            for (let wall of walls) {
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
                ctx.strokeStyle = '#3a3a4e';
                ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
            }
            
            for (let key of keys) {
                if (!key.collected) {
                    ctx.font = '30px Arial';
                    ctx.fillStyle = '#ffd700';
                    ctx.fillText('🔑', key.x, key.y + 25);
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#ffd700';
                    ctx.fillText('🔑', key.x, key.y + 25);
                    ctx.shadowBlur = 0;
                }
            }
            
            for (let enemy of enemies) {
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(enemy.x + 12, enemy.y + 12, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '20px Arial';
                ctx.fillText('👹', enemy.x + 2, enemy.y + 22);
            }
            
            if (exitPoint && keys.every(k => k.collected)) {
                ctx.fillStyle = '#00ff88';
                ctx.globalAlpha = 0.5;
                ctx.fillRect(exitPoint.x, exitPoint.y, 30, 30);
                ctx.globalAlpha = 1;
                ctx.font = '30px Arial';
                ctx.fillStyle = '#00ff88';
                ctx.fillText('🚪', exitPoint.x + 2, exitPoint.y + 28);
            } else if (exitPoint) {
                ctx.fillStyle = '#444';
                ctx.fillRect(exitPoint.x, exitPoint.y, 30, 30);
                ctx.font = '30px Arial';
                ctx.fillStyle = '#888';
                ctx.fillText('🚪', exitPoint.x + 2, exitPoint.y + 28);
            }
            
            ctx.fillStyle = '#00aaff';
            ctx.beginPath();
            ctx.arc(player.x + player.size/2, player.y + player.size/2, player.size/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '25px Arial';
            ctx.fillText('😀', player.x + 5, player.y + 25);
        }
        
        const keysPressed = {};
        
        document.addEventListener('keydown', (e) => {
            const key = e.key;
            if (gameRunning) {
                switch(key) {
                    case 'ArrowUp': case 'w': keysPressed.up = true; break;
                    case 'ArrowDown': case 's': keysPressed.down = true; break;
                    case 'ArrowLeft': case 'a': keysPressed.left = true; break;
                    case 'ArrowRight': case 'd': keysPressed.right = true; break;
                }
            }
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            const key = e.key;
            switch(key) {
                case 'ArrowUp': case 'w': keysPressed.up = false; break;
                case 'ArrowDown': case 's': keysPressed.down = false; break;
                case 'ArrowLeft': case 'a': keysPressed.left = false; break;
                case 'ArrowRight': case 'd': keysPressed.right = false; break;
            }
        });
        
        function updateMovement() {
            if (!gameRunning) return;
            
            let dx = 0, dy = 0;
            if (keysPressed.up) dy = -5;
            if (keysPressed.down) dy = 5;
            if (keysPressed.left) dx = -5;
            if (keysPressed.right) dx = 5;
            
            if (dx !== 0 || dy !== 0) {
                movePlayer(dx, dy);
            }
        }
        
        function gameLoop() {
            if (gameRunning) {
                updateMovement();
                updateEnemies();
                checkCollisions();
            }
            draw();
            requestAnimationFrame(gameLoop);
        }
        
        function init() {
            loadLevel(1);
            gameLoop();
        }
        
        init();