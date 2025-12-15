const btn = document.getElementById("hello-btn");
const message = document.getElementById("message");

if (btn && message) {
  btn.addEventListener("click", () => {
    const phrases = [
      "Hello world ! 🎅",
      "Joyeux code et joyeux Noël ! 🎁",
      "Tout est prêt pour Netlify ✨",
      "Deployment ready, capitaine 🚀"
    ];

    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    message.textContent = phrase;
  });
}


