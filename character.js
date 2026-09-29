/* ============================================================
   Dotkin — mascot system
   ------------------------------------------------------------
   One base character, four independent axes:

     identity (yours, persisted)      mood (app-driven, transient)
       palette      colour              expression   the face
       silhouette   body outline        effect       zzz / tears / sparks
       accessory    worn item

   Shell shapes and palettes are data. One shared display renderer
   keeps expression, cursor tracking and progress consistent.

   All art lives on one 100x100 viewBox so proportions, stroke
   weights and feature positions stay identical across the family.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- DATA ---------------- */

  // ink is the face colour: dark on light bodies, light on dark ones.
  var PALETTES = {
    amber:  { name: 'Amber',  base: '#f0a848', dark: '#c47a1c', ink: '#2a1c06' },
    violet: { name: 'Violet', base: '#9d8df1', dark: '#6d5bd0', ink: '#1e1636' },
    green:  { name: 'Green',  base: '#3fc98a', dark: '#1e8a5c', ink: '#06231a' },
    blue:   { name: 'Blue',   base: '#5aa9e6', dark: '#2f74ad', ink: '#07203a' },
    red:    { name: 'Red',    base: '#ef6a63', dark: '#a8322c', ink: '#340d0b' },
    pink:   { name: 'Pink',   base: '#f28ab6', dark: '#c25287', ink: '#3a1024' },
    orange: { name: 'Orange', base: '#f58757', dark: '#c1552a', ink: '#361307' },
    slate:  { name: 'Slate',  base: '#8b93a7', dark: '#565e73', ink: '#12161f' },
    ink:    { name: 'Ink',    base: '#3b4356', dark: '#20242f', ink: '#e6ebf4' }
  };

  // Soft, rounded bodies — one path each on the shared viewBox.
  // `top` is where headgear sits, `w` the half-width so accessories can fit.
  // Keys are kept stable so saved identities keep resolving.
  var SILHOUETTES = {
    // The house character: a little wider than tall with a settled, flat-ish
    // base, so it sits calmly rather than bouncing.
    deck: { name:'Dot', w:34, top:16,
      cap:{y:30,w:56}, d:'M50 16c19 0 33 12 33 30 0 11-4 19-12 24-6 4-13 5-21 5s-15-1-21-5c-8-5-12-13-12-24 0-18 14-30 33-30z' },
    blob: { name:'Bean', w:30, top:18,
      cap:{y:30,w:51}, d:'M50 16c18 0 30 13 30 31 0 19-12 32-30 32S20 66 20 47c0-18 12-31 30-31z' },
    cat:  { name:'Kit', w:29, top:18,
      cap:{y:32,w:49}, d:'M50 18c18 0 29 13 29 31 0 19-11 31-29 31S21 68 21 49c0-18 11-31 29-31z',
      ears:['M28 27 L31 10 L45 20 Z','M72 27 L69 10 L55 20 Z'] },
    horns:{ name:'Sprig', w:29, top:18,
      cap:{y:32,w:49}, d:'M50 18c18 0 29 13 29 31 0 19-11 31-29 31S21 68 21 49c0-18 11-31 29-31z',
      ears:['M31 25 C27 15 29 9 34 7 C35 14 38 19 41 22 Z','M69 25 C73 15 71 9 66 7 C65 14 62 19 59 22 Z'] },
    ghost:{ name:'Wisp', w:29, top:18,
      cap:{y:30,w:49}, d:'M50 16c17 0 29 13 29 31v29c-4 0-6-5-9.5-5S65 76 61 76s-5-5-8.5-5S48 76 44 76s-5-5-8.5-5S31 76 27 76h-6V47c0-18 12-31 29-31z' },
    robot:{ name:'Chip', w:30, top:20, box:{ l:19, r:81, t:18, rad:14 },
      cap:{y:32,w:62}, d:'M33 18h34a14 14 0 0 1 14 14v30a14 14 0 0 1-14 14H33a14 14 0 0 1-14-14V32a14 14 0 0 1 14-14z',
      antenna:true },
    sprout:{ name:'Seed', w:28, top:18,
      cap:{y:32,w:48}, d:'M50 18c17 0 28 12 28 30 0 19-11 31-28 31S22 67 22 48c0-18 11-30 28-30z',
      leaf:true },
    pebble:{ name:'Pip', w:29, top:20,
      cap:{y:33,w:50}, d:'M50 19c17 0 30 13 30 30s-13 31-30 31-30-14-30-31 13-30 30-30z' }
  };

  // An expression is a face, nothing more. It never touches colour.
  var EXPRESSIONS = {
    calm:      { eye: 'open',    mouth: 'small' },
    happy:     { eye: 'open',   mouth: 'smile' },
    laughing:  { eye: 'happy',   mouth: 'grin' },
    excited:   { eye: 'sparkle', mouth: 'grin',   effect: 'spark' },
    // Mid-block: eyes open and on you, mouth level. Concentrating, not dozing —
    // shut eyes here read as "the app stopped working".
    // A low, level brow is the whole difference from `calm`, the idle face.
    focused:   { eye: 'open',    mouth: 'flat',   brow: 'level' },
    // Past the planned time and still going — visibly pleased, not anxious.
    // Must not look like `focused`, or finishing a block reads as nothing happening.
    determined:{ eye: 'open',    mouth: 'grin' },
    // Lids down (∪). The ∩ arc is the laughing/shy eye and read as blissed out, not asleep.
    sleepy:    { eye: 'half',    mouth: 'sleep',  effect: 'zzz' },
    thinking:  { eye: 'up',      mouth: 'flat',   effect: 'dots' },
    confused:  { eye: 'open',    mouth: 'wobble', brow: 'quizzical' },
    angry:     { eye: 'squint',  mouth: 'frown',  brow: 'angled' },
    crying:    { eye: 'closed',  mouth: 'frown',  effect: 'tears' },
    shy:       { eye: 'happy',   mouth: 'small',  effect: 'blush' },
    worried:   { eye: 'wide',    mouth: 'wobble', brow: 'worried', effect: 'sweat' },
    // Held, not asleep and not idling: lids down, mouth level, pause bars up top.
    paused:    { eye: 'half',    mouth: 'flat',   effect: 'hold' },
    // Winding down after a finished block, on the way to sleep.
    yawn:      { eye: 'half',    mouth: 'ooh' },
    dead:      { eye: 'cross',   mouth: 'flat' },
    ooh:       { eye: 'wide',    mouth: 'ooh' },
    // Waiting on you: your usual start has passed. Wide eyes on you, one brow up,
    // a question floating off the shoulder. Asking, not scolding.
    expectant: { eye: 'wide',    mouth: 'small',  brow: 'quizzical', effect: 'ask' }
  };
  EXPRESSIONS.wink = { eye: 'wink', mouth: 'smile', effect: 'hearts' };
  EXPRESSIONS.blep = { eye: 'open', mouth: 'blep' };
  EXPRESSIONS.loved = { eye: 'wide', mouth: 'grin', effect: 'hearts' };

  // Keys are legacy and stay, so saved preferences keep resolving; names say what's drawn.
  var ACCESSORIES = {
    none:{name:'None'}, shades:{name:'Sunglasses'}, specs:{name:'Glasses'},
    cap:{name:'Cap'}, phones:{name:'Headphones'}, bolt:{name:'Bobble'}
  };

  // Your twenty, as one-liners over the axes above.
  var PRESETS = {
    sleepy:    { palette: 'violet', silhouette: 'blob',   expression: 'sleepy' },
    cheerful:  { palette: 'amber',  silhouette: 'blob',   expression: 'happy' },
    calm:      { palette: 'blue',   silhouette: 'pebble', expression: 'focused' },
    energetic: { palette: 'green',  silhouette: 'horns',  expression: 'excited' },
    angry:     { palette: 'red',    silhouette: 'horns',  expression: 'angry' },
    shy:       { palette: 'pink',   silhouette: 'cat',    expression: 'shy' },
    adventure: { palette: 'orange', silhouette: 'cat',    expression: 'laughing' },
    mystery:   { palette: 'ink',    silhouette: 'blob',   expression: 'calm',  accessory: 'shades' },
    ghost:     { palette: 'slate',  silhouette: 'ghost',  expression: 'ooh' },
    cool:      { palette: 'amber',  silhouette: 'blob',   expression: 'calm',  accessory: 'shades' },
    capped:    { palette: 'green',  silhouette: 'blob',   expression: 'happy', accessory: 'cap' },
    asleep:    { palette: 'violet', silhouette: 'pebble', expression: 'sleepy' },
    thinking:  { palette: 'blue',   silhouette: 'blob',   expression: 'thinking' },
    crying:    { palette: 'blue',   silhouette: 'blob',   expression: 'crying' },
    laughing:  { palette: 'amber',  silhouette: 'cat',    expression: 'laughing' },
    excited:   { palette: 'orange', silhouette: 'blob',   expression: 'excited' },
    nerd:      { palette: 'green',  silhouette: 'blob',   expression: 'calm',  accessory: 'specs' },
    dev:       { palette: 'slate',  silhouette: 'blob',   expression: 'focused', accessory: 'phones' },
    ai:        { palette: 'violet', silhouette: 'robot',  expression: 'thinking' },
    worried:   { palette: 'amber',  silhouette: 'blob',   expression: 'worried' }
  };

  /* ---------------- RENDER (do not edit to add characters) ---------------- */

  function cross(x, y, p) {
    return '<g stroke="' + p.ink + '" stroke-width="3.6" stroke-linecap="round">' +
      '<path d="M' + (x - 5) + ' ' + (y - 5) + ' L' + (x + 5) + ' ' + (y + 5) + '"/>' +
      '<path d="M' + (x + 5) + ' ' + (y - 5) + ' L' + (x - 5) + ' ' + (y + 5) + '"/></g>';
  }
  function star(x, y, p) {
    return '<path d="M' + x + ' ' + (y - 8) + ' L' + (x + 2.6) + ' ' + (y - 2.6) + ' L' + (x + 8) + ' ' + y +
      ' L' + (x + 2.6) + ' ' + (y + 2.6) + ' L' + x + ' ' + (y + 8) + ' L' + (x - 2.6) + ' ' + (y + 2.6) +
      ' L' + (x - 8) + ' ' + y + ' L' + (x - 2.6) + ' ' + (y - 2.6) + ' Z" fill="' + p.ink + '"/>';
  }

  var HALO = ' stroke="#0d1118" stroke-opacity=".6" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke"';
  // Tears and sweat: pale with a dark-blue edge, so they show on the blue body too.
  var DROP = ' fill="#bfe4ff" stroke="#2f74ad" stroke-width="1.2" stroke-linejoin="round"';
  function effect(kind, p) {
    if (kind === 'hearts')
      return '<g fill="#ff9bb5"><path d="M16 27 C4 19 10 12 16 18 C22 12 28 19 16 27Z"/>' +
        '<path d="M85 40 C76 34 80 28 85 32 C90 28 94 34 85 40Z"/></g>';
    // These float OUTSIDE the body, so they can't use the face ink — on a dark
    // desktop a dark z is invisible. Neutral light, legible on any backdrop.
    // The dark outline carries them on a light wallpaper, where the light fill vanishes.
    if (kind === 'zzz')
      return '<g fill="#c9d2e4"' + HALO + ' opacity=".85" font-family="system-ui" font-weight="700">' +
        '<text x="81" y="23" font-size="14">z</text><text x="90" y="12" font-size="10">z</text></g>';
    if (kind === 'hold')
      return '<g fill="#c9d2e4"' + HALO + ' opacity=".8">' +
        '<rect x="79" y="14" width="4.5" height="14" rx="2.2"/>' +
        '<rect x="87" y="14" width="4.5" height="14" rx="2.2"/></g>';
    if (kind === 'dots')
      return '<g fill="#c9d2e4"' + HALO + ' opacity=".75">' +
        '<circle cx="78" cy="24" r="3"/><circle cx="86" cy="18" r="2.2"/><circle cx="92" cy="13" r="1.6"/></g>';
    if (kind === 'tears')
      return '<g' + DROP + '><path d="M33 54 q-4 8 0 11 q4-3 0-11z"/><path d="M67 54 q-4 8 0 11 q4-3 0-11z"/></g>';
    if (kind === 'blush')
      // pink on a pink or red body vanishes; a lighter flush shows there instead
      return '<g fill="' + (p === PALETTES.pink || p === PALETTES.red ? '#ffe3ec' : '#ff8fae') + '" opacity=".5"><ellipse cx="26" cy="58" rx="7" ry="4.5"/>' +
        '<ellipse cx="74" cy="58" rx="7" ry="4.5"/></g>';
    if (kind === 'sweat')
      return '<path d="M76 30 q-5 9 0 12 q5-3 0-12z"' + DROP + '/>';
    if (kind === 'ask')
      return '<text x="79" y="27" font-family="system-ui" font-weight="700" font-size="19" fill="#c9d2e4"' + HALO + ' opacity=".85">?</text>';
    if (kind === 'spark')
      return '<g fill="#ffd479"><path d="M14 26 l2.4 5.2 5.2 2.4-5.2 2.4L14 41l-2.4-5.2L6.4 33.6l5.2-2.4z"/>' +
        '<path d="M84 62 l1.7 3.6 3.6 1.7-3.6 1.7L84 73l-1.7-3.6L78.7 68l3.6-1.7z"/></g>';
    return '';
  }

  function resolve(spec) {
    spec = spec || {};
    if (spec.preset && PRESETS[spec.preset]) spec = Object.assign({}, PRESETS[spec.preset], spec);
    return {
      p: PALETTES[spec.palette] || PALETTES.amber,
      s: SILHOUETTES[spec.silhouette] || SILHOUETTES.deck,
      e: EXPRESSIONS[spec.expression] || EXPRESSIONS.calm,
      a: ACCESSORIES[spec.accessory] || ACCESSORIES.none,
      size: spec.size || 96,
      id: 'c' + Math.random().toString(36).slice(2, 8)
    };
  }

  // The face only — swapped on expression change without rebuilding the body.
  // Two dark eyes and one simple mouth. Nothing else; that is the whole point.
  function faceSvg(r) {
    var e = r.e, ink = r.p.ink;

    function dot(x, y, ry) {
      return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (ry * 0.86).toFixed(1) + '" ry="' + ry +
        '" fill="' + ink + '"/>' +
        '<circle class="ch-eye-light" cx="' + x + '" cy="' + y + '" r="' + (ry * 0.28).toFixed(1) +
        '" fill="#fff" opacity=".95"/>';
    }
    function curve(d) {
      return '<path d="' + d + '" fill="none" stroke="' + ink +
        '" stroke-width="3.4" stroke-linecap="round"/>';
    }

    var eyes;
    if (e.eye === 'closed' || e.eye === 'happy')
      eyes = curve('M31 49 Q37.5 42 44 49') + curve('M56 49 Q62.5 42 69 49');
    else if (e.eye === 'half')
      eyes = curve('M31 44 Q37.5 51 44 44') + curve('M56 44 Q62.5 51 69 44');
    else if (e.eye === 'wink')
      eyes = dot(37, 47, 7) + curve('M56 49 Q62.5 42 69 49');
    else if (e.eye === 'squint')
      eyes = '<rect x="30" y="45" width="15" height="4" rx="2" fill="' + ink + '"/>' +
             '<rect x="55" y="45" width="15" height="4" rx="2" fill="' + ink + '"/>';
    else if (e.eye === 'cross')  eyes = cross(37, 47, r.p) + cross(63, 47, r.p);
    else if (e.eye === 'sparkle')eyes = star(37, 47, r.p) + star(63, 47, r.p);
    else if (e.eye === 'wide')   eyes = dot(37, 46, 8.6) + dot(63, 46, 8.6);
    else if (e.eye === 'up')     eyes = dot(37, 44, 7) + dot(63, 44, 7);
    else                         eyes = dot(37, 47, 7) + dot(63, 47, 7);

    var m = e.mouth, mouth;
    if (m === 'ooh')        mouth = '<ellipse cx="50" cy="62" rx="4.6" ry="6" fill="' + ink + '"/>';
    else if (m === 'sleep') mouth = '<ellipse cx="50" cy="62" rx="3.4" ry="4.2" fill="' + ink + '" opacity=".9"/>';
    else if (m === 'blep')  mouth = curve('M44 60 Q50 65 56 60') +
      '<path d="M47 62.5 q3 7.5 6 0z" fill="#ff9bb5"/>';
    else {
      var d = m === 'grin'   ? 'M42 59 Q50 69 58 59'
            : m === 'smile'  ? 'M43 60 Q50 66 57 60'
            : m === 'flat'   ? 'M45 62 L55 62'
            : m === 'frown'  ? 'M43 64 Q50 58 57 64'
            : m === 'wobble' ? 'M43 62 Q46.5 59 50 62 Q53.5 65 57 62'
            :                  'M46 61 Q50 64 54 61';
      mouth = curve(d);
    }
    return '<g class="ch-gaze"><g class="ch-eyes">' + eyes + '</g></g>' + brows(e.brow, r.p) + mouth;
  }

  function brows(kind, p) {
    if (!kind) return '';
    // Concentrating, not cross: short, light, barely dipping in. At full weight it read stern.
    if (kind === 'level')
      return '<g stroke="' + p.ink + '" stroke-width="2.6" stroke-linecap="round" opacity=".7">' +
        '<path d="M33 37.5 L43 38.3"/><path d="M67 37.5 L57 38.3"/></g>';
    var g = '<g stroke="' + p.ink + '" stroke-width="3" stroke-linecap="round" opacity=".85">';
    if (kind === 'angled')    g += '<path d="M30 36 L44 40"/><path d="M70 36 L56 40"/>';
    if (kind === 'worried')   g += '<path d="M31 39 L44 34"/><path d="M69 39 L56 34"/>';
    if (kind === 'quizzical') g += '<path d="M31 38 L44 34"/><path d="M56 37 L69 37"/>';
    return g + '</g>';
  }

  // Effects float outside the body, so they render ABOVE accessories —
  // a headphone band was painting straight over the zzz.
  function fxSvg(r) { return effect(r.e.effect, r.p); }

  // Worn items, sized from the silhouette so they fit narrow and wide bodies.
  function accessory(key, p, s, clipId) {
    var w = s.w || 30, top = s.top;
    if (key === 'shades')
      return '<g fill="#181c26"><rect x="27" y="40" width="19" height="12" rx="5.5"/>' +
        '<rect x="54" y="40" width="19" height="12" rx="5.5"/>' +
        '<path d="M46 44 L54 44" stroke="#181c26" stroke-width="2.6"/></g>' +
        '<path d="M30 43 L36 43" stroke="#fff" stroke-width="1.8" opacity=".45" stroke-linecap="round"/>';
    if (key === 'specs')
      return '<g fill="none" stroke="' + p.ink + '" stroke-width="1.9" opacity=".8">' +
        '<rect x="28" y="41" width="18" height="12" rx="6"/><rect x="54" y="41" width="18" height="12" rx="6"/>' +
        '<path d="M46 47 L54 47"/><path d="M28 45 L' + (50 - w + 2) + ' 43"/>' +
        '<path d="M72 45 L' + (50 + w - 2) + ' 43"/></g>';
    if (key === 'cap') {
      // The crown is CLIPPED TO THE HEAD, so it covers the skull exactly whatever
      // the outline is. A dome can never fit a squared head — its top corners
      // always poke out past the ellipse. Clipping removes the whole problem,
      // and any body added later fits automatically.
      var c = s.cap || { y: top + 14, w: w * 1.7 };
      var y = c.y, half = c.w / 2;
      var crown = '#2f3949', peak = '#242c3a';
      return '<g>' +
        '<g clip-path="url(#' + clipId + ')">' +
          '<rect x="0" y="0" width="100" height="' + y + '" fill="' + crown + '"/>' +
        '</g>' +
        // brim sits on the seam and overhangs a touch so there is no hairline gap
        '<path d="M' + (50 - half - 2) + ' ' + (y - 3) + ' h' + (half * 2 + 4) +
        ' a3.2 3.2 0 0 1 0 6 H' + (50 - half - 2) + ' a3.2 3.2 0 0 1 0-6 z" fill="' + peak + '"/>' +
        '<path d="M' + (50 + half * 0.3) + ' ' + (y - 3) + ' h' + (half * 0.95) +
        ' a5.5 5.5 0 0 1 0 6 H' + (50 + half * 0.3) + ' z" fill="' + peak + '"/>' +
        '</g>';
    }
    if (key === 'phones') {
      var bw, band;
      if (s.box) {
        // A square head pokes its corners through any arc, so the band traces
        // the head's own rounded-square outline, 3.5 units out.
        var b = s.box, o = 3.5, l = b.l - o, r = b.r + o, t = b.t - o, rad = b.rad + o;
        bw = 50 - l;
        band = 'M' + l + ' 50 V' + (t + rad) + ' A' + rad + ' ' + rad + ' 0 0 1 ' + (l + rad) + ' ' + t +
          ' H' + (r - rad) + ' A' + rad + ' ' + rad + ' 0 0 1 ' + r + ' ' + (t + rad) + ' V50';
      } else {
        // The band must clear the crown AND the widest point, or on a wide, tall
        // head (Dot) it floats above the skull and the cups hang off the sides.
        bw = Math.max(w, 50 - top) + 1.5;
        band = 'M' + (50 - bw) + ' 50 A' + bw + ' ' + bw + ' 0 0 1 ' + (50 + bw) + ' 50';
      }
      // Chip's antenna sits right where the band crosses; redraw its stem over the
      // band or the ball floats, cut off from the head.
      var stem = s.antenna ? '<path d="M50 ' + (s.top + 1) + ' L50 ' + (s.top - 11) + '" stroke="' + p.dark +
        '" stroke-width="3" stroke-linecap="round"/>' : '';
      return '<path d="' + band + '" fill="none" stroke="#2b3446" stroke-width="5.5" stroke-linecap="round"/>' + stem +
        '<rect x="' + (50 - bw - 6) + '" y="45" width="12" height="19" rx="6" fill="#2b3446"/>' +
        '<rect x="' + (50 + bw - 6) + '" y="45" width="12" height="19" rx="6" fill="#2b3446"/>';
    }
    if (key === 'bolt') {
      // Chip already has a centre antenna and Seed a centre sprout; the module
      // mounts off to the left there, leaning out, so the two never overlap.
      if (s.antenna || s.leaf)
        return '<path d="M38 ' + (top + 5) + ' L31 ' + (top - 9) + '" stroke="' + p.dark +
          '" stroke-width="3.2" stroke-linecap="round"/>' +
          '<circle cx="29" cy="' + (top - 14) + '" r="5.2" fill="' + p.base + '" stroke="' + p.dark + '" stroke-width="2"/>';
      return '<path d="M50 ' + (top + 4) + ' L50 ' + (top - 12) + '" stroke="' + p.dark +
        '" stroke-width="3.4" stroke-linecap="round"/>' +
        '<circle cx="50" cy="' + (top - 17) + '" r="6" fill="' + p.base + '" stroke="' + p.dark + '" stroke-width="2"/>';
    }
    return '';
  }

  function svg(spec) {
    var r = resolve(spec), p = r.p, s = r.s;
    var pname = Object.keys(PALETTES).find(function (k) { return PALETTES[k] === p; });
    var sname = Object.keys(SILHOUETTES).find(function (k) { return SILHOUETTES[k] === s; });
    var aname = Object.keys(ACCESSORIES).find(function (k) { return ACCESSORIES[k] === r.a; }) || 'none';
    var expression = Object.keys(EXPRESSIONS).find(function (k) { return EXPRESSIONS[k] === r.e; });
    var g = 'shell' + r.id;

    var ears = (s.ears || []).map(function (d) {
      return '<path d="' + d + '" fill="' + p.dark + '"/>';
    }).join('');
    var antenna = s.antenna
      ? '<path d="M50 ' + s.top + ' L50 ' + (s.top - 11) + '" stroke="' + p.dark +
        '" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="' + (s.top - 15) +
        '" r="4.5" fill="' + p.base + '"/>' : '';
    var leaf = s.leaf
      ? '<path d="M50 ' + s.top + ' L50 ' + (s.top - 12) + '" stroke="#3fc98a" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M50 ' + (s.top - 10) + ' q11 -5 13 -12 q-11 -1 -13 12z" fill="#3fc98a"/>' : '';

    return '<svg class="ch" viewBox="0 0 100 100" width="' + r.size + '" height="' + r.size +
      '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + expression + ' companion"' +
      ' data-expression="' + expression + '" data-palette="' + pname + '" data-silhouette="' + sname + '">' +
      '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0.35" y2="1">' +
      '<stop stop-color="' + p.base + '"/><stop offset="1" stop-color="' + p.dark + '"/></linearGradient>' +
      '<clipPath id="clip' + r.id + '"><path d="' + s.d + '"/></clipPath></defs>' +
      '<g class="ch-art" transform="translate(50 52) scale(1.2) translate(-50 -52)">' +
      // thin progress ring; the track is barely there until a block is running
      '<g class="ch-orbit" fill="none" stroke="' + p.base + '">' +
      '<circle cx="50" cy="49" r="44" stroke-width="1.4" opacity=".12"/>' +
      '<circle class="ch-progress" cx="50" cy="49" r="44" pathLength="100" stroke-dasharray="0 100"' +
      ' stroke-width="2.4" stroke-linecap="round" opacity="0" transform="rotate(-90 50 49)"/></g>' +
      '<g class="ch-attention"><g class="ch-creature">' +
      ears + antenna + leaf +
      '<path class="ch-body" d="' + s.d + '" fill="url(#' + g + ')"/>' +
      '<g class="ch-face">' + faceSvg(r) + '</g>' +
      '<g class="ch-acc">' + accessory(aname, p, s, 'clip' + r.id) + '</g>' +
      '</g></g><g class="ch-fx">' + fxSvg(r) + '</g></g></svg>';
  }

  // Swap mood without disturbing identity or restarting animations.
  function setExpression(el, expression) {
    if (!el) return;
    var svgEl = el.tagName === 'svg' ? el : el.querySelector('svg.ch');
    var face = svgEl && svgEl.querySelector('.ch-face');
    if (!face) return;
    expression = EXPRESSIONS[expression] ? expression : 'calm';
    if (svgEl.getAttribute('data-expression') === expression) return;
    svgEl.setAttribute('data-expression', expression);
    svgEl.setAttribute('aria-label', 'DOT ' + expression + ' focus companion');
    var p = PALETTES[svgEl.getAttribute('data-palette')] || PALETTES.amber;
    var sil = SILHOUETTES[svgEl.getAttribute('data-silhouette')] || null;
    var r = { p: p, s: sil, e: EXPRESSIONS[expression] || EXPRESSIONS.calm };
    face.innerHTML = faceSvg(r);
    var fx = svgEl.querySelector('.ch-fx');
    if (fx) fx.innerHTML = fxSvg(r);
    // A quick pop sells the change; a bare swap looked like a glitch. One-shot, so no idle cost.
    if (face.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches))
      face.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1.04)', offset: .6 }, { transform: 'scale(1)' }],
        { duration: 180, easing: 'ease-out' });
  }

  // Both windows speak from the same timer facts. No invented productivity scores.
  function context(timer, now) {
    timer = timer || {}; now = now == null ? Date.now() : now;
    if (!timer.taskId || !timer.startedAt || !timer.plannedMin)
      // Nothing running = awake and waiting. A companion that sleeps whenever
      // you aren't in a block looks broken for most of the day.
      return { mode:'idle', mood:'calm', progress:0, message:'Nothing running. Pick one thing and I’ll keep the time.' };
    var elapsed = Math.max(0, (timer.pausedAt || now) - timer.startedAt);
    var progress = Math.min(1, elapsed / (timer.plannedMin * 60000));
    var left = Math.max(0, Math.ceil(timer.plannedMin - elapsed / 60000));
    if (timer.pausedAt) return { mode:'held', mood:'paused', progress:progress, message:'Paused with '+left+' min left. I’m keeping your place.' };
    if (progress >= 1) return { mode:'over', mood:'determined', progress:1, message:'Your '+timer.plannedMin+' min block is complete. Log it when you’re ready.' };
    return { mode:'focus', mood:'focused', progress:progress, message:progress < .12 ? 'Settling in. I’ll keep an eye on the time.' : progress < .5 ? left+' min left. Just this one task.' : progress < .85 ? 'Past halfway. '+left+' min left — keep your thread.' : 'Home stretch: '+left+' min left. Almost a full orbit.' };
  }
  function setProgress(el, progress) {
    if (!el) return;
    var svgEl = el.matches('svg.ch') ? el : el.querySelector('svg.ch');
    if (!svgEl) return;
    var value = Math.max(0, Math.min(1, Number(progress) || 0));
    svgEl.style.setProperty('--focus-progress', value);
    var ring = svgEl.querySelector('.ch-progress');
    if (ring) {
      ring.setAttribute('stroke-dasharray', (value * 100).toFixed(2) + ' 100');
      ring.setAttribute('opacity', value > 0 ? '1' : '0');   // else the round cap shows as a dot
    }
  }
  // Pausing is a rest, not a nap. Eyes stay open at first, droop after a couple of
  // minutes, and close after ten. Both the app's DOT and the desktop pet use this.
  function pausedMood(pausedMs) {
    return pausedMs >= 10 * 60000 ? 'sleepy' : pausedMs >= 2 * 60000 ? 'paused' : 'calm';
  }
  // Which expressions have the lids down: no eye tracking then, whatever the state is called.
  function eyesRest(expression) {
    var e = EXPRESSIONS[expression];
    return !!e && (e.eye === 'closed' || e.eye === 'half' || e.eye === 'happy');   // 'happy' is drawn as closed arcs
  }
  function lookAt(el, x, y) {
    if (!el || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var svgEl = el.matches('svg.ch') ? el : el.querySelector('svg.ch');
    if (!svgEl) return;
    // Lids down means no gaze — closed or half-shut eyes sliding around read as wrong.
    if (eyesRest(svgEl.getAttribute('data-expression'))) {
      var gz = svgEl.querySelector('.ch-gaze'), at = svgEl.querySelector('.ch-attention');
      if (gz) gz.style.transform = '';
      if (at) at.style.transform = '';
      lights(svgEl, 0, 0);
      return;
    }
    var rect = svgEl.getBoundingClientRect();
    var dx = x == null ? 0 : Math.max(-1,Math.min(1,(x-rect.left-rect.width/2)/120));
    var dy = y == null ? 0 : Math.max(-1,Math.min(1,(y-rect.top-rect.height/2)/120));
    svgEl.querySelector('.ch-gaze').style.transform = 'translate('+(dx*3)+'px,'+(dy*2.5)+'px)';
    svgEl.querySelector('.ch-attention').style.transform = 'rotate('+(dx*4)+'deg)';
    lights(svgEl, dx, dy);
  }
  // The glint rests at the pupil centre and slides further along the gaze than the
  // pupil does, so it reads as the gaze. Travel (2.5, 3.5) + r 2 stays inside rx 6 / ry 7.
  function lights(svgEl, dx, dy) {
    var ls = svgEl.querySelectorAll('.ch-eye-light');
    for (var i = 0; i < ls.length; i++)
      ls[i].style.transform = 'translate(' + (dx * 2.5) + 'px,' + (dy * 3.5) + 'px)';
  }

  // One quick blink every 4-9 seconds, by class swap: cheap between blinks,
  // where an infinite CSS animation repainted every frame.
  if (typeof document !== 'undefined') (function blinkLoop() {
    setTimeout(function () {
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.hidden && !still) {
        document.querySelectorAll('.pet svg.ch, .companion-pet svg.ch').forEach(function (el) {
          if (eyesRest(el.getAttribute('data-expression'))) return;   // squashing a shut arc reads as a twitch
          el.classList.add('ch-blinking');
          setTimeout(function () { el.classList.remove('ch-blinking'); }, 260);
        });
      }
      blinkLoop();
    }, 4000 + Math.random() * 5000);
  })();

  window.Character = {
    svg: svg,
    context: context,
    setProgress: setProgress,
    lookAt: lookAt,
    pausedMood: pausedMood,
    eyesRest: eyesRest,
    setExpression: setExpression,
    PALETTES: PALETTES,
    SILHOUETTES: SILHOUETTES,
    EXPRESSIONS: EXPRESSIONS,
    ACCESSORIES: ACCESSORIES,
    PRESETS: PRESETS
  };
})();
