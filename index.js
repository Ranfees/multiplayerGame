const express = require('express')
const http = require('http')
const {Server}=require('socket.io')

const app = express()
const server=http.createServer(app)
const io = new Server(server)

app.set('view engine','ejs')

app.use(express.static("public"));

app.get('/',(req,res)=>{
    return res.render('index')
})

const canvasWidth = 1280;
const canvasHeight = 720;
const paddleSpeed = 7;
const paddleHeight = 100;

const rooms = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createInitialGameState() {
    return {
        p1: { y: canvasHeight / 2 - 50, score: 0 },
        p2: { y: canvasHeight / 2 - 50, score: 0 },
        ball: {
            x: canvasWidth / 2,
            y: canvasHeight / 2,
            dx: (Math.random() > 0.5 ? 1 : -1) * 5,
            dy: (Math.random() - 0.5) * 8,
            radius: 15
        }
    };
}

function resetBall(gameState) {
    gameState.ball.x = canvasWidth / 2;
    gameState.ball.y = canvasHeight / 2;
    gameState.ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5;
    gameState.ball.dy = (Math.random() - 0.5) * 8;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let currentRoom = null;
    let playerRole = null;

    socket.on('createRoom', () => {
        if (currentRoom) return; // Prevent creating if already in one

        const roomId = generateRoomId();
        rooms.set(roomId, {
            players: { p1: socket.id, p2: null },
            gameState: createInitialGameState()
        });

        currentRoom = roomId;
        playerRole = 'p1';
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        socket.emit('role', 'p1');
    });

    socket.on('joinRoom', (roomId) => {
        if (currentRoom) return;

        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('roomError', 'Room does not exist');
            return;
        }

        if (room.players.p2) {
            socket.emit('roomError', 'Room is full');
            return;
        }

        room.players.p2 = socket.id;
        currentRoom = roomId;
        playerRole = 'p2';
        
        socket.join(roomId);
        socket.emit('role', 'p2');
        io.to(roomId).emit('gameStart');
    });

    socket.on('move', (direction) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const gameState = room.gameState;

        if (playerRole === 'p1') {
            if (direction === 'up' && gameState.p1.y > 40) gameState.p1.y -= paddleSpeed;
            if (direction === 'down' && gameState.p1.y < canvasHeight - 40 - paddleHeight) gameState.p1.y += paddleSpeed;
        } else if (playerRole === 'p2') {
            if (direction === 'up' && gameState.p2.y > 40) gameState.p2.y -= paddleSpeed;
            if (direction === 'down' && gameState.p2.y < canvasHeight - 40 - paddleHeight) gameState.p2.y += paddleSpeed;
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                if (room.players.p1 === socket.id) {
                    room.players.p1 = null;
                } else if (room.players.p2 === socket.id) {
                    room.players.p2 = null;
                }

                // If both players leave, delete the room
                if (!room.players.p1 && !room.players.p2) {
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} deleted empty`);
                } else {
                    // One player remains, tell them opponent left
                    io.to(currentRoom).emit('opponentLeft');
                    // Reset scores and ball wait for someone else
                    room.gameState.p1.score = 0;
                    room.gameState.p2.score = 0;
                    resetBall(room.gameState);
                }
            }
        }
    });
});

setInterval(() => {
    // Only process physics and emit for rooms that have both players
    rooms.forEach((room, roomId) => {
        if (room.players.p1 && room.players.p2) {
            let ball = room.gameState.ball;
            ball.x += ball.dx;
            ball.y += ball.dy;

            if (ball.y - ball.radius < 40 || ball.y + ball.radius > canvasHeight - 40) {
                ball.dy *= -1;
            }

            const checkCollision = (paddleX, paddleY) => {
                return ball.x + ball.radius > paddleX &&
                       ball.x - ball.radius < paddleX + 20 &&
                       ball.y > paddleY &&
                       ball.y < paddleY + paddleHeight;
            };

            if (checkCollision(120, room.gameState.p1.y) || checkCollision(canvasWidth - 140, room.gameState.p2.y)) {
                ball.dx *= -1.1;
            }

            if (ball.x < 100) {
                room.gameState.p2.score++;
                resetBall(room.gameState);
            } else if (ball.x > canvasWidth - 100) {
                room.gameState.p1.score++;
                resetBall(room.gameState);
            }

            io.to(roomId).emit('gameState', room.gameState);
        }
    });
}, 1000 / 60);

server.listen(3005,"192.168.29.178",()=>{
    console.log('app is running on port 3000')
})