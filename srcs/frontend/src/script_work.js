/********************VARIABLE******************************************************* */
const canvas = document.getElementById("map");
const button = document.getElementById("startBtn");
const ctx = canvas.getContext("2d");

//Raquette
const paddleMargin = 10;
const paddleWidth = 10;
const paddleCollisionSurface = paddleMargin + paddleWidth;
const paddleHeight = 110;
let leftPaddleY = rightPaddleY = canvas.height / 2 - paddleHeight / 2; //position du padd
let paddleSpeed = 10

//Balle
let ballPaused = false; // Indique si la balle est en pause
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballRadius = 20;
let ballSpeedX = 2;
let ballSpeedY = 2;

//Score
let leftScore;
let rightScore;
let win = 3;
let gameRunning;
const winnerDisplay = document.getElementById("winnerDisplay");

// Touches pressées
let keysPressed = {};

/*********************************************************************************** */
button.addEventListener("click", function(){
    gameRunning = true;
    leftScore = 0;
    rightScore =  0;
    updateScore();
    canvas.style.display = "block";
    button.style.display = "none";
    winnerDisplay.textContent = ""; // Efface le message de victoire
    document.body.style.backgroundColor = "black";
    requestAnimationFrame(gameLoop);
});

function updateScore(){
    document.getElementById("leftScore").textContent = leftScore;
    document.getElementById("rightScore").textContent = rightScore;
}

function gameLoop() {
    if (!gameRunning) return;
    updatePaddle();
    updateBall();
    draw();
    requestAnimationFrame(gameLoop);
}

//Dessine les elements
function draw() {
    ctx.fillStyle = "white";

    ctx.fillRect(paddleMargin, leftPaddleY, paddleWidth, paddleHeight);
    ctx.fillRect(canvas.width - paddleCollisionSurface, rightPaddleY, paddleWidth, paddleHeight);

    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
}

function resetBall(){

    ballX = canvas.width / 2;
    ballY = canvas.height / 2;

    //Attente 1 seconde de relance
    let previousSpeedX = ballSpeedX; ballSpeedX = 0;
    let previousSpeedY = ballSpeedY; ballSpeedY = 0;
    setTimeout(() => {
        ballSpeedX = previousSpeedX * (Math.random() > 0.5 ? 1 : -1); // Direction aléatoire
        ballSpeedY = previousSpeedY * (Math.random() > 0.5 ? 1 : -1); // Direction aléatoire
    }, 1000); 

    updateScore();
}


function endGame() {
    gameRunning = false;
    winnerDisplay.textContent = leftScore === win ? `Joueur gauche a gagné !` : `Joueur droit a gagné !`;
    
    button.style.position = "absolute"; // Position absolue pour pouvoir le déplacer
    button.style.left = "47%"; // Exemple : centré horizontalement
    button.style.display = "block";
}

function updateBall() 
{
    ballX += ballSpeedX;
    ballY += ballSpeedY;

// Rebond sur les raquettes
    // Raquette gauche
    if (ballX - ballRadius <= paddleCollisionSurface &&
        ballY >= leftPaddleY && //coin superieur de la raquette de droite
        ballY <= leftPaddleY + paddleHeight) {
            ballX = paddleCollisionSurface + ballRadius; // Ajuste la position pour éviter le rebond immédiat
            ballSpeedX = -ballSpeedX;
        }

    //Raquette droite
    if (ballX + ballRadius >= canvas.width - paddleCollisionSurface &&
        ballY >= rightPaddleY &&
        ballY <= rightPaddleY + paddleHeight){
            ballX = canvas.width - paddleCollisionSurface - ballRadius;
            ballSpeedX = -ballSpeedX;
        }

    //Bord haut et bas
    if (ballY - ballRadius <= 0 || ballY + ballRadius >= canvas.height ){ballSpeedY = -ballSpeedY}

    //Sortie
    if (ballX <= 0){
        rightScore++;
        resetBall();
    }
    if (ballX >= canvas.width){
        leftScore++;
        resetBall();
    }
    if (leftScore == win || rightScore == win)
        endGame();
}

// Écoute clavier
document.addEventListener("keydown", (e) => {keysPressed[e.key] = true;});
document.addEventListener("keyup", (e) => {keysPressed[e.key] = false;});

function updatePaddle() {
    // Joueur gauche : w (haut), s (bas)
    if (keysPressed["w"] && leftPaddleY > 0) {leftPaddleY -= paddleSpeed;}
    if (keysPressed["s"] && leftPaddleY < canvas.height - paddleHeight) {leftPaddleY += paddleSpeed;}

    // Joueur droit : flèche haut / bas
    if (keysPressed["ArrowUp"] && rightPaddleY > 0) {rightPaddleY -= paddleSpeed;}
    if (keysPressed["ArrowDown"] && rightPaddleY < canvas.height - paddleHeight) {rightPaddleY += paddleSpeed;}

    //Efface l'ancienne position et dessine la nouvelle dans gameLoop
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}