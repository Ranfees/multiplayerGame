const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.set('view engine', 'ejs')

app.use(express.static("public"));

app.get('/', (req, res) => {
    return res.render('index')
})

const canvasWidth = 1280;
const canvasHeight = 720;

let players = {
    p1: null,
    p2: null
};

let gameState = {
    p1: { y: canvasHeight / 2 - 50, score: 0 },
    p2: { y: canvasHeight / 2 - 50, score: 0 },
    ball: { x: canvasWidth / 2, y: canvasHeight / 2, dx: 5, dy: 5, radius: 15 }
};

const paddleSpeed = 7;
const paddleHeight = 100;

function resetBall() {
    gameState.ball.x = canvasWidth / 2;
    gameState.ball.y = canvasHeight / 2;
    gameState.ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5;
    gameState.ball.dy = (Math.random() - 0.5) * 8;
}

resetBall();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let playerRole = null;

    if (!players.p1) {
        players.p1 = socket.id;
        playerRole = 'p1';
        socket.emit('role', 'p1');
    } else if (!players.p2) {
        players.p2 = socket.id;
        playerRole = 'p2';
        socket.emit('role', 'p2');
    } else {
        socket.emit('role', 'spectator');
    }

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (players.p1 === socket.id) {
            players.p1 = null;
            gameState.p1.score = 0;
            gameState.p2.score = 0;
            resetBall();
        } else if (players.p2 === socket.id) {
            players.p2 = null;
            gameState.p1.score = 0;
            gameState.p2.score = 0;
            resetBall();
        }
    });

    socket.on('move', (direction) => {
        if (playerRole === 'p1') {
            if (direction === 'up' && gameState.p1.y > 40) gameState.p1.y -= paddleSpeed;
            if (direction === 'down' && gameState.p1.y < canvasHeight - 40 - paddleHeight) gameState.p1.y += paddleSpeed;
        } else if (playerRole === 'p2') {
            if (direction === 'up' && gameState.p2.y > 40) gameState.p2.y -= paddleSpeed;
            if (direction === 'down' && gameState.p2.y < canvasHeight - 40 - paddleHeight) gameState.p2.y += paddleSpeed;
        }
    });
});

setInterval(() => {
    if (players.p1 && players.p2) {
        let ball = gameState.ball;
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

        if (checkCollision(120, gameState.p1.y) || checkCollision(canvasWidth - 140, gameState.p2.y)) {
            ball.dx *= -1.1;
        }

        if (ball.x < 100) {
            gameState.p2.score++;
            resetBall();
        } else if (ball.x > canvasWidth - 100) {
            gameState.p1.score++;
            resetBall();
        }
    }

    io.emit('gameState', gameState);
}, 1000 / 60);

server.listen(3000, () => {
    console.log('app is running on port 3000')
})