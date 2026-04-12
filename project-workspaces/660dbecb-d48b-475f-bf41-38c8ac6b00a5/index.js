
document.addEventListener('DOMContentLoaded', () => {
  const upvoteButtons = document.querySelectorAll('button.text-green-500');
  const downvoteButtons = document.querySelectorAll('button.text-red-500');

  upvoteButtons.forEach(button => button.addEventListener('click', (event) => {
    const countElem = button.nextElementSibling;
    let count = parseInt(countElem.textContent);
    countElem.textContent = count + 1;
    animateButton(button);
  }));

  downvoteButtons.forEach(button => button.addEventListener('click', (event) => {
    const countElem = button.previousElementSibling;
    let count = parseInt(countElem.textContent);
    countElem.textContent = count - 1;
    animateButton(button);
  }));

  function animateButton(button) {
    button.classList.add('animate-pulse');
    setTimeout(() => {
      button.classList.remove('animate-pulse');
    }, 500);
  }
});
