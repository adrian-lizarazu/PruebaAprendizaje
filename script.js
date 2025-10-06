document.addEventListener('DOMContentLoaded', () => {

   
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

    setInterval(siguiente, 4000);
    window.addEventListener('resize', mostrarImagen);

    
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    
    document.querySelectorAll('.submenu > a').forEach(submenu => {
        submenu.addEventListener('click', (e) => {
            e.preventDefault(); 
            const liPadre = submenu.parentElement;
            liPadre.classList.toggle('show'); 
        });
    });

    
    window.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
            menu.classList.remove('show');
            document.querySelectorAll('.submenu').forEach(li => li.classList.remove('show'));
        }
    });

});

