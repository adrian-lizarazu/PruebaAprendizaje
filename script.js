// Seleccionamos los botones
const btn1 = document.getElementById("btn1");
const btn2 = document.getElementById("btn2");
const btn3 = document.getElementById("btn3");

// Cuando se hace clic, cambiamos el color de fondo del body
btn1.addEventListener("click", () => {
  document.body.style.background = "#ffb3b3"; // rojo claro
});

btn2.addEventListener("click", () => {
  document.body.style.background = "#b3ffcc"; // verde claro
});

btn3.addEventListener("click", () => {
  document.body.style.background = "#b3c6ff"; // azul claro
});
