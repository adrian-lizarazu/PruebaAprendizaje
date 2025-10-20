
const svg = document.getElementById('svg');
const NS = "http://www.w3.org/2000/svg";

let zIndexCounter = 1;
let current = null;
let mode = null;
let dragOffset = {x:0,y:0};
let resizeInfo = null;
let rotateInfo = null;


const db = new PouchDB('diagram-db');


function toSvgPoint(evt){
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function diamondPoints(w,h){
  const cx = w/2, cy = h/2;
  return [[cx,0],[w,cy],[cx,h],[0,cy]];
}


function makeShapeGroup(type, x=120, y=80, w=120, h=80, text='Texto', rot=0){
  const g = document.createElementNS(NS,'g');
  g.classList.add('shape-group');
  g.setAttribute('data-type', type);
  g.setAttribute('data-x', x);
  g.setAttribute('data-y', y);
  g.setAttribute('data-w', w);
  g.setAttribute('data-h', h);
  g.setAttribute('data-rot', rot);
  g.style.pointerEvents = 'visiblePainted';
  g.setAttribute('transform', `translate(${x},${y}) rotate(${rot} ${w/2} ${h/2})`);
  g.style.zIndex = ++zIndexCounter;

  let shape;
  if(type === 'square' || type === 'round-rect'){
    shape = document.createElementNS(NS,'rect');
    shape.setAttribute('x', 0);
    shape.setAttribute('y', 0);
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    if(type==='round-rect'){
      shape.setAttribute('rx', Math.min(w,h)*0.2);
      shape.setAttribute('ry', Math.min(w,h)*0.2);
    }
  } else if(type === 'diamond'){
    shape = document.createElementNS(NS,'polygon');
    shape.setAttribute('points', diamondPoints(w,h).map(p=>p.join(',')).join(' '));
  } else if(type === 'arrow'){
    
    shape = document.createElementNS(NS,'line');
    shape.setAttribute('x1', 0);
    shape.setAttribute('y1', h/2);
    shape.setAttribute('x2', w);
    shape.setAttribute('y2', h/2);
    shape.setAttribute('stroke', '#c69b2b');
    shape.setAttribute('stroke-width', 3);
    shape.setAttribute('marker-end','url(#arrowhead)');
  }

  shape.classList.add('shape');
  if(type !== 'arrow') shape.setAttribute('fill', '#fde6b3');
  if(type !== 'arrow') shape.setAttribute('stroke', '#c69b2b');
  if(type !== 'arrow') shape.setAttribute('stroke-width', 1.6);
  g.appendChild(shape);

  if(type !== 'arrow'){
    const tx = document.createElementNS(NS,'text');
    tx.classList.add('shape-text');
    tx.textContent = text;
    tx.setAttribute('x', w/2);
    tx.setAttribute('y', h/2);
    g.appendChild(tx);
  }

  
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
    {name:'bl', cx:0, cy:h, cursor:'nesw-resize'},
    {name:'rot', cx:w/2, cy:-20, cursor:'grab'}
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
  g.querySelectorAll('.handle').forEach(h=>{
    h.addEventListener('pointerdown', handlePointerDown);
  });

  svg.appendChild(g);
  return g;
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
  dragOffset.x = p.x - parseFloat(g.getAttribute('data-x'));
  dragOffset.y = p.y - parseFloat(g.getAttribute('data-y'));

  g.setPointerCapture(evt.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function handlePointerDown(evt){
  evt.stopPropagation();
  const handle = evt.currentTarget;
  const g = handle.parentNode;
  selectGroup(g);
  const p = toSvgPoint(evt);

  if(handle.getAttribute('data-handle') === 'rot'){
    mode = 'rotate';
    rotateInfo = {
      centerX: parseFloat(g.getAttribute('data-x')) + parseFloat(g.getAttribute('data-w'))/2,
      centerY: parseFloat(g.getAttribute('data-y')) + parseFloat(g.getAttribute('data-h'))/2,
      startAngle: parseFloat(g.getAttribute('data-rot')) || 0,
      startPointer: p
    };
  } else {
    mode = 'resize';
    const x = parseFloat(g.getAttribute('data-x'));
    const y = parseFloat(g.getAttribute('data-y'));
    const w = parseFloat(g.getAttribute('data-w'));
    const h = parseFloat(g.getAttribute('data-h'));
    resizeInfo = {handle: handle.getAttribute('data-handle'), startPointer: p, orig:{x,y,w,h}};
  }

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
    updateGroupVisuals(current);
  } else if(mode === 'resize' && resizeInfo){
    const info = resizeInfo;
    const dx = p.x - info.startPointer.x;
    const dy = p.y - info.startPointer.y;
    let {x,y,w,h} = info.orig;
    const handle = info.handle;

    if(handle === 'br'){ w = Math.max(20,w+dx); h = Math.max(20,h+dy); }
    else if(handle === 'tr'){ w = Math.max(20,w+dx); y += dy; h = Math.max(20,h-dy); }
    else if(handle === 'tl'){ x += dx; y += dy; w = Math.max(20,w-dx); h = Math.max(20,h-dy); }
    else if(handle === 'bl'){ x += dx; w = Math.max(20,w-dx); h = Math.max(20,h+dy); }

    current.setAttribute('data-x', x);
    current.setAttribute('data-y', y);
    current.setAttribute('data-w', w);
    current.setAttribute('data-h', h);
    updateGroupVisuals(current);
  } else if(mode === 'rotate' && rotateInfo){
    const {centerX,centerY,startAngle,startPointer} = rotateInfo;
    const angle = Math.atan2(p.y-centerY,p.x-centerX) - Math.atan2(startPointer.y-centerY,startPointer.x-centerX);
    current.setAttribute('data-rot', startAngle + angle*180/Math.PI);
    updateGroupVisuals(current);
  }
}

function onPointerUp(evt){
  mode = null;
  resizeInfo = null;
  rotateInfo = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  try{ if(evt.currentTarget) evt.currentTarget.releasePointerCapture?.(evt.pointerId); }catch(e){}
}


function updateGroupVisuals(g){
  const type = g.getAttribute('data-type');
  const x = parseFloat(g.getAttribute('data-x'));
  const y = parseFloat(g.getAttribute('data-y'));
  const w = parseFloat(g.getAttribute('data-w'));
  const h = parseFloat(g.getAttribute('data-h'));
  const rot = parseFloat(g.getAttribute('data-rot')) || 0;

  
  g.setAttribute('transform', `translate(${x},${y}) rotate(${rot} ${w/2} ${h/2})`);

  const shape = g.querySelector('.shape');
  if(!shape) return;

  if(type==='diamond'){
    shape.setAttribute('points', diamondPoints(w,h).map(p=>p.join(',')).join(' '));
  } else if(type==='square' || type==='round-rect'){
    shape.setAttribute('width', w);
    shape.setAttribute('height', h);
    if(type==='round-rect'){
      shape.setAttribute('rx', Math.min(w,h)*0.18);
      shape.setAttribute('ry', Math.min(w,h)*0.18);
    }
  } else if(type==='arrow'){
    
    shape.setAttribute('x1', 0);
    shape.setAttribute('y1', h/2);
    shape.setAttribute('x2', w);
    shape.setAttribute('y2', h/2);
  }

  const txt = g.querySelector('.shape-text');
  if(txt){
    txt.setAttribute('x', w/2);
    txt.setAttribute('y', h/2);
  }

  const sel = g.querySelector('.selection-rect');
  if(sel){
    sel.setAttribute('width', w+12);
    sel.setAttribute('height', h+12);
  }

  const hs = Array.from(g.querySelectorAll('.handle'));
  const coords = [[0,0],[w,0],[w,h],[0,h],[w/2,-20]];
  hs.forEach((hNode,i)=>{
    hNode.setAttribute('x', coords[i][0]-4);
    hNode.setAttribute('y', coords[i][1]-4);
  });
}


function groupDoubleClick(evt){
  evt.stopPropagation();
  const g = evt.currentTarget;
  const txt = g.querySelector('.shape-text') || {textContent:''};

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
    if(g.querySelector('.shape-text')) g.querySelector('.shape-text').textContent = input.value;
    document.body.removeChild(overlay);
  };
  box.appendChild(btn);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();

  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      if(g.querySelector('.shape-text')) g.querySelector('.shape-text').textContent = input.value;
      document.body.removeChild(overlay);
    } else if(e.key === 'Escape'){
      document.body.removeChild(overlay);
    }
  });

  overlay.addEventListener('click', e=>{
    if(e.target === overlay) document.body.removeChild(overlay);
  });
}


document.getElementById('add-square').addEventListener('click', ()=>{ const g = makeShapeGroup('square'); selectGroup(g); });
document.getElementById('add-round-rect').addEventListener('click', ()=>{ const g = makeShapeGroup('round-rect'); selectGroup(g); });
document.getElementById('add-diamond').addEventListener('click', ()=>{ const g = makeShapeGroup('diamond'); selectGroup(g); });
document.getElementById('add-arrow').addEventListener('click', ()=>{ const g = makeShapeGroup('arrow'); selectGroup(g); });


async function saveDiagram(){
  const groups = Array.from(svg.querySelectorAll('.shape-group')).map(g=>{
    return {
      type: g.getAttribute('data-type'),
      x: parseFloat(g.getAttribute('data-x')),
      y: parseFloat(g.getAttribute('data-y')),
      w: parseFloat(g.getAttribute('data-w')),
      h: parseFloat(g.getAttribute('data-h')),
      rot: parseFloat(g.getAttribute('data-rot')) || 0,
      text: g.querySelector('.shape-text') ? g.querySelector('.shape-text').textContent : ''
    };
  });

  try{
    const existing = await db.get('last-diagram').catch(()=>null);
    if(existing && existing._rev){
      await db.put({_id:'last-diagram', _rev: existing._rev, diagram: groups});
    } else {
      await db.put({_id:'last-diagram', diagram: groups});
    }
    alert('Diagrama guardado correctamente');
  }catch(err){
    console.error('Error guardando:', err);
    alert('Error guardando diagrama (revisa consola).');
  }
}

async function loadDiagram(){
  try{
    const doc = await db.get('last-diagram');
    
    Array.from(svg.querySelectorAll('.shape-group')).forEach(g=>g.remove());
    
    doc.diagram.forEach(d=>{
      const g = makeShapeGroup(d.type, parseFloat(d.x), parseFloat(d.y), parseFloat(d.w), parseFloat(d.h), d.text, parseFloat(d.rot)||0);
      
      updateGroupVisuals(g);
    });
    clearSelection();
  }catch(err){
    console.error('Error cargando:', err);
    alert('No hay diagrama guardado o ocurrió un error.');
  }
}

document.getElementById('save-diagram').addEventListener('click', saveDiagram);
document.getElementById('load-diagram').addEventListener('click', loadDiagram);


svg.addEventListener('pointerdown', evt=>{
  
  if(evt.target === svg) {
    clearSelection();
    return;
  }
  if(evt.target.tagName && evt.target.tagName.toLowerCase() === 'rect' && evt.target.parentNode === svg){
    
    clearSelection();
    return;
  }
});


document.addEventListener('keydown', (evt)=>{
  const active = document.activeElement;
  const activeTag = active ? active.tagName.toLowerCase() : null;
  if(activeTag === 'input' || activeTag === 'textarea') return; 
  if(evt.key === 'Delete' || evt.key === 'Del'){ 
    if(current){
      current.remove();
      current = null;
    }
  }
});


svg.setAttribute('tabindex', 0);
