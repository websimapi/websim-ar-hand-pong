class PongGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.videoElement = document.getElementById('camera-feed');
    this.statusElement = document.getElementById('status');
    
    this.player1Score = 0;
    this.player2Score = 0;
    
    this.paddleWidth = 100;
    this.paddleHeight = 20;
    this.ballSize = 15;
    this.ballSpeedX = 5;
    this.ballSpeedY = 5;
    
    this.setupCanvas();
    this.init();
  }

  async init() {
    try {
      await this.setupCamera();
      await this.setupHandTracking();
      this.resetBall();
      this.statusElement.textContent = "Waiting for hands...";
    } catch (error) {
      console.error('Initialization error:', error);
      this.statusElement.textContent = "Error: Could not access camera. Please ensure camera permissions are granted and reload the page.";
    }
  }
  
  setupCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  }
  
  setupHandTracking() {
    return new Promise((resolve, reject) => {
      try {
        this.hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });
        
        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        this.hands.onResults(results => this.onHandsResults(results));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async setupCamera() {
    try {
      // First check if we have camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      this.videoElement.srcObject = stream;
      
      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          const camera = new Camera(this.videoElement, {
            onFrame: async () => {
              await this.hands.send({image: this.videoElement});
            },
            width: 1280,
            height: 720
          });
          camera.start();
          resolve();
        };
      });
    } catch (error) {
      this.statusElement.textContent = "Error: Camera access denied. Please grant camera permissions and reload.";
      throw error;
    }
  }
  
  resetBall() {
    this.ballX = this.canvas.width / 2;
    this.ballY = this.canvas.height / 2;
    this.ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * 5;
    this.ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * 5;
  }
  
  onHandsResults(results) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (results.multiHandLandmarks) {
      let topHand = null;
      let bottomHand = null;
      
      results.multiHandLandmarks.forEach((landmarks, index) => {
        const palmY = landmarks[0].y * this.canvas.height;
        
        if (!topHand || palmY < topHand.y) {
          topHand = {
            x: landmarks[0].x * this.canvas.width,
            y: palmY,
            color: 'red'
          };
        } else if (!bottomHand || palmY > bottomHand.y) {
          bottomHand = {
            x: landmarks[0].x * this.canvas.width,
            y: palmY,
            color: 'blue'
          };
        }
      });
      
      if (topHand && bottomHand) {
        this.statusElement.style.display = 'none';
        this.updateGame(topHand, bottomHand);
      } else {
        this.statusElement.style.display = 'block';
      }
    }
  }
  
  updateGame(topHand, bottomHand) {
    // Update paddle positions
    const player1X = topHand.x - this.paddleWidth / 2;
    const player2X = bottomHand.x - this.paddleWidth / 2;
    
    // Draw paddles
    this.ctx.fillStyle = topHand.color;
    this.ctx.fillRect(player1X, 20, this.paddleWidth, this.paddleHeight);
    
    this.ctx.fillStyle = bottomHand.color;
    this.ctx.fillRect(player2X, this.canvas.height - 40, this.paddleWidth, this.paddleHeight);
    
    // Update ball position
    this.ballX += this.ballSpeedX;
    this.ballY += this.ballSpeedY;
    
    // Ball collision with walls
    if (this.ballX <= 0 || this.ballX >= this.canvas.width) {
      this.ballSpeedX = -this.ballSpeedX;
    }
    
    // Ball collision with paddles
    if (this.ballY <= 40 && this.ballX >= player1X && this.ballX <= player1X + this.paddleWidth) {
      this.ballSpeedY = -this.ballSpeedY;
    }
    
    if (this.ballY >= this.canvas.height - 40 && 
        this.ballX >= player2X && 
        this.ballX <= player2X + this.paddleWidth) {
      this.ballSpeedY = -this.ballSpeedY;
    }
    
    // Score points
    if (this.ballY <= 0) {
      this.player2Score++;
      document.getElementById('player2-score').textContent = this.player2Score;
      this.resetBall();
    } else if (this.ballY >= this.canvas.height) {
      this.player1Score++;
      document.getElementById('player1-score').textContent = this.player1Score;
      this.resetBall();
    }
    
    // Draw ball
    this.ctx.fillStyle = 'white';
    this.ctx.beginPath();
    this.ctx.arc(this.ballX, this.ballY, this.ballSize, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Request next frame
    requestAnimationFrame(() => this.draw());
  }
  
  draw() {
    if (!this.ctx) return;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// Start the game when the page loads
window.addEventListener('load', () => {
  new PongGame();
});