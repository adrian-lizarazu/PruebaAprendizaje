const imagenes = document.querySelector('.imagenes');
const total = document.querySelectorAll('.imagenes img').length;
let indice = 0;

function mostrarImagen() {
    const ancho = document.querySelector('.carrusel').clientWidth;
    imagenes.style.transform = `translateX(${-indice * ancho}px)`;
}

function siguiente() {
    indice = (indice + 1) % total;
    mostrarImagen();
}

// Cambio automático cada 4 segundos
setInterval(siguiente, 4000);

// Ajuste automático al redimensionar la ventana
window.addEventListener('resize', mostrarImagen);
