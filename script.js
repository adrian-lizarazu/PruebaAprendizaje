const svg = document.getElementById('svg');
const NS = "http://www.w3.org/2000/svg";

let zIndexCounter = 1;
let current = null;
let mode = null;
let dragOffset = {x:0,y:0};
let resizeInfo = null;

function toSvgPoint(evt){
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

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
    shape = document.createElementNS(NS,'polygon');
    const points = diamondPoints(w,h);
    shape.setAttribute('points', points.map(p=>p.join(',')).join(' '));
  }

  shape.classList.add('shape');
  shape.setAttribute('fill', '#fde6b3');
  shape.setAttribute('stroke', '#c69b2b');
  shape.setAttribute('stroke-width', 1.6);
  g.appendChild(shape);

  const tx = document.createElementNS(NS,'text');
  tx.classList.add('shape-text');
  tx.textContent = text;
  tx.setAttribute('x', w/2);
  tx.setAttribute('y', h/2);
  g.appendChild(tx);

  const sel = document.createElementNS(NS,'rect');
  sel.classList.add('selection-rect');
  sel.setAttribute('x', -6);
  sel.setAttribute('y', -6);
  sel.setAttribute('width', w+12);
  sel.setAttribute('height', h+12);
  g.appendChild(sel);

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

  g.addEventListener('pointerdown', shapePointerDown);
  g.addEventListener('dblclick', groupDoubleClick);
  g.querySelectorAll('.handle').forEach(h=>h.addEventListener('pointerdown', handlePointerDown));

  svg.appendChild(g);
  return g;
}

function diamondPoints(w,h){
  const cx = w/2, cy = h/2;
  return [
    [cx, 0],
    [w, cy],
    [cx, h],
    [0, cy]
  ];
}

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
  g.parentNode.appendChild(g);
  zIndexCounter++;
  updateGroupVisuals(g);
}

function shapePointerDown(evt){
  evt.stopPropagation();
  const g = evt.currentTarget;
  selectGroup(g);

  if(evt.target.classList.contains('handle')) return;

  mode = 'drag';
  const p = toSvgPoint(evt);
  const gx = parseFloat(g.getAttribute('data-x'));
  const gy = parseFloat(g.getAttribute('data-y'));
  dragOffset.x = p.x - gx;
  dragOffset.y = p.y - gy;

  g.setPointerCapture(evt.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

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

    if(handle === 'br'){
      w = Math.max(20, info.orig.w + dx);
      h = Math.max(20, info.orig.h + dy);
    } else if(handle === 'tr'){
      w = Math.max(20, info.orig.w + dx);
      y = info.orig.y + dy;
      h = Math.max(20, info.orig.h - dy);
    } else if(handle === 'tl'){
      x = info.orig.x + dx;
      y = info.orig.y + dy;
      w = Math.max(20, info.orig.w - dx);
      h = Math.max(20, info.orig.h - dy);
    } else if(handle === 'bl'){
      x = info.orig.x + dx;
      w = Math.max(20, info.orig.w - dx);
      h = Math.max(20, info.orig.h + dy);
    }

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
  try{ if(evt.currentTarget) evt.currentTarget.releasePointerCapture?.(evt.pointerId); }catch(e){}
}

function updateGroupVisuals(g){
  const type = g.getAttribute('data-type');
  const w = parseFloat(g.getAttribute('data-w'));
  const h = parseFloat(g.getAttribute('data-h'));
  const shape = g.querySelector('.shape');
  if(type === 'diamond'){
    shape.setAttribute('points', diamondPoints(w,h).map(p=>p.join(',')).join(' '));
  } else {
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    if(type === 'round-rect'){
      const rx = Math.min(w,h)*0.18;
      shape.setAttribute('rx', rx);
      shape.setAttribute('ry', rx);
    }
  }
  const txt = g.querySelector('.shape-text');
  txt.setAttribute('x', w/2);
  txt.setAttribute('y', h/2);
  const sel = g.querySelector('.selection-rect');
  sel.setAttribute('width', w + 12);
  sel.setAttribute('height', h + 12);

  const hs = Array.from(g.querySelectorAll('.handle'));
  const coords = [[0,0],[w,0],[w,h],[0,h]];
  hs.forEach((hNode,i)=>{
    const [cx,cy] = coords[i];
    hNode.setAttribute('x', cx - 4);
    hNode.setAttribute('y', cy - 4);
  });
}

/* ---------- doble click para editar texto con estilo ---------- */
function groupDoubleClick(evt){
  evt.stopPropagation();
  const g = evt.currentTarget;
  const txt = g.querySelector('.shape-text');

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.3)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 10000;

  const box = document.createElement('div');
  box.style.background = 'linear-gradient(180deg, #16324a, #0f2230)';
  box.style.padding = '16px';
  box.style.borderRadius = '8px';
  box.style.minWidth = '250px';
  box.style.textAlign = 'center';
  box.style.fontFamily = 'Arial, sans-serif';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '8px';
  box.style.color = '#eef6fb';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = txt.textContent;
  input.style.fontSize = '16px';
  input.style.padding = '6px';
  input.style.width = '100%';
  input.style.borderRadius = '4px';
  input.style.border = '1px solid #2ea3f2';
  input.style.outline = 'none';
  box.appendChild(input);

  const btn = document.createElement('button');
  btn.textContent = 'Aceptar';
  btn.style.fontSize = '14px';
  btn.style.padding = '6px';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.background = '#2ea3f2';
  btn.style.color = '#fff';
  btn.onclick = () => {
    txt.textContent = input.value;
    document.body.removeChild(overlay);
  };
  box.appendChild(btn);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();

  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      txt.textContent = input.value;
      document.body.removeChild(overlay);
    }
  });
}

/* ---------- botones para agregar formas ---------- */
document.getElementById('add-square').addEventListener('click', ()=>{
  const g = makeShapeGroup('square', 100, 80, 120, 120, 'Funcion');
  selectGroup(g);
});
document.getElementById('add-round-rect').addEventListener('click', ()=>{
  const g = makeShapeGroup('round-rect', 140, 120, 160, 60, 'Inicio');
  selectGroup(g);
});
document.getElementById('add-diamond').addEventListener('click', ()=>{
  const g = makeShapeGroup('diamond', 200, 150, 120, 120, 'Condicion');
  selectGroup(g);
});

svg.addEventListener('pointerdown', (evt)=>{
  if(evt.target === svg || (evt.target.tagName === 'rect' && evt.target.parentNode === svg)){
    clearSelection();
  }
});

// borrar solo con Supr, ignorando Backspace y inputs activos
window.addEventListener('keydown', (evt)=>{
  if(!current) return;
  const activeTag = document.activeElement.tagName.toLowerCase();
  if(activeTag === 'input' || activeTag === 'textarea') return;
  if(evt.key === 'Delete'){
    current.remove();
    current = null;
  }
});