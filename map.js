// The app's Map tab, live on the page. Everything between the two COPY lines is
// src/index.html's map code (renderMap and friends) with two changes: clicking an
// open task moves the running block to it, and the hint line under the map is gone.
// The data is the demo profile from tests/site-shots-preload.js. Nothing is saved.
(function () {
var host = document.getElementById('live-map');
if (!host || !window.DOMPoint) return;
// a full-width map that captures touch would trap the page's scroll on a phone
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) return;

var S = {"projects":[{"id":"p1","name":"Thesis","color":"#9d8df1","sections":[{"id":"s1","title":"Writing","tasks":[{"id":"methods","text":"Draft the methods section","sec":14280},{"id":"abstract","text":"Rewrite the abstract","sec":3000},{"id":"intro","text":"Tighten the chapter 2 intro","sec":1500,"done":true}]},{"id":"s2","title":"Research","tasks":[{"id":"survey","text":"Clean the survey data","sec":7980},{"id":"papers","text":"Read two papers on sampling bias","sec":3840},{"id":"regress","text":"Rerun the regression with controls","sec":2700}]},{"id":"s3","title":"Admin","tasks":[{"id":"outline","text":"Email supervisor the outline","sec":1320,"done":true},{"id":"ethics","text":"Book the ethics review slot","sec":0}]}]},{"id":"p2","name":"Client site","color":"#3fc98a","sections":[{"id":"s4","title":"Build","tasks":[{"id":"payment","text":"Payment integration","sec":9300},{"id":"login","text":"Fix the login bug","sec":2700,"done":true},{"id":"docs","text":"Write the docs","sec":1500}]},{"id":"s5","title":"Launch","tasks":[{"id":"qa","text":"QA on mobile","sec":1200},{"id":"analytics","text":"Set up analytics","sec":0},{"id":"email","text":"Draft the launch email","sec":0}]}]},{"id":"p3","name":"Portfolio","color":"#5aa9e6","sections":[{"id":"s6","title":"Tasks","tasks":[{"id":"six","text":"Pick six projects to show","sec":1500},{"id":"about","text":"Write the about page","sec":540},{"id":"video","text":"Record a walkthrough video","sec":0}]}]}],"daily":{"id":"daily","title":"Generic todos","tasks":[{"id":"gym","text":"Gym","sec":0},{"id":"cook","text":"Cook dinner","sec":0},{"id":"read","text":"Read 20 pages","sec":0},{"id":"inbox0","text":"Clear the inbox","sec":0}]},"timer":{"taskId":"methods"},"mapPins":{}};
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML.replace(/"/g,"&quot;");}
function dur(sec){sec=Math.max(0,Math.round(sec));var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);if(h)return h+"h "+m+"m";if(m)return m+"m";return sec+"s";}
function save() {}
function startNow(id) { S.timer.taskId = id; render(); }
function render() { host.innerHTML = renderMap(); wireMap(host.querySelector('svg.map')); }

// ---- COPY from src/index.html ----
/* ============ MAP — projects, sections and tasks as one picture ============ */
// A tidy tree, not a physics graph: every node has one obvious place, so the
// picture is the same each time you open it. Circle area follows focused time.
function mapR(sec){return Math.min(16,4+Math.sqrt((sec||0)/60)*1.2);}
// A small force graph: every node pushes the others away, every link is a spring,
// and a soft pull keeps the lot on screen. The simulation outlives render(), which
// rebuilds the DOM constantly — positions live in mapSim, the DOM is only a view of it.
// ponytail: all-pairs repulsion is O(n²). Fine to a few hundred tasks; a quadtree is the upgrade.
var MAP_W=900,MAP_H=640,MAP_LEN={proj:170,sec:100,task:74},MAP_RAD={root:0,proj:170,sec:265,task:335};
var mapView={x:0,y:0,k:1},mapDrag=false,mapTouched=false,mapShut={},mapLoop=0;
var mapSim={nodes:{},list:[],links:[],alpha:0,held:null,els:{},lines:[]};
function mapTransform(){return 'translate('+mapView.x.toFixed(1)+' '+mapView.y.toFixed(1)+') scale('+mapView.k.toFixed(3)+')';}
function mapApplyView(svg){
  svg.querySelector('.map-view').setAttribute('transform',mapTransform());
  if(mapView.k<.7)svg.setAttribute('data-far','1');else svg.removeAttribute('data-far');   // labels are noise from far away
}
function mapGraph(){
  var nodes=[],links=[],grand=0,nTasks=0;
  function node(id,kind,parent,r,color,label,sub,extra){
    var n={id:id,kind:kind,parent:parent,r:r,color:color,label:label,sub:sub||''};
    for(var k in extra||{})n[k]=extra[k];
    nodes.push(n);if(parent)links.push([parent,id]);
  }
  var groups=S.projects.map(function(p){return {id:p.id,name:p.name,color:p.color,secs:p.sections};});
  groups.unshift({id:S.daily.id,name:S.daily.title,color:'#f0a848',secs:[{id:null,tasks:S.daily.tasks}]});
  // Each project owns a slice of the circle, sized by how much it holds, so branches
  // start apart and stay apart. Folding does not change the slices: nothing jumps.
  var leaves=0,a0=Math.PI;
  groups.forEach(function(g){g.leaves=g.secs.reduce(function(n,sec){return n+Math.max(1,sec.tasks.length);},0);leaves+=g.leaves;});
  groups.forEach(function(g){
    var span=Math.PI*2*g.leaves/leaves,s0=a0;
    g.ang=a0+span/2;
    g.secs.forEach(function(sec){var ss=span*Math.max(1,sec.tasks.length)/g.leaves;sec.ang=s0+ss/2;sec.from=s0;sec.span=ss;s0+=ss;});
    a0+=span;
  });
  node('root','root',null,14,'#f0a848','◎','',{ang:0});
  groups.forEach(function(g){
    var gid='p:'+g.id,total=0,count=0;
    g.secs.forEach(function(sec){sec.tasks.forEach(function(t){total+=t.sec||0;count++;});});
    grand+=total;nTasks+=count;
    node(gid,'proj','root',mapR(total)+4,g.color,g.name,total>0?dur(total):'',{shut:!!mapShut[gid],count:count,ang:g.ang});
    if(mapShut[gid])return;
    g.secs.forEach(function(sec){
      var pid=gid;
      if(sec.id!==null){
        var sid='s:'+sec.id,st=sec.tasks.reduce(function(n,t){return n+(t.sec||0);},0);
        node(sid,'sec',gid,mapR(st)*.8+2,g.color,sec.title,'',{shut:!!mapShut[sid],count:sec.tasks.length,ang:sec.ang});
        if(mapShut[sid])return;
        pid=sid;
      }
      sec.tasks.forEach(function(t,i){
        node(t.id,'task',pid,mapR(t.sec),g.color,t.text,t.sec>0?dur(t.sec):'',{done:t.done,live:S.timer.taskId===t.id,can:!t.done&&S.timer.taskId!==t.id,
          ang:sec.from+sec.span*(i+.5)/sec.tasks.length,near:sec.id===null});
      });
    });
  });
  return {nodes:nodes,links:links,grand:grand,nTasks:nTasks,nGroups:groups.length};
}
// Carry positions over from the last frame; anything new is born beside its parent
// and lets the physics throw it outward.
function mapSync(g){
  var old=mapSim.nodes,next={},changed=Object.keys(old).length!==g.nodes.length;
  g.nodes.forEach(function(n,i){
    var o=old[n.id],p=next[n.parent];
    if(o){n.x=o.x;n.y=o.y;n.vx=o.vx;n.vy=o.vy;}
    else{
      changed=true;
      // Unfolding: born beside the parent. First open: a tight knot at the centre that bursts outward.
      var from=old[n.parent]?[p.x,p.y,18]:[MAP_W/2,MAP_H/2,MAP_RAD[n.kind]*.22];
      n.x=from[0]+Math.cos(n.ang)*from[2];n.y=from[1]+Math.sin(n.ang)*from[2];n.vx=n.vy=0;
    }
    var pin=S.mapPins[n.id];
    n.fx=pin?pin[0]:null;n.fy=pin?pin[1]:null;
    if(pin){n.x=pin[0];n.y=pin[1];}
    next[n.id]=n;
  });
  mapSim.nodes=next;mapSim.list=g.nodes;
  mapSim.links=g.links.map(function(l){return {a:next[l[0]],b:next[l[1]]};});
  if(changed)mapSim.alpha=1;
}
function mapTick(){
  var ns=mapSim.list,al=mapSim.alpha,i,j,p,q,dx,dy,d2,d,f;
  for(i=0;i<ns.length;i++)for(j=i+1;j<ns.length;j++){
    p=ns[i];q=ns[j];dx=q.x-p.x;dy=q.y-p.y;d2=dx*dx+dy*dy;
    if(d2<1){dx=(i%2?1:-1);dy=(j%2?1:-1);d2=2;}
    d=Math.sqrt(d2);f=Math.min(7,(2400+(p.r+q.r)*40)/d2)*al;
    dx=dx/d*f;dy=dy/d*f*1.25;                      // push harder vertically: labels are wide, not tall
    p.vx-=dx;p.vy-=dy;q.vx+=dx;q.vy+=dy;
  }
  mapSim.links.forEach(function(l){
    var a=l.a,b=l.b,L=(b.kind==='task'&&a.kind==='proj')?120:MAP_LEN[b.kind];
    dx=b.x-a.x;dy=b.y-a.y;d=Math.sqrt(dx*dx+dy*dy)||1;f=(d-L)*.07*al;
    dx=dx/d*f;dy=dy/d*f;a.vx+=dx;a.vy+=dy;b.vx-=dx;b.vy-=dy;
  });
  ns.forEach(function(n){
    // A faint pull toward the node's own spot on its slice (an ellipse: the canvas is wide).
    var R=n.near?MAP_RAD.sec+20:MAP_RAD[n.kind];
    n.vx+=(MAP_W/2+Math.cos(n.ang)*R*1.2-n.x)*.012*al;n.vy+=(MAP_H/2+Math.sin(n.ang)*R*.82-n.y)*.012*al;
    n.vx*=.78;n.vy*=.78;
    if(n.fx!==null){n.x=n.fx;n.y=n.fy;n.vx=n.vy=0;}else{n.x+=n.vx;n.y+=n.vy;}
  });
  mapSim.alpha*=.988;
}
// Until you touch the camera it keeps the whole graph in frame. After that it is yours.
function mapFit(svg,ease){
  if(mapTouched||!mapSim.list.length)return;
  var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  mapSim.list.forEach(function(n){x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y);});
  var k=Math.max(.4,Math.min(1.4,Math.min(MAP_W/(x1-x0+330),MAP_H/(y1-y0+90))));
  var tx=MAP_W/2-(x0+x1)/2*k,ty=MAP_H/2-(y0+y1)/2*k;
  mapView.k+=(k-mapView.k)*ease;mapView.x+=(tx-mapView.x)*ease;mapView.y+=(ty-mapView.y)*ease;
  mapApplyView(svg);
}
function mapDraw(){
  mapSim.list.forEach(function(n){
    var el=mapSim.els[n.id];if(!el)return;
    el.g.setAttribute('transform','translate('+n.x.toFixed(1)+' '+n.y.toFixed(1)+')');
    if(n.kind==='task'&&el.t){                    // a label hangs off the side away from its parent
      var left=n.x<mapSim.nodes[n.parent].x;
      el.t.setAttribute('x',left?-(n.r+7):n.r+7);el.t.setAttribute('text-anchor',left?'end':'start');
    }
  });
  mapSim.lines.forEach(function(L){
    L.el.setAttribute('x1',L.a.x.toFixed(1));L.el.setAttribute('y1',L.a.y.toFixed(1));
    L.el.setAttribute('x2',L.b.x.toFixed(1));L.el.setAttribute('y2',L.b.y.toFixed(1));
  });
}
function mapRun(svg){
  var id=++mapLoop;
  // No animation wanted, or nobody watching: jump straight to the settled layout.
  if(document.hidden||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    var n=0;while(mapSim.alpha>.02&&n++<700)mapTick();
    if(!mapSim.held)mapSim.alpha=0;
    mapFit(svg,1);mapDraw();svg.setAttribute('data-settled','1');return;
  }
  (function frame(){
    if(id!==mapLoop||!svg.isConnected)return;
    if(mapSim.alpha>.02||mapSim.held){
      if(mapSim.held)mapSim.alpha=Math.max(mapSim.alpha,.35);
      mapTick();if(!mapSim.held)mapFit(svg,.1);mapDraw();
      svg.removeAttribute('data-settled');requestAnimationFrame(frame);
    }else svg.setAttribute('data-settled','1');
  })();
}
function renderMap(){
  var g=mapGraph();mapSync(g);
  var label=function(txt,n){return txt.length>n?txt.slice(0,n-1)+'…':txt;};
  var onPath={};                                   // the chain from the running task back to the centre
  g.nodes.forEach(function(n){if(n.live)for(var c=n;c;c=mapSim.nodes[c.parent])onPath[c.id]=1;});
  var links=g.links.map(function(l){return '<line data-l="'+l[0]+'|'+l[1]+'" stroke="'+mapSim.nodes[l[1]].color+'"'+(onPath[l[1]]?' class="flow"':'')+'/>';}).join('');
  var nodes=g.nodes.map(function(n){
    var hubby=n.kind!=='task',tip=n.kind==='task'?esc(n.label)+(n.sub?' — '+n.sub:'')+(n.can?' · click to start a block':''):n.kind==='root'?'Click to re-centre':esc(n.label)+' · click to '+(n.shut?'unfold':'fold');
    return '<g class="map-node '+(hubby?'map-hub':'map-task')+(n.done?' done':'')+(n.live?' live':'')+(n.shut?' shut':'')+(S.mapPins[n.id]?' pinned':'')+'" data-n="'+n.id+'" data-k="'+n.kind+'"'+
      (n.can?' data-start="'+n.id+'"':'')+' style="color:'+n.color+'" transform="translate('+n.x.toFixed(1)+' '+n.y.toFixed(1)+')">'+
      '<title>'+tip+'</title><circle class="map-halo" r="'+(n.r+7).toFixed(1)+'"/><circle class="map-core" r="'+n.r.toFixed(1)+'"/>'+
      (n.kind==='root'?'<text y="4" text-anchor="middle" class="map-root">◎</text>'
        :hubby?'<text y="'+(-n.r-8).toFixed(1)+'" text-anchor="middle">'+esc(label(n.label,22))+' <tspan class="map-dim">'+(n.shut?'+'+n.count:n.sub)+'</tspan></text>'
        :'<text y="4" x="'+(n.r+7)+'">'+esc(label(n.label,30))+(n.sub?' <tspan class="map-dim">'+n.sub+'</tspan>':'')+'</text>')+'</g>';
  }).join('');
  var changed=mapTouched||Object.keys(S.mapPins).length||Object.keys(mapShut).length;
  return '<div class="day-hd"><span>Your map</span><span class="day-tot">'+dur(g.grand)+' focused · '+g.nTasks+' task'+(g.nTasks===1?'':'s')+'</span></div>'+
    '<div class="card map-wrap">'+
      '<div class="map-tools"><button class="blk" data-a="map-out" aria-label="Zoom out">−</button><button class="blk" data-a="map-in" aria-label="Zoom in">+</button>'+
        (changed?'<button class="blk" data-a="map-reset">Reset layout</button>':'')+'</div>'+
      '<svg class="map" viewBox="0 0 '+MAP_W+' '+MAP_H+'" role="img" aria-label="Map of '+g.nGroups+' projects and '+g.nTasks+' tasks, sized by focused time">'+
      '<defs><pattern id="mapdots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.2" class="map-dot"/></pattern></defs>'+
      '<g class="map-view" transform="'+mapTransform()+'"><rect x="-6000" y="-6000" width="12900" height="12640" fill="url(#mapdots)"/>'+
      '<g class="map-links">'+links+'</g>'+nodes+'</g></svg></div>';
}
function mapZoom(svg,f,cx,cy){
  var k=Math.max(.35,Math.min(3,mapView.k*f));f=k/mapView.k;mapTouched=true;
  mapView.x=cx-(cx-mapView.x)*f;mapView.y=cy-(cy-mapView.y)*f;mapView.k=k;   // keep the point under the cursor still
  mapApplyView(svg);
}
function mapHover(svg,id){
  svg.classList.toggle('focus',!!id);
  svg.querySelectorAll('.hl').forEach(function(el){el.classList.remove('hl');});
  if(!id)return;
  var set={},c;
  for(c=mapSim.nodes[id];c;c=mapSim.nodes[c.parent])set[c.id]=1;                       // up to the centre
  mapSim.list.forEach(function(n){for(c=n;c;c=mapSim.nodes[c.parent])if(c.id===id){set[n.id]=1;break;}});  // and everything beneath
  Object.keys(set).forEach(function(k){if(mapSim.els[k])mapSim.els[k].g.classList.add('hl');});
  mapSim.lines.forEach(function(L){if(set[L.a.id]&&set[L.b.id])L.el.classList.add('hl');});
}
function wireMap(svg){
  var drag=null;
  mapSim.els={};
  svg.querySelectorAll('[data-n]').forEach(function(g){mapSim.els[g.getAttribute('data-n')]={g:g,t:g.querySelector('text')};});
  mapSim.lines=Array.from(svg.querySelectorAll('.map-links line')).map(function(el){
    var ab=el.getAttribute('data-l').split('|');return {el:el,a:mapSim.nodes[ab[0]],b:mapSim.nodes[ab[1]]};
  });
  mapApplyView(svg);mapDraw();mapRun(svg);
  function pt(e){var p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [p.x,p.y];}
  svg.addEventListener('pointerdown',function(e){
    if(e.button)return;
    var g=e.target.closest('[data-n]'),n=g?mapSim.nodes[g.getAttribute('data-n')]:null;
    drag={n:n,start:pt(e),moved:false,base:n?[n.x,n.y]:[mapView.x,mapView.y]};
    mapDrag=true;
    try{svg.setPointerCapture(e.pointerId);}catch(_){}
  });
  svg.addEventListener('pointermove',function(e){
    if(!drag)return;
    var p=pt(e),dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<4)return;      // a click that wobbled is still a click
    if(!drag.moved){drag.moved=true;mapTouched=true;mapHover(svg,drag.n?drag.n.id:null);svg.classList.add('dragging');}
    if(drag.n){
      var n=drag.n,was=mapSim.held;
      n.fx=n.x=drag.base[0]+dx/mapView.k;n.fy=n.y=drag.base[1]+dy/mapView.k;
      mapSim.held=n;mapSim.alpha=Math.max(mapSim.alpha,.5);
      if(!was||svg.hasAttribute('data-settled'))mapRun(svg);   // wake the loop if it had gone to sleep
    }else{mapView.x=drag.base[0]+dx;mapView.y=drag.base[1]+dy;mapApplyView(svg);}
  });
  function end(){
    if(!drag)return;
    var d=drag,n=d.n;drag=null;mapDrag=false;mapSim.held=null;svg.classList.remove('dragging');
    if(d.moved){
      if(n){S.mapPins[n.id]=[n.x,n.y];mapSim.alpha=Math.max(mapSim.alpha,.4);save();}   // dropped is pinned
      render();return;
    }
    if(!n)return;
    if(n.kind==='task'){if(n.can)startNow(n.id);return;}
    if(n.kind==='root'){mapTouched=false;mapSim.alpha=Math.max(mapSim.alpha,.1);render();return;}
    if(mapShut[n.id])delete mapShut[n.id];else mapShut[n.id]=1;
    render();
  }
  svg.addEventListener('pointerup',end);
  svg.addEventListener('pointercancel',end);
  svg.addEventListener('pointerover',function(e){if(drag&&drag.moved)return;var g=e.target.closest('[data-n]');mapHover(svg,g?g.getAttribute('data-n'):null);});
  svg.addEventListener('pointerleave',function(){if(!(drag&&drag.moved))mapHover(svg,null);});
  // Plain scroll still scrolls the page; a trackpad pinch arrives as Ctrl+wheel.
  svg.addEventListener('wheel',function(e){
    if(!e.ctrlKey&&!e.metaKey)return;
    e.preventDefault();var p=pt(e);mapZoom(svg,Math.exp(-e.deltaY*.01),p[0],p[1]);
  },{passive:false});
}
// ---- end COPY ----

host.addEventListener('click', function (e) {
  var a = e.target.closest('[data-a]'); if (!a) return;
  a = a.getAttribute('data-a');
  if (a === 'map-in' || a === 'map-out') { mapZoom(host.querySelector('svg.map'), a === 'map-in' ? 1.25 : .8, MAP_W / 2, MAP_H / 2); render(); }
  if (a === 'map-reset') { S.mapPins = {}; mapShut = {}; mapView = { x: 0, y: 0, k: 1 }; mapTouched = false; mapSim.nodes = {}; render(); }
});
// Start when it scrolls into view, so the opening burst is seen.
if (!window.IntersectionObserver) return render();
var io = new IntersectionObserver(function (en) {
  if (!en[0].isIntersecting) return;
  io.disconnect(); render();
}, { threshold: .25 });
io.observe(host);
})();
