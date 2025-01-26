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
    
    // Improved initial ball speed
    this.initialBallSpeed = 8;
    this.maxBallSpeed = 15;
    this.speedIncrease = 0.2;
    
    // Add timing variables for smooth animation
    this.lastTime = 0;
    this.deltaTime = 0;
    
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
    
    // Randomize initial direction with better angle distribution
    const angle = (Math.random() * Math.PI / 2) - Math.PI / 4; // -45 to 45 degrees
    this.ballSpeedX = this.initialBallSpeed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
    this.ballSpeedY = this.initialBallSpeed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
    
    // Add some spin effect
    this.spinEffect = 0;
  }
  
  onHandsResults(results) {
    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.lastTime) / 16.67; // Normalize to 60 FPS
    this.lastTime = currentTime;

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
    // Update paddle positions with interpolation for smoothness
    const player1X = topHand.x - this.paddleWidth / 2;
    const player2X = bottomHand.x - this.paddleWidth / 2;
    
    // Draw paddles
    this.ctx.fillStyle = topHand.color;
    this.ctx.fillRect(player1X, 20, this.paddleWidth, this.paddleHeight);
    
    this.ctx.fillStyle = bottomHand.color;
    this.ctx.fillRect(player2X, this.canvas.height - 40, this.paddleWidth, this.paddleHeight);
    
    // Update ball position with delta time for consistent speed
    this.ballX += this.ballSpeedX * this.deltaTime;
    this.ballY += this.ballSpeedY * this.deltaTime;
    
    // Add spin effect to X movement
    this.ballX += this.spinEffect * this.deltaTime;
    
    // Ball collision with walls with improved bouncing
    if (this.ballX - this.ballSize <= 0 || this.ballX + this.ballSize >= this.canvas.width) {
      this.ballSpeedX = -this.ballSpeedX * 1.02; // Slight speed increase on wall hits
      this.spinEffect *= 0.5; // Reduce spin on wall collision
    }
    
    // Ball collision with paddles - improved physics
    if (this.ballY <= 40 + this.ballSize && 
        this.ballX >= player1X && 
        this.ballX <= player1X + this.paddleWidth) {
      // Calculate hit position relative to paddle center
      const hitPos = (this.ballX - (player1X + this.paddleWidth / 2)) / (this.paddleWidth / 2);
      this.handlePaddleCollision(hitPos);
    }
    
    if (this.ballY >= this.canvas.height - 40 - this.ballSize && 
        this.ballX >= player2X && 
        this.ballX <= player2X + this.paddleWidth) {
      const hitPos = (this.ballX - (player2X + this.paddleWidth / 2)) / (this.paddleWidth / 2);
      this.handlePaddleCollision(hitPos);
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
    
    // Draw ball with motion blur effect
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(this.ballX, this.ballY, this.ballSize, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add ball trail
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.beginPath();
    this.ctx.arc(this.ballX - this.ballSpeedX, this.ballY - this.ballSpeedY, 
                 this.ballSize * 0.8, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Request next frame
    requestAnimationFrame(() => this.draw());
  }
  
  handlePaddleCollision(hitPos) {
    // Reverse Y direction
    this.ballSpeedY = -this.ballSpeedY;
    
    // Add spin effect based on hit position
    this.spinEffect = hitPos * 3;
    
    // Adjust angle based on where the ball hits the paddle
    this.ballSpeedX += hitPos * 5;
    
    // Increase speed slightly with each hit
    const currentSpeed = Math.sqrt(this.ballSpeedX * this.ballSpeedX + 
                                 this.ballSpeedY * this.ballSpeedY);
    if (currentSpeed < this.maxBallSpeed) {
      const speedMultiplier = 1 + this.speedIncrease;
      this.ballSpeedX *= speedMultiplier;
      this.ballSpeedY *= speedMultiplier;
    }
    
    // Normalize speed to prevent extreme angles
    const newSpeed = Math.sqrt(this.ballSpeedX * this.ballSpeedX + 
                             this.ballSpeedY * this.ballSpeedY);
    this.ballSpeedX = (this.ballSpeedX / newSpeed) * currentSpeed;
    this.ballSpeedY = (this.ballSpeedY / newSpeed) * currentSpeed;
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