export class PongLoadingIcon {
    constructor(container) {
        this.animationId = null;
        // Configuration
        this.width = 48;
        this.height = 32;
        this.paddleWidth = 5;
        this.paddleHeight = 16;
        this.ballSize = 4;
        // Animation state
        this.ballX = 10;
        this.ballDirection = 1;
        this.paddleOffset = 0;
        this.paddleDirection = 1;
        this.rotationAngle = 0;
        // Animation parameters
        this.ballSpeed = 0.6;
        this.paddleSpeed = 0.1;
        this.rotationSpeed = 0.03;
        this.animate = () => {
            this.updateAnimation();
            this.draw();
            this.animationId = requestAnimationFrame(this.animate);
        };
        console.log('Creating PongLoadingIcon');
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        // Utiliser les classes Tailwind et forcer la visibilité
        this.canvas.className = 'inline-block ml-2';
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.canvas.style.border = '1px solid rgba(255,255,255,0.3)'; // Debug border
        this.canvas.style.backgroundColor = 'rgba(0,0,0,0.2)'; // Debug background
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = context;
        container.appendChild(this.canvas);
        console.log('Canvas added to container, starting animation');
        this.startAnimation();
    }
    drawPaddle(x, y) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x - this.paddleWidth / 2, y - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
    }
    drawBall(x, y) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.ballSize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    updateAnimation() {
        // Update ball position
        this.ballX += this.ballSpeed * this.ballDirection;
        // Bounce ball at edges
        if (this.ballX <= 10 || this.ballX >= this.width - 10) {
            this.ballDirection *= -1;
        }
        // Keep ball in bounds
        this.ballX = Math.max(10, Math.min(this.width - 10, this.ballX));
        // Update paddle offset
        this.paddleOffset += this.paddleSpeed * this.paddleDirection;
        if (this.paddleOffset >= 2 || this.paddleOffset <= -2) {
            this.paddleDirection *= -1;
        }
        // Update rotation
        this.rotationAngle += this.rotationSpeed;
        if (this.rotationAngle >= Math.PI * 2) {
            this.rotationAngle = 0;
        }
    }
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        // Save context for rotation
        this.ctx.save();
        // Apply rotation around center
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.rotate(this.rotationAngle);
        this.ctx.translate(-this.width / 2, -this.height / 2);
        // Draw subtle background for visibility
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.fillRect(2, 2, this.width - 4, this.height - 4);
        // Draw paddles with animation
        const centerY = this.height / 2;
        this.drawPaddle(6, centerY + this.paddleOffset);
        this.drawPaddle(this.width - 6, centerY - this.paddleOffset);
        // Draw ball
        this.drawBall(this.ballX, centerY);
        // Restore context
        this.ctx.restore();
    }
    startAnimation() {
        if (!this.animationId) {
            this.animate();
        }
    }
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
export function createPongLoadingIcon(container) {
    return new PongLoadingIcon(container);
}
export const loadingIconHTML = /*html*/ `
    <span class="inline-block align-middle"></span>
`;
//# sourceMappingURL=loadingIcon.js.map