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
    
    // Add gesture tracking properties
    this.previousHandPositions = {
      top: null,
      bottom: null
    };
    this.gestureThreshold = 15; // Speed threshold for flick detection
    this.windEffects = [];
    
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
    this.deltaTime = (currentTime - this.lastTime) / 16.67;
    this.lastTime = currentTime;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (results.multiHandLandmarks) {
      let topHand = null;
      let bottomHand = null;
      
      results.multiHandLandmarks.forEach((landmarks, index) => {
        const palmY = landmarks[0].y * this.canvas.height;
        const palmX = landmarks[0].x * this.canvas.width;
        
        // Calculate hand velocity
        const handVelocity = this.calculateHandVelocity(landmarks, palmX, palmY);
        
        if (!topHand || palmY < topHand.y) {
          topHand = {
            x: palmX,
            y: palmY,
            color: 'red',
            velocity: handVelocity,
            landmarks: landmarks
          };
        } else if (!bottomHand || palmY > bottomHand.y) {
          bottomHand = {
            x: palmX,
            y: palmY,
            color: 'blue',
            velocity: handVelocity,
            landmarks: landmarks
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

    // Update wind effects
    this.updateWindEffects();
  }

  calculateHandVelocity(landmarks, currentX, currentY) {
    const handKey = currentY < this.canvas.height / 2 ? 'top' : 'bottom';
    const previousPosition = this.previousHandPositions[handKey];
    
    if (!previousPosition) {
      this.previousHandPositions[handKey] = { x: currentX, y: currentY, time: performance.now() };
      return 0;
    }

    const deltaTime = (performance.now() - previousPosition.time) / 1000; // Convert to seconds
    const deltaX = currentX - previousPosition.x;
    const velocity = Math.abs(deltaX) / deltaTime;

    // Update previous position
    this.previousHandPositions[handKey] = { x: currentX, y: currentY, time: performance.now() };

    return velocity;
  }

  createWindEffect(x, y, direction, color) {
    const wind = {
      x: x,
      y: y,
      direction: direction,
      color: color,
      age: 0,
      maxAge: 30,
      particles: Array.from({ length: 10 }, () => ({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        size: Math.random() * 10 + 5,
        speed: Math.random() * 5 + 10,
        angle: (Math.random() - 0.5) * 0.5 + (direction === 'up' ? -Math.PI/2 : Math.PI/2)
      }))
    };
    this.windEffects.push(wind);
  }

  updateWindEffects() {
    for (let i = this.windEffects.length - 1; i >= 0; i--) {
      const wind = this.windEffects[i];
      wind.age++;
      
      // Update particles
      wind.particles.forEach(particle => {
        particle.x += Math.cos(particle.angle) * particle.speed;
        particle.y += Math.sin(particle.angle) * particle.speed;
        particle.size *= 0.95;
      });

      // Draw wind effect
      this.ctx.save();
      this.ctx.globalAlpha = 1 - (wind.age / wind.maxAge);
      
      wind.particles.forEach(particle => {
        this.ctx.beginPath();
        this.ctx.fillStyle = wind.color + '80'; // Add transparency
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      });
      
      this.ctx.restore();

      // Remove old effects
      if (wind.age >= wind.maxAge) {
        this.windEffects.splice(i, 1);
      }
    }
  }

  updateGame(topHand, bottomHand) {
    // Check for flick gestures
    if (topHand.velocity > this.gestureThreshold) {
      this.createWindEffect(topHand.x, 40, 'down', topHand.color);
    }
    if (bottomHand.velocity > this.gestureThreshold) {
      this.createWindEffect(bottomHand.x, this.canvas.height - 40, 'up', bottomHand.color);
    }

    // Apply wind effects to ball
    this.applyWindToBall();

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

  applyWindToBall() {
    for (const wind of this.windEffects) {
      const dx = this.ballX - wind.x;
      const dy = this.ballY - wind.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 200) { // Wind effect range
        const strength = (1 - distance / 200) * 0.5;
        const direction = wind.direction === 'up' ? -1 : 1;
        
        this.ballSpeedY += direction * strength;
        this.ballSpeedX += (dx / distance) * strength;
      }
    }
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