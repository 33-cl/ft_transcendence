export declare class PongLoadingIcon {
    private canvas;
    private ctx;
    private animationId;
    private readonly width;
    private readonly height;
    private readonly paddleWidth;
    private readonly paddleHeight;
    private readonly ballSize;
    private ballX;
    private ballDirection;
    private paddleOffset;
    private paddleDirection;
    private rotationAngle;
    private readonly ballSpeed;
    private readonly paddleSpeed;
    private readonly rotationSpeed;
    constructor(container: HTMLElement);
    private drawPaddle;
    private drawBall;
    private updateAnimation;
    private draw;
    private animate;
    private startAnimation;
    destroy(): void;
}
export declare function createPongLoadingIcon(container: HTMLElement): PongLoadingIcon;
export declare const loadingIconHTML = "\n    <span class=\"inline-block align-middle\"></span>\n";
//# sourceMappingURL=loadingIcon.d.ts.map