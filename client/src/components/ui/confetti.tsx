// Confetti animation component
export function Confetti() {
  // Create confetti effect
  const confettiCount = 100;
  const colors = ['#ff6b6b', '#ff8787', '#ffa5a5', '#4ecdc4', '#45b7aa', '#ffe66d'];
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.opacity = '1';
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.style.transition = 'all 2s ease-out';
    confetti.style.zIndex = '9999';
    
    document.body.appendChild(confetti);
    
    // Animate confetti
    setTimeout(() => {
      confetti.style.top = '100vh';
      confetti.style.opacity = '0';
      confetti.style.transform = `rotate(${Math.random() * 720}deg) translateX(${(Math.random() - 0.5) * 200}px)`;
    }, 10);
    
    // Remove confetti after animation
    setTimeout(() => {
      confetti.remove();
    }, 2000);
  }
}