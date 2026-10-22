// LAKUS – prototyp: wodomierz w bohaterze, menu, wideo, formularz, pasek „zadzwoń”.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- wodomierz ---------- */
  // Jeden stan – objętość w litrach – wyznacza bębenki, wskazówki i gwiazdkę, więc odczyt zawsze się zgadza.
  const fig = document.getElementById('meter');
  const svg = fig.querySelector('svg.meter');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const PITCH = 46;          // wysokość cyfry na taśmie bębenka
  const V0 = 473821.35;      // odczyt w HTML: 00473,821 m³
  const MODES = {
    flow: { rate: 1 / 1.8, spin: 540 },   // litry na sekundę, stopnie gwiazdki na sekundę
    closed: { rate: 1 / 90, spin: 120 },  // mały wyciek: liczniki prawie stoją, gwiazdka się kręci
  };

  // bębenek to taśma 0–9 i jeszcze raz 0, żeby 9 płynnie przechodziło w 0
  const strips = [...svg.querySelectorAll('#drums .cell')].map((cell) => {
    const rect = cell.querySelector('rect');
    const x = Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2;
    const y = Number(cell.querySelector('text').getAttribute('y'));
    const strip = document.createElementNS(SVGNS, 'g');
    strip.setAttribute('class', 'strip');
    for (let j = 0; j <= 10; j++) {
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y + j * PITCH);
      t.setAttribute('text-anchor', 'middle');
      t.textContent = String(j % 10);
      strip.appendChild(t);
    }
    cell.querySelector('text').replaceWith(strip);
    return strip;
  }).reverse(); // od najmłodszej cyfry: [0] = litry
  const ptrs = ['p4', 'p3', 'p2', 'p1'].map((c) => svg.querySelector(`.ptr.${c}`));
  const star = svg.querySelector('#star');

  const clamp = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => x * x * (3 - 2 * x);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

  // bębenki z przeniesieniem jak w liczydle: wyższy obraca się, gdy niższy przechodzi z 9 na 0
  function drumPos(v) {
    const pos = [];
    for (let k = 0; k < strips.length; k++) {
      let p = Math.floor(v / 10 ** k) % 10;
      if (k === 0) {
        const f = v % 1;
        if (f > 0.8) p += smooth((f - 0.8) / 0.2);
      } else if (pos[k - 1] > 9) {
        p += pos[k - 1] - 9;
      }
      pos.push(p);
    }
    return pos;
  }
  // tarczki ×0,0001, ×0,001, ×0,01 i ×0,1 m³: jeden obrót to 1, 10, 100 i 1000 litrów
  const ptrAngles = (v) => [(v % 1) * 360, (v % 10) * 36, (v % 100) * 3.6, (v % 1000) * 0.36];

  const drawn = new Map();
  const put = (el, value) => {
    if (drawn.get(el) !== value) { el.setAttribute('transform', value); drawn.set(el, value); }
  };
  function paint(dPos, pAng, starA) {
    dPos.forEach((p, k) => put(strips[k], `translate(0 ${(-(p % 10) * PITCH || 0).toFixed(2)})`));
    pAng.forEach((a, k) => put(ptrs[k], `rotate(${(a % 360).toFixed(2)})`));
    put(star, `rotate(${(starA % 360).toFixed(2)} 300 440)`);
  }

  let mode = fig.dataset.mode;
  let v = V0;
  let starA = 0;
  let rate = 0;
  let spin = 0;
  let intro = null;
  let raf = 0;
  let prev = 0;
  let ready = false;
  let visible = true;
  paint(drumPos(v), ptrAngles(v), starA);

  function frame(now) {
    const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 0;
    prev = now;
    // rozpędzanie i hamowanie: licznik ma bezwładność
    const goal = MODES[mode];
    const k = 1 - Math.exp(-dt / (goal.rate > rate ? 0.35 : 0.6));
    rate += (goal.rate - rate) * k;
    spin += (goal.spin - spin) * k;
    v += rate * dt;
    starA = (starA + spin * dt) % 360;
    const d = drumPos(v);
    const p = ptrAngles(v);
    if (intro) {
      // przebudzenie: każdy bębenek i każda wskazówka robi pełny obrót i wraca na odczyt
      const e = (now - intro) / 1000;
      d.forEach((x, i) => { d[i] = x + 10 * inOut(clamp((e - (7 - i) * 0.06) / 1.2)); });
      p.forEach((a, i) => { p[i] = a + 360 * inOut(clamp((e - i * 0.08) / 1.5)); });
      if (e > 1.9) intro = null;
    }
    paint(d, p, starA);
    raf = requestAnimationFrame(frame);
  }
  const start = () => {
    if (ready && visible && !raf && !motion.matches) { prev = 0; raf = requestAnimationFrame(frame); }
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // poza ekranem licznik nie zużywa klatek
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start(); else stop();
  }).observe(fig);
  motion.addEventListener('change', () => { if (motion.matches) stop(); else start(); });

  // start po wczytaniu fontu cyfr (najdłużej 0,8 s), żeby bębenki nie zmieniały kroju w ruchu
  const fontsReady = document.fonts ? document.fonts.load('600 38px "Barlow Condensed"', '0123456789') : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => { window.setTimeout(r, 800); })]).then(() => {
    ready = true;
    if (visible && !motion.matches) intro = performance.now();
    start();
  });

  // przełącznik stanu kranów: grupa radiowa, strzałki zmieniają wybór
  const radios = [...fig.querySelectorAll('.seg [role="radio"]')];
  // werdykt obu stanów jest w HTML: widoczny akapit ogłasza zmianę (aria-live), ukryty trzyma wysokość
  const sayNow = document.getElementById('meter-say');
  const sayAlt = fig.querySelector('.say-alt');
  function setMode(next, focus) {
    radios.forEach((r) => {
      const on = r.dataset.mode === next;
      r.setAttribute('aria-checked', String(on));
      r.tabIndex = on ? 0 : -1;
      if (on && focus) r.focus();
    });
    if (next === mode) return;
    mode = next;
    fig.dataset.mode = next;
    [sayNow.innerHTML, sayAlt.innerHTML] = [sayAlt.innerHTML, sayNow.innerHTML];
  }
  radios.forEach((r, i) => {
    r.tabIndex = r.getAttribute('aria-checked') === 'true' ? 0 : -1;
    r.addEventListener('click', () => setMode(r.dataset.mode));
    r.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      setMode(radios[(i + d + radios.length) % radios.length].dataset.mode, true);
    });
  });

  /* ---------- menu ---------- */
  const head = document.querySelector('.head');
  const menuBtn = document.querySelector('.menu-toggle');
  menuBtn.addEventListener('click', () => {
    const open = head.classList.toggle('nav-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => {
    head.classList.remove('nav-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.querySelectorAll('.has-sub').forEach((li) => li.classList.remove('open'));
  }));
  document.querySelectorAll('.nav-sub-toggle').forEach((btn) => {
    const li = btn.closest('.has-sub');
    btn.addEventListener('click', () => {
      const open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.has-sub.open').forEach((li) => {
      if (!li.contains(e.target)) { li.classList.remove('open'); li.querySelector('.nav-sub-toggle').setAttribute('aria-expanded', 'false'); }
    });
  });

  /* ---------- wideo: na serwerze YouTube ładuje się w stronie dopiero po kliknięciu ---------- */
  // Strona otwarta z dysku (file://) nie wysyła nagłówka Referer, a bez niego YouTube pokazuje błąd 153.
  // Wtedy miniatura zostaje zwykłym linkiem i otwiera film na YouTube w nowej karcie.
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    document.querySelectorAll('.vid[data-yt]').forEach((link) => {
      link.addEventListener('click', (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // nowa karta jak przy zwykłym linku
        e.preventDefault();
        const frame = document.createElement('div');
        frame.className = 'vid-frame';
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${link.dataset.yt}?autoplay=1&rel=0`;
        iframe.title = link.getAttribute('aria-label').replace('Odtwórz film: ', '');
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'; // YouTube wymaga Referera – nagłówki serwera nie mogą go wyłączyć
        frame.appendChild(iframe);
        const item = link.closest('li');
        if (item) item.classList.add('playing');
        link.replaceWith(frame);
        iframe.focus();
      });
    });
  }

  /* ---------- formularz zgłoszenia (prototyp: bez wysyłki) ---------- */
  const form = document.getElementById('form');
  const err = document.getElementById('form-err');
  const ok = document.getElementById('form-ok');
  const isBad = (f) => (f.type === 'checkbox' ? !f.checked : !f.value.trim());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let first = null;
    form.querySelectorAll('[required]').forEach((f) => {
      const bad = isBad(f);
      f.setAttribute('aria-invalid', String(bad));
      if (bad && !first) first = f;
    });
    if (first) {
      err.hidden = false;
      first.focus();
      return;
    }
    err.hidden = true;
    form.classList.add('sent');
    ok.hidden = false;
    ok.setAttribute('tabindex', '-1');
    ok.focus();
  });
  form.addEventListener('input', (e) => {
    const f = e.target;
    if (f.getAttribute('aria-invalid') === 'true') f.setAttribute('aria-invalid', String(isBad(f)));
  });
  form.addEventListener('change', (e) => {
    const f = e.target;
    if (f.getAttribute('aria-invalid') === 'true') f.setAttribute('aria-invalid', String(isBad(f)));
  });

  /* ---------- pasek „zadzwoń” na telefonie ---------- */
  // widoczny, gdy przyciski bohatera są poza ekranem, i chowa się przy sekcji zgłoszenia
  const callbar = document.getElementById('callbar');
  let heroVisible = true;
  let atReport = false;
  const syncBar = () => callbar.classList.toggle('show', !heroVisible && !atReport);
  new IntersectionObserver(([e]) => { heroVisible = e.intersectionRatio >= 0.6; syncBar(); }, { threshold: [0, 0.6, 1] })
    .observe(document.getElementById('hero-actions'));
  new IntersectionObserver(([e]) => { atReport = e.isIntersecting; syncBar(); }, { threshold: 0.25 })
    .observe(document.getElementById('zglos'));
})();
