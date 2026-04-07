// Confetti animation component
export function Confetti() {
  // Create confetti effect
  const confettiCount = 100;
  const colors = ['#ff6b6b', '#ff8787', '#ffa5a5', '#4ecdc4', '#45b7aa', '#ffe66d'];
  const startTime = Date.now();
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    // Use deterministic color selection based on index
    confetti.style.backgroundColor = colors[i % colors.length];
    // Use deterministic position based on index
    confetti.style.left = ((i * 37) % 100) + '%';
    confetti.style.top = '-10px';
    confetti.style.opacity = '1';
    // Use deterministic rotation based on index
    confetti.style.transform = `rotate(${(i * 137) % 360}deg)`;
    confetti.style.transition = 'all 2s ease-out';
    confetti.style.zIndex = '9999';
    
    document.body.appendChild(confetti);
    
    // Animate confetti
    setTimeout(() => {
      confetti.style.top = '100vh';
      confetti.style.opacity = '0';
      // Use deterministic animation based on index and time
      const rotation = ((i * 237 + startTime) % 720);
      const translation = ((i % 2 === 0 ? 1 : -1) * ((i * 17) % 100));
      confetti.style.transform = `rotate(${rotation}deg) translateX(${translation}px)`;
    }, 10);
    
    // Remove confetti after animation
    setTimeout(() => {
      confetti.remove();
    }, 2000);
  }
}