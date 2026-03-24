function setMode(mode) {
  const wrapper       = document.getElementById('wrapper');
  const signinContent = document.getElementById('slider-signin-content');
  const signupContent = document.getElementById('slider-signup-content');

  if (mode === 'signup') {
    // first swap content
    signinContent.style.display = 'none';
    signupContent.style.display = 'flex';
    requestAnimationFrame(() => {
      wrapper.classList.add('signup-mode');
    });
  } else {
    signupContent.style.display = 'none';
    signinContent.style.display = 'flex';
    requestAnimationFrame(() => {
      wrapper.classList.remove('signup-mode');
    });
  }
}

// oculta el slider completamente
function hideSlider() {
  const slider = document.getElementById('slider');
  if (slider) slider.style.display = 'none';
}

// conectar los botones de envío para ocultar slider al click
function attachFormHandlers() {
  const buttons = document.querySelectorAll('.submit-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => hideSlider());
  });
}

// inicialización global
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('wrapper');
  wrapper.classList.remove('signup-mode'); // asegurarnos modo Sign In

  document.getElementById('slider-signin-content').style.display = 'flex';
  document.getElementById('slider-signup-content').style.display = 'none';

  attachFormHandlers();
});