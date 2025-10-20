/* Editor SVG: crea formas, permite mover, redimensionar, editar texto y eliminar.
   Comentarios en español para entender cada parte. */

const svg = document.getElementById('canvas');
const NS = "http://www.w3.org/2000/svg";

let zIndexCounter = 1; // para llevar "delante" al seleccionado
let current = null;    // el grupo (<g>) seleccionado
let mode = null;       // "drag" | "resize"
let dragOffset = {x:0,y:0};
let resizeInfo = null; // {handle,dir,orig,...}

// UTIL: convertir evento pointer a coordenadas SVG
function toSvgPoint(evt){
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Crear un grupo que contiene forma + texto + handles
function makeShapeGroup(type, x=120, y=80, w=120, h=80, text='Texto'){
  const g = document.createElementNS(NS,'g');
  g.classList.add('shape-group');
  g.setAttribute('data-type', type);
  g.setAttribute('data-x', x);
  g.setAttribute('data-y', y);
  g.setAttribute('data-w', w);
  g.setAttribute('data-h', h);
  g.style.pointerEvents = 'visiblePainted';
  g.setAttribute('transform', `translate(${x},${y})`);
  g.style.zIndex = ++zIndexCounter;

  // Crear la forma según el tipo
  let shape;
  if(type === 'square'){
    shape = document.createElementNS(NS,'rect');
    shape.setAttribute('x', 0);
    shape.setAttribute('y', 0);
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    shape.setAttribute('rx', 0);
    shape.setAttribute('ry', 0);
  } else if(type === 'round-rect'){
    shape = document.createElementNS(NS,'rect');
    shape.setAttribute('x', 0);
    shape.setAttribute('y', 0);
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    shape.setAttribute('rx', Math.min(w,h)*0.2);
    shape.setAttribute('ry', Math.min(w,h)*0.2);
  } else if(type === 'diamond'){
    // rombo: lo generamos como polígono centrado en (w/2,h/2)
    shape = document.createElementNS(NS,'polygon');
    const points = diamondPoints(w,h);
    shape.setAttribute('points', points.map(p=>p.join(',')).join(' '));
  }

  shape.classList.add('shape');
  shape.setAttribute('fill', '#fde6b3');
  shape.setAttribute('stroke', '#c69b2b');
  shape.setAttribute('stroke-width', 1.6);
  g.appendChild(shape);

  // Texto centrado
  const tx = document.createElementNS(NS,'text');
  tx.classList.add('shape-text');
  tx.textContent = text;
  tx.setAttribute('x', w/2);
  tx.setAttribute('y', h/2);
  g.appendChild(tx);

  // Rectangular de selección (visual)
  const sel = document.createElementNS(NS,'rect');
  sel.classList.add('selection-rect');
  sel.setAttribute('x', -6);
  sel.setAttribute('y', -6);
  sel.setAttribute('width', w+12);
  sel.setAttribute('height', h+12);
  g.appendChild(sel);

  // Asas: 4 asas (esquina inferior-derecha para ejemplo) -> vamos a usar 4 esquinas
  const handles = [
    {name:'tl', cx:0, cy:0, cursor:'nwse-resize'},
    {name:'tr', cx:w, cy:0, cursor:'nesw-resize'},
    {name:'br', cx:w, cy:h, cursor:'nwse-resize'},
    {name:'bl', cx:0, cy:h, cursor:'nesw-resize'}
  ];
  handles.forEach(hd=>{
    const c = document.createElementNS(NS,'rect');
    c.classList.add('handle');
    c.setAttribute('data-handle', hd.name);
    c.setAttribute('x', hd.cx - 4);
    c.setAttribute('y', hd.cy - 4);
    c.setAttribute('width', 8);
    c.setAttribute('height', 8);
    c.setAttribute('rx', 2);
    c.setAttribute('ry', 2);
    c.setAttribute('fill', '#fff');
    c.setAttribute('stroke', '#2b7fb8');
    c.style.cursor = hd.cursor;
    g.appendChild(c);
  });

  // eventos
  g.addEventListener('pointerdown', shapePointerDown);
  g.addEventListener('dblclick', groupDoubleClick);
  // prevenir que svg capture el pointer directamente
  g.querySelectorAll('.handle').forEach(h=>h.addEventListener('pointerdown', handlePointerDown));

  // permitir foco/teclas
  svg.appendChild(g);
  return g;
}

// calcular puntos para el rombo (relativo a 0,0)
function diamondPoints(w,h){
  // centro
  const cx = w/2, cy = h/2;
  return [
    [cx, 0],
    [w, cy],
    [cx, h],
    [0, cy]
  ];
}

/* ---------- eventos y lógica de selección / arrastre / resize ---------- */

function clearSelection(){
  if(current){
    current.classList.remove('g-selected');
    current = null;
  }
}
function selectGroup(g){
  if(current === g) return;
  clearSelection();
  current = g;
  g.classList.add('g-selected');
  // llevar al frente
  g.parentNode.appendChild(g);
  // actualizar z-index (visual; SVG no tiene z-index real)
  zIndexCounter++;
  // actualizamos la visibles (selection rect y handles) con dimensiones actuales
  updateGroupVisuals(g);
}

// pointerdown sobre la forma (grupo)
function shapePointerDown(evt){
  // marcar el elemento
  evt.stopPropagation();
  const g = evt.currentTarget;
  selectGroup(g);

  // si el target es manejador lo ignoramos aquí (handled by handlePointerDown)
  if(evt.target.classList.contains('handle')) return;

  mode = 'drag';
  const p = toSvgPoint(evt);
  const gx = parseFloat(g.getAttribute('data-x'));
  const gy = parseFloat(g.getAttribute('data-y'));
  dragOffset.x = p.x - gx;
  dragOffset.y = p.y - gy;

  // captura pointer para recibir move/up even cuando el cursor salga del svg
  g.setPointerCapture(evt.pointerId);

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

// pointerdown sobre un handle
function handlePointerDown(evt){
  evt.stopPropagation();
  const handle = evt.currentTarget;
  const g = handle.parentNode;
  selectGroup(g);
  mode = 'resize';
  const p = toSvgPoint(evt);
  const x = parseFloat(g.getAttribute('data-x'));
  const y = parseFloat(g.getAttribute('data-y'));
  const w = parseFloat(g.getAttribute('data-w'));
  const h = parseFloat(g.getAttribute('data-h'));
  resizeInfo = {
    handle: handle.getAttribute('data-handle'),
    startPointer: p,
    orig: {x,y,w,h},
    forType: g.getAttribute('data-type')
  };
  handle.setPointerCapture(evt.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(evt){
  if(!current) return;
  const p = toSvgPoint(evt);

  if(mode === 'drag'){
    const nx = p.x - dragOffset.x;
    const ny = p.y - dragOffset.y;
    current.setAttribute('data-x', nx);
    current.setAttribute('data-y', ny);
    current.setAttribute('transform', `translate(${nx},${ny})`);
    updateGroupVisuals(current);
  } else if(mode === 'resize' && resizeInfo){
    const info = resizeInfo;
    const dx = p.x - info.startPointer.x;
    const dy = p.y - info.startPointer.y;
    let {x,y,w,h} = info.orig;
    const handle = info.handle;

    // según el asa, ajustamos x,y,w,h
    if(handle === 'br'){ // bottom-right
      w = Math.max(20, info.orig.w + dx);
      h = Math.max(20, info.orig.h + dy);
    } else if(handle === 'tr'){ // top-right
      w = Math.max(20, info.orig.w + dx);
      // mover y hacia arriba
      y = info.orig.y + dy;
      h = Math.max(20, info.orig.h - dy);
    } else if(handle === 'tl'){ // top-left
      x = info.orig.x + dx;
      y = info.orig.y + dy;
      w = Math.max(20, info.orig.w - dx);
      h = Math.max(20, info.orig.h - dy);
    } else if(handle === 'bl'){ // bottom-left
      x = info.orig.x + dx;
      w = Math.max(20, info.orig.w - dx);
      h = Math.max(20, info.orig.h + dy);
    }

    // guardar y aplicar
    current.setAttribute('data-x', x);
    current.setAttribute('data-y', y);
    current.setAttribute('data-w', w);
    current.setAttribute('data-h', h);
    current.setAttribute('transform', `translate(${x},${y})`);
    updateGroupVisuals(current);
  }
}

function onPointerUp(evt){
  mode = null;
  resizeInfo = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  // release captures
  try{
    if(evt.currentTarget) evt.currentTarget.releasePointerCapture?.(evt.pointerId);
  }catch(e){}
}

// actualizar rect de selección, handles y forma según atributos
function updateGroupVisuals(g){
  const type = g.getAttribute('data-type');
  const w = parseFloat(g.getAttribute('data-w'));
  const h = parseFloat(g.getAttribute('data-h'));
  // actualizamos forma en cada tipo
  const shape = g.querySelector('.shape');
  if(type === 'diamond'){
    shape.setAttribute('points', diamondPoints(w,h).map(p=>p.join(',')).join(' '));
  } else {
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    if(type === 'round-rect'){
      // ajustar radio de esquinas
      const rx = Math.min(w,h)*0.18;
      shape.setAttribute('rx', rx);
      shape.setAttribute('ry', rx);
    }
  }

  // actualizar texto posición y tamaño
  const txt = g.querySelector('.shape-text');
  txt.setAttribute('x', w/2);
  txt.setAttribute('y', h/2);

  // actualizar selection rect (toma en cuenta padding)
  const sel = g.querySelector('.selection-rect');
  sel.setAttribute('width', w + 12);
  sel.setAttribute('height', h + 12);

  // actualizar handles (4 primero rects con clase handle)
  const hs = Array.from(g.querySelectorAll('.handle'));
  const coords = [
    [0,0],
    [w,0],
    [w,h],
    [0,h]
  ];
  hs.forEach((hNode,i)=>{
    const [cx,cy] = coords[i];
    hNode.setAttribute('x', cx - 4);
    hNode.setAttribute('y', cy - 4);
  });
}

/* doble click en el grupo: si en texto => editar texto; si en forma => tambien editar texto */
function groupDoubleClick(evt){
  evt.stopPropagation();
  const g = evt.currentTarget;
  const txt = g.querySelector('.shape-text');
  const newText = prompt('Editar texto:', txt.textContent);
  if(newText !== null){
    txt.textContent = newText;
  }
}

/* ---------- botones para agregar formas ---------- */
document.getElementById('add-square').addEventListener('click', ()=>{
  const g = makeShapeGroup('square', 100, 80, 120, 120, 'Cuadrado');
  selectGroup(g);
});
document.getElementById('add-round-rect').addEventListener('click', ()=>{
  const g = makeShapeGroup('round-rect', 140, 120, 160, 100, 'Rectángulo');
  selectGroup(g);
});
document.getElementById('add-diamond').addEventListener('click', ()=>{
  const g = makeShapeGroup('diamond', 200, 150, 120, 120, 'Rombo');
  selectGroup(g);
});

/* click en el lienzo para deseleccionar */
svg.addEventListener('pointerdown', (evt)=>{
  if(evt.target === svg || evt.target.tagName === 'rect' && evt.target.parentNode === svg){
    clearSelection();
  }
});

/* permitir borrar con tecla Supr/Backspace */
window.addEventListener('keydown', (evt)=>{
  if(!current) return;
  if(evt.key === 'Delete' || evt.key === 'Backspace'){
    current.remove();
    current = null;
  }
});
