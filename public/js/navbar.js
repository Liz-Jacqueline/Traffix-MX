window.addEventListener("scroll", function () {
  const navbar = document.querySelector(".navbar-custom");

  if (!navbar) return;

  if (window.scrollY > 80) {
    navbar.style.top = "10px";
    navbar.style.background = "rgba(0, 0, 0, 0.9)";
    navbar.style.boxShadow = "0px 15px 40px rgba(0,0,0,0.45)";
  } else {
    navbar.style.top = "20px";
    navbar.style.background = "rgba(0, 0, 0, 0.75)";
    navbar.style.boxShadow = "0px 8px 30px rgba(0,0,0,0.3)";
  }
});