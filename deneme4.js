// deneme4.js
(function () {
    // ---------- tiny helpers ----------
    const $ = (id) => document.getElementById(id);
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  
    // ---------- sound helpers ----------
    function playClick() { $('clickSound')?.play?.(); }
    function playSuccess() { $('successSound')?.play?.(); }
    function playError() { $('errorSound')?.play?.(); }

    // ---------- notification helper ----------
    function showBadgeNotification(badgeName) {
      const banner = $('badgeNotification');
      if (!banner) return;
      banner.innerHTML = `🎉 Congrats! You earned: <strong>${badgeName}</strong>`;
      banner.style.display = 'block';
      banner.style.opacity = '1';
      banner.style.animation = 'none';
      setTimeout(() => {
        banner.style.animation = 'fadeInOut 3s forwards';
      }, 10);
      setTimeout(() => {
        banner.style.display = 'none';
      }, 3000);
    }
  
    // ---------- nav / progress ----------
    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
      });
      const scr = $(id);
      if (scr) {
        scr.style.display = 'flex';
        scr.classList.add('active');
      }
    }
  
    function updateProgress(step) {
      for (let i = 1; i <= step; i++) {
        const el = $(`step${i}`);
        if (el) el.classList.add('completed');
      }
    }
  
    // ---------- app state ----------
    const state = {
      beamCount: 0,
      totalLoad: 0,       // Confirmed Total Design Load (psi)
      tributaryWidth: 0,  // Confirmed Tributary Width (ft)
      lineLoad: 0,        // Confirmed Line Load (lbs/ft)
      
      tributaryAttempts: 0,
      tributaryPoints: 100,
      
      results: { Mmax: null, Vmax: null }
    };

    // ---------- HiDPI Canvas Helper (Original) ----------
    function ensureHiDPI(canvas) {
      if (!canvas) return { dpr: 1, cw: 0, ch: 0 };
      const dpr = window.devicePixelRatio || 1;
      let cssW, cssH;
      if (!canvas.dataset.originalWidth) {
        cssW = canvas.getAttribute('width') ? Number(canvas.getAttribute('width')) : canvas.clientWidth || 400;
        cssH = canvas.getAttribute('height') ? Number(canvas.getAttribute('height')) : canvas.clientHeight || 400;
        canvas.dataset.originalWidth = cssW;
        canvas.dataset.originalHeight = cssH;
      } else {
        cssW = Number(canvas.dataset.originalWidth);
        cssH = Number(canvas.dataset.originalHeight);
      }
      const applied = canvas._hidpi || { w: 0, h: 0, dpr: 1 };
      if (applied.w !== cssW || applied.h !== cssH || applied.dpr !== dpr) {
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        canvas._hidpi = { w: cssW, h: cssH, dpr };
      }
      return { dpr, cw: canvas.width, ch: canvas.height };
    }

    function drawImageFit(srcCanvas, dstCanvas, bg = '#fff') {
      if (!srcCanvas || !dstCanvas) return;
      const ctx = dstCanvas.getContext('2d');
      const { cw: DW, ch: DH } = ensureHiDPI(dstCanvas);
      const SW = srcCanvas.width;
      const SH = srcCanvas.height;
      if (!SW || !SH) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, DW, DH);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, DW, DH); }
      const scale = Math.min(DW / SW, DH / SH);
      const w = SW * scale, h = SH * scale;
      const dx = (DW - w) / 2, dy = (DH - h) / 2;
      ctx.drawImage(srcCanvas, 0, 0, SW, SH, dx, dy, w, h);
    }
  
    // ---------- Badges ----------
    const BadgeSystem = (() => {
      const _state = { earned: new Set(), meta: new Map(), order: [], initialized: false };
  
      function init(initialMeta = []) {
        if (_state.initialized) return;
        initialMeta.forEach(b => { _state.meta.set(b.id, b); _state.order.push(b.id); });
        render();
        _state.initialized = true;
      }
  
      function earn(id) {
        if (!_state.meta.has(id) || _state.earned.has(id)) return;
        _state.earned.add(id);
        render();
        const cfg = _state.meta.get(id);
        (cfg?.soundId && $(cfg.soundId)?.play) ? $(cfg.soundId).play() : $('successSound')?.play?.();
        showBadgeNotification(cfg?.title || 'New Badge');
      }
  
      function render() {
        const bar = $('badgeBar');
        if (!bar) return;
        bar.innerHTML = '';
        _state.order.forEach(id => {
          const cfg = _state.meta.get(id);
          const earned = _state.earned.has(id);
          const wrap = document.createElement('div'); wrap.className = 'badge-wrapper';
          const img = document.createElement('img');
          img.className = 'badge' + (earned ? '' : ' locked');
          img.src = cfg?.img || './img/badge-placeholder.png';
          img.alt = cfg?.title || 'Badge';
          img.title = earned ? (cfg?.title || 'Badge') : ((cfg?.title ? `${cfg.title} (locked)` : 'Locked badge'));
          wrap.appendChild(img);
          if (!earned) {
            const lock = document.createElement('img');
            lock.src = './img/lock.png'; lock.className = 'lock-icon';
            wrap.appendChild(lock);
          }
          bar.appendChild(wrap);
        });
      }
      return { init, earn };
    })();
  
    // ---------- Logic: Check Total Load (Page 2) ----------
    function checkTotalLoad() {
        const dead = parseFloat($('permanentLoad')?.value) || 0;
        const snow = parseFloat($('snowLoad')?.value) || 0;
        const wind = Math.abs(parseFloat($('windLoad')?.value) || 0);
        const live = parseFloat($('mobileLoad')?.value) || 0;
        
        // As requested: Sum of all entered loads
        const expectedTotal = dead + snow + wind + live;
        
        const userInput = parseFloat($('inputTotalLoad')?.value);
        const fb = $('loadFeedback');
        const contBtn = $('continueToTributaryBtn');

        fb.style.display = 'block';

        if (Math.abs(userInput - expectedTotal) <= 0.1) {
            playSuccess();
            fb.style.backgroundColor = '#e0f7e9';
            fb.style.color = '#155724';
            fb.innerHTML = `✅ Correct! Total Design Load = <strong>${expectedTotal.toFixed(2)} psi</strong>`;
            
            // Unlock continue button
            contBtn.style.display = 'inline-block';
            state.totalLoad = expectedTotal;
            BadgeSystem.earn('load');
        } else {
            playError();
            fb.style.backgroundColor = '#fff3cd';
            fb.style.color = '#856404';
            fb.innerHTML = `❌ Incorrect. <br><strong>Hint:</strong> Just add all your load values together (Dead + Snow + |Wind| + Live).`;
            contBtn.style.display = 'none';
        }
    }

    // ---------- Logic: Check Tributary (Page 3 Step 1) ----------
    function checkTributary() {
        const tribInput = parseFloat($('tributaryWidth')?.value);
        const beamName = $('beamSelect')?.value;
        const beamNum = parseInt(beamName.replace('Beam ', ''), 10);
        
        const W = parseFloat($('inputWidth').value);
        const count = state.beamCount;
        const spacing = W / (count - 1);
        
        const isEdge = (beamNum === 1 || beamNum === count);
        const expectedTrib = isEdge ? spacing / 2 : spacing;
        
        const fb = $('tribFeedback');
        const gif = $('feedbackGif');

        fb.style.display = 'block';

        if (Math.abs(tribInput - expectedTrib) <= 0.1) {
            playSuccess();
            fb.style.backgroundColor = '#e0f7e9';
            fb.style.color = '#155724';
            fb.innerHTML = `✅ Correct! Tributary Width = <strong>${expectedTrib.toFixed(2)} ft</strong>`;
            if(gif) { gif.src = './img/correct1.gif'; gif.style.display = 'block'; }
            
            state.tributaryWidth = expectedTrib;
            state.tributaryPoints = 100; // Simplified scoring
            BadgeSystem.earn('accuracy');

            // REVEAL STEP 2
            $('step2_lineLoad').style.display = 'block';
            $('step2_lineLoad').scrollIntoView({ behavior: 'smooth' });

        } else {
            playError();
            fb.style.backgroundColor = '#fff3cd';
            fb.style.color = '#856404';
            fb.innerHTML = `❌ Incorrect. <br>Hint: Interior beams = Spacing ($s$). Edge beams = $s/2$.`;
            if(gif) { gif.src = './img/fail1.gif'; gif.style.display = 'block'; }
        }
    }

    // ---------- Logic: Check Line Load (Page 3 Step 2) ----------
    function checkLineLoad() {
        // Line Load w = Total Load (psi) * Trib Width (ft)
        // Note: Assuming units align (user is doing straight multiplication)
        const expectedLineLoad = state.totalLoad * state.tributaryWidth;
        const userInput = parseFloat($('inputLineLoad').value);
        
        const fb = $('lineLoadFeedback');
        fb.style.display = 'block';
        
        // 2% tolerance
        if (Math.abs(userInput - expectedLineLoad) < (expectedLineLoad * 0.02 + 0.1)) {
            playSuccess();
            fb.style.backgroundColor = '#e0f7e9';
            fb.style.color = '#155724';
            fb.innerHTML = `✅ Correct! Line Load ($w$) = <strong>${expectedLineLoad.toFixed(2)} lbs/ft</strong>`;
            
            state.lineLoad = expectedLineLoad;
            
            // REVEAL STEP 3
            $('step3_forces').style.display = 'block';
            $('step3_forces').scrollIntoView({ behavior: 'smooth' });
        } else {
            playError();
            fb.style.backgroundColor = '#fff3cd';
            fb.style.color = '#856404';
            fb.innerHTML = `❌ Incorrect. <br>Hint: Multiply Total Load (${state.totalLoad}) by Tributary Width (${state.tributaryWidth}).`;
        }
    }

    // ---------- Logic: Check Forces (Page 3 Step 3) ----------
    function checkForces() {
        const w = state.lineLoad;
        const L = parseFloat($('inputLength').value);
        
        const expV = (w * L) / 2;
        const expM = (w * L * L) / 8;
        
        const uV = parseFloat($('inputVmax').value);
        const uM = parseFloat($('inputMmax').value);
        const uD = parseFloat($('inputDelta').value);

        const fb = $('forcesFeedback');
        fb.style.display = 'block';
        
        let errors = [];
        const check = (u, e) => Math.abs(u - e) < (e * 0.05 + 1.0); // 5% tolerance
        
        if (!check(uV, expV)) errors.push(`Check Vmax (Expected ~${expV.toFixed(1)})`);
        if (!check(uM, expM)) errors.push(`Check Mmax (Expected ~${expM.toFixed(1)})`);
        if (isNaN(uD) || uD <= 0) errors.push(`Deflection must be positive`);

        if (errors.length === 0) {
            playSuccess();
            fb.style.backgroundColor = '#e0f7e9';
            fb.style.color = '#155724';
            fb.innerHTML = `✅ <strong>Perfect!</strong> All values correct.`;
            
            state.results.Vmax = uV;
            state.results.Mmax = uM;
            BadgeSystem.earn('strength');
            
            $('continueToSummaryBtn').style.display = 'inline-block';
        } else {
            playError();
            fb.style.backgroundColor = '#fff3cd';
            fb.style.color = '#856404';
            fb.innerHTML = `❌ Errors found: <br> ${errors.join('<br>')}`;
        }
    }

    // ---------- Drawing Logic (Original) ----------
    function drawSlab(width, length, spacing, beamCount) {
      const canvas = $('slabCanvas');
      if (!canvas) return;
      const { dpr, cw, ch } = ensureHiDPI(canvas);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
  
      const PAD = 40 * dpr;
      const availW = cw - 2 * PAD, availH = ch - 2 * PAD;
  
      const scale = Math.max(0.0001, Math.min(availW / width, availH / length));
      const slabWpx = width * scale, slabHpx = length * scale;
      const originX = Math.round((cw - slabWpx) / 2);
      const originY = Math.round((ch - slabHpx) / 2);
  
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#e6f2fa'; ctx.fillRect(0, 0, cw, ch);
  
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(originX, originY, slabWpx, slabHpx);
  
      const baseFont = Math.max(10 * dpr, Math.min(16 * dpr, 12 * dpr * (scale / 50)));
      ctx.fillStyle = '#000'; ctx.font = `${baseFont}px Arial`;
  
      ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < beamCount; i++) {
        const x = originX + i * spacing * scale;
        ctx.beginPath(); ctx.moveTo(x, originY); ctx.lineTo(x, originY + slabHpx); ctx.stroke();
        const label = `Beam ${i + 1}`;
        const w = ctx.measureText(label).width;
        ctx.fillText(label, x - w / 2, originY - 6 * dpr);
      }
  
      ctx.fillText(`Length: ${length} ft`, originX + slabWpx + 8 * dpr, originY + slabHpx / 2);
  
      const bayStartX = originX, bayEndX = originX + spacing * scale, dimY = originY + slabHpx + 12 * dpr;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(bayStartX, dimY - 5 * dpr); ctx.lineTo(bayStartX, dimY + 5 * dpr);
      ctx.moveTo(bayEndX, dimY - 5 * dpr);   ctx.lineTo(bayEndX, dimY + 5 * dpr);
      ctx.moveTo(bayStartX, dimY); ctx.lineTo(bayEndX, dimY); ctx.stroke();
  
      const spacingLabel = `Spacing: ${spacing.toFixed(2)} ft`;
      const textW = ctx.measureText(spacingLabel).width;
      ctx.fillText(spacingLabel, (bayStartX + bayEndX) / 2 - textW / 2, dimY + 14 * dpr);
    }

    function updateCombinedLoadImage() {
        const div = $('combinedLoadImage');
        const btn = $('toggleCombinedBtn');
        if(!div || !btn) return;

        const p = parseFloat($('permanentLoad').value) || 0;
        const s = parseFloat($('snowLoad').value) || 0;
        const w = parseFloat($('windLoad').value) || 0;
        const m = parseFloat($('mobileLoad').value) || 0;

        div.innerHTML = '';
        const windDir = w > 0 ? '+W' : (w < 0 ? '-W' : '');
        
        // Simple logic to build filename
        // Assumes file naming convention from original code
        let combo = '';
        if (p>0 && s>0 && w!==0 && m>0) combo = `P+S+${windDir}+M`;
        else if (p>0 && w!==0 && m>0) combo = `P+${windDir}+M`;
        else if (p>0 && m>0 && s>0) combo = 'P+M+S';
        else if (p>0 && m>0) combo = 'P+M';
        else if (p>0) combo = 'P';
        
        if(combo) {
            const img = document.createElement('img');
            img.src = `./img/${combo}.png`;
            img.style.maxWidth = '300px';
            img.onerror = () => { img.style.display='none'; };
            div.appendChild(img);
            btn.style.display = 'inline-block';
            btn.textContent = div.style.display==='none' ? `Show Combined Loads` : `Hide Combined Loads`;
        } else {
            btn.style.display='none';
        }
    }

    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', () => {
      // Intro -> Slab
      on($('continueBtn'), 'click', () => {
        playClick();
        showScreen('canvasScreen');
        updateProgress(1);
      });
  
      // Back from Slab
      on($('backBtn'), 'click', () => {
        playClick();
        showScreen('introScreen');
      });
  
      // Badges Init
      BadgeSystem.init([
        { id: 'accuracy',  title: 'Accuracy Ace', img: './img/badge1.png', soundId: 'badgeSound' },
        { id: 'load',  title: 'Load Master', img: './img/badge2.png', soundId: 'badgeSound' },
        { id: 'strength',  title: 'Strength Solver', img: './img/badge3.png', soundId: 'badgeSound' }
      ]);
  
      // Slab -> Load
      on($('continueToLoadBtn'), 'click', () => {
        playClick();
        showScreen('loadScreen');
        const loadCanvas = $('loadCanvas');
        const src = $('slabCanvas');
        if (loadCanvas && src) {
          ensureHiDPI(loadCanvas);
          drawImageFit(src, loadCanvas, '#e6f2fa');
        }
      });
  
      // Back to Slab
      on($('backToSlabBtn'), 'click', () => {
        playClick();
        showScreen('canvasScreen');
      });
  
      // Draw Canvas
      on($('drawCanvasBtn'), 'click', () => {
        playClick();
        const width = parseFloat($('inputWidth')?.value);
        const length = parseFloat($('inputLength')?.value);
        const beamCount = parseInt($('inputBeamCount')?.value, 10);
  
        if (isNaN(width) || isNaN(length) || isNaN(beamCount) || beamCount < 2) {
          alert('Please enter valid dimensions.');
          return;
        }
  
        const spacing = width / (beamCount - 1);
        state.beamCount = beamCount;
  
        $('spacingInfo').textContent = `Calculated spacing: ${spacing.toFixed(2)} ft`;
        drawSlab(width, length, spacing, beamCount);
        updateProgress(2);
  
        // Populate Select
        const sel = $('beamSelect');
        sel.innerHTML = '';
        for (let i = 1; i <= beamCount; i++) {
          const op = document.createElement('option');
          op.value = `Beam ${i}`; op.textContent = `Beam ${i}`;
          sel.appendChild(op);
        }
      });

      // Load Checks
      on($('checkTotalLoadBtn'), 'click', () => { playClick(); checkTotalLoad(); });
      
      // Load Images Toggle
      const inputs = ['permanentLoad', 'snowLoad', 'mobileLoad'];
      inputs.forEach(id => {
          on($(id), 'input', (e) => {
              const img = $(`img${id.replace('Load','')}`);
              if(img) img.style.display = parseFloat(e.target.value) > 0 ? 'inline-block' : 'none';
              updateCombinedLoadImage();
          });
      });
      // Wind special case
      on($('windLoad'), 'input', (e) => {
          const v = parseFloat(e.target.value);
          $('imgWindPositive').style.display = v > 0 ? 'inline-block' : 'none';
          $('imgWindNegative').style.display = v < 0 ? 'inline-block' : 'none';
          updateCombinedLoadImage();
      });
      
      on($('toggleCombinedBtn'), 'click', () => {
          const div = $('combinedLoadImage');
          const btn = $('toggleCombinedBtn');
          div.style.display = div.style.display === 'none' ? 'block' : 'none';
          btn.textContent = div.style.display==='none' ? `Show Combined Loads` : `Hide Combined Loads`;
          updateProgress(3);
      });

      // To Tributary Screen
      on($('continueToTributaryBtn'), 'click', () => {
          playClick();
          showScreen('tributaryScreen');
          // Clone canvas
          const orig = $('loadCanvas');
          const dest = $('loadCanvasPreview');
          ensureHiDPI(dest);
          drawImageFit(orig, dest, '#e6f2fa');
          
          // Clone combined image
          const origImg = $('combinedLoadImage');
          const destImg = $('combinedImagePreview');
          destImg.innerHTML = origImg.innerHTML;
      });

      // Tributary / Design Checks
      on($('submitTribBtn'), 'click', () => { playClick(); checkTributary(); });
      on($('checkLineLoadBtn'), 'click', () => { playClick(); checkLineLoad(); });
      on($('checkForcesBtn'), 'click', () => { playClick(); checkForces(); });
      
      on($('continueToSummaryBtn'), 'click', () => {
          playClick();
          showScreen('resultScreen');
          const scr = $('finalScore');
          scr.innerHTML = `
            <h3>Session Summary</h3>
            <ul>
              <li>Final Score: 100/100</li>
              <li>Badges: ${document.querySelectorAll('#badgeBar .badge:not(.locked)').length}</li>
              <li>Line Load: ${state.lineLoad.toFixed(2)} lbs/ft</li>
              <li>Max Shear: ${state.results.Vmax} lbs</li>
              <li>Max Moment: ${state.results.Mmax} lbs-ft</li>
            </ul>
          `;
          updateProgress(5);
      });

    });
})();
