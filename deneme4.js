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
      setTimeout(() => { banner.style.animation = 'fadeInOut 3s forwards'; }, 10);
      setTimeout(() => { banner.style.display = 'none'; }, 3000);
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
      totalScore: 100,
      tributaryAttempts: 0,
      tributaryPoints: 100,
      results: { Ed: null, Mmax: null, Vmax: null }
    };

    // ---------- HiDPI Canvas ----------
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
          img.title = earned ? (cfg?.title) : ((cfg?.title ? `${cfg.title} (locked)` : 'Locked badge'));
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
  
    // ---------- Simplified Eurocode Logic (Hardcoded ULS) ----------
    const CalculationEngine = (() => {
      function getLoads() {
        const s = parseFloat($('tributaryWidth')?.value);
        if (!s || s <= 0) return { error: 'Please enter a valid tributary width first.' };
        return {
          s,
          Gk: (parseFloat($('permanentLoad')?.value) || 0) * s,
          Qk_mobile: (parseFloat($('mobileLoad')?.value) || 0) * s,
          Qk_wind:   Math.abs(parseFloat($('windLoad')?.value) || 0) * s,
          Qk_snow:   (parseFloat($('snowLoad')?.value) || 0) * s
        };
      }

      function computeTargetValues() {
        const L = getLoads();
        if (L.error) return L;

        // HARDCODED ULS FACTORS
        const GAMMA_G = 1.35;
        const GAMMA_Q = 1.5;
        const PSI_0 = 0.7; // Standard factor for accompanying variable loads

        // Find max variable load to be leading
        const vars = [L.Qk_mobile, L.Qk_wind, L.Qk_snow];
        const maxVar = Math.max(...vars);
        const sumOthers = vars.reduce((a, b) => a + b, 0) - maxVar;

        // ULS Formula: 1.35*G + 1.5*Q_lead + 1.5*0.7*Sum(Q_others)
        const Ed = (GAMMA_G * L.Gk) + (GAMMA_Q * maxVar) + (GAMMA_Q * PSI_0 * sumOthers);

        // Beam Length
        const beamL = parseFloat($('inputLength')?.value) || 0;

        // Mmax and Vmax
        // Vmax = wL / 2
        // Mmax = wL^2 / 8
        const Vmax = (Ed * beamL) / 2;
        const Mmax = (Ed * beamL * beamL) / 8;

        return {
            Ed: Number(Ed.toFixed(2)),
            Vmax: Number(Vmax.toFixed(2)),
            Mmax: Number(Mmax.toFixed(2))
        };
      }
      return { computeTargetValues };
    })();

    // ---------- Verification Logic ----------
    function checkFinalValues() {
        const targets = CalculationEngine.computeTargetValues();
        if(targets.error) { alert(targets.error); return; }

        const uEd = parseFloat($('designLoadInput')?.value);
        const uV = parseFloat($('vMaxInput')?.value);
        const uM = parseFloat($('mMaxInput')?.value);
        const uDelta = parseFloat($('deltaMaxInput')?.value);

        if(isNaN(uEd) || isNaN(uV) || isNaN(uM) || isNaN(uDelta)) {
            alert("Please fill in all 4 fields (Ed, Vmax, Mmax, Delta max).");
            return;
        }

        const tol = 0.10; // 10% tolerance? Or absolute value 0.1? Let's use absolute 0.5 for large numbers
        const isEdOk = Math.abs(uEd - targets.Ed) <= 0.5;
        const isVOk  = Math.abs(uV - targets.Vmax) <= 0.5;
        const isMOk  = Math.abs(uM - targets.Mmax) <= 0.5;
        // We cannot check Delta Max accurately without Young's Modulus (E) and Inertia (I).
        // We will accept any number > 0 for Delta Max.
        const isDeltaOk = uDelta > 0;

        const fb = $('finalFeedback');
        
        // Save results for summary
        state.results.Ed = uEd;
        state.results.Mmax = uM;
        state.results.Vmax = uV;

        if (isEdOk && isVOk && isMOk && isDeltaOk) {
            playSuccess();
            BadgeSystem.earn('designEd');
            BadgeSystem.earn('strength');
            fb.style.color = 'green';
            fb.innerHTML = `✅ All Correct! <br> Expected: Ed=${targets.Ed}, V=${targets.Vmax}, M=${targets.Mmax}`;
            $('continueToSummaryBtn').style.display = 'inline-block';
        } else {
            playError();
            fb.style.color = 'red';
            let msg = "❌ Errors found:<br>";
            if(!isEdOk) msg += `Check Ed (Expected approx ${targets.Ed})<br>`;
            if(!isVOk) msg += `Check Vmax (Expected approx ${targets.Vmax})<br>`;
            if(!isMOk) msg += `Check Mmax (Expected approx ${targets.Mmax})<br>`;
            if(!isDeltaOk) msg += `Check Delta (Must be positive)<br>`;
            fb.innerHTML = msg;
        }
    }

    function showSummary() {
      const earnedCount = document.querySelectorAll('#badgeBar .badge:not(.locked)').length;
      const p = document.getElementById('finalScore');
      if (p) {
        p.innerHTML = `
        <div style="text-align:left; max-width:560px; margin:0 auto;">
          <h3>Session Summary</h3>
          <ul>
            <li>Final Score: <b>${state.totalScore}</b></li>
            <li>Badges earned: <b>${earnedCount}</b></li>
            <li>E<sub>d</sub>: <b>${(state.results.Ed ?? '-')}</b></li>
            <li>M<sub>max</sub>: <b>${(state.results.Mmax ?? '-')}</b></li>
            <li>V<sub>max</sub>: <b>${(state.results.Vmax ?? '-')}</b></li>
          </ul>
        </div>`;
      }
      showScreen('resultScreen');
      updateProgress(5);
    }

    // ---------- Drawing Logic ----------
    function drawSlab(width, length, spacing, beamCount) {
      const canvas = $('slabCanvas');
      if (!canvas) return;
      const { dpr, cw, ch } = ensureHiDPI(canvas);
      const ctx = canvas.getContext('2d');
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
      const combinedImageDiv = $('combinedLoadImage');
      const toggleBtn = $('toggleCombinedBtn');
      if (!combinedImageDiv || !toggleBtn) return;
      const permanent = parseFloat($('permanentLoad')?.value) || 0;
      const snow = parseFloat($('snowLoad')?.value) || 0;
      const wind = parseFloat($('windLoad')?.value) || 0;
      const mobile = parseFloat($('mobileLoad')?.value) || 0;
      combinedImageDiv.innerHTML = '';
      
      const hasP = permanent > 0;
      const hasS = snow > 0;
      const hasW = wind !== 0;
      const hasM = mobile > 0;
      const windDirection = wind > 0 ? '+W' : (wind < 0 ? '-W' : '');
      let combination = '';
      if (hasP && hasS && hasW && hasM) combination = `P+S+${windDirection}+M`;
      else if (hasP && hasW && hasM && !hasS) combination = `P+${windDirection}+M`;
      else if (hasP && hasM && hasS && !hasW) combination = 'P+M+S';
      else if (hasP && hasM && !hasS && !hasW) combination = 'P+M';
      else if (hasP && !hasS && !hasW && !hasM) combination = 'P';
      else if (hasP && hasS && hasW && !hasM) combination = `P+S+${windDirection}`;
      else if (hasP && hasS && !hasW && !hasM) combination = 'P+S';

      if (combination) {
        const img = document.createElement('img');
        img.src = `./img/${combination}.png`;
        img.alt = `Combined Load: ${combination}`;
        Object.assign(img.style, { width: '400px', height: 'auto', margin: '10px', border: '2px solid #333', borderRadius: '8px' });
        img.onerror = function () { this.style.display = 'none'; };
        combinedImageDiv.appendChild(img);
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = combinedImageDiv.style.display === 'none' ? `Show Combined Loads (${combination})` : `Hide Combined Loads (${combination})`;
      } else {
        toggleBtn.style.display = 'none';
        combinedImageDiv.style.display = 'none';
      }
    }
  
    function toggleLoadImage(inputId, imgId) {
        const input = $(inputId);
        if (!input) return;
        if (inputId === 'windLoad') {
          const imgPositive = $('imgWindPositive');
          const imgNegative = $('imgWindNegative');
          on(input, 'input', () => {
            const v = parseFloat(input.value) || 0;
            imgPositive.style.display = 'none'; imgNegative.style.display = 'none';
            if (v > 0) imgPositive.style.display = 'inline-block';
            else if (v < 0) imgNegative.style.display = 'inline-block';
            updateCombinedLoadImage();
          });
        } else {
          const img = $(imgId);
          on(input, 'input', () => {
            const v = parseFloat(input.value) || 0;
            img.style.display = v > 0 ? 'inline-block' : 'none';
            updateCombinedLoadImage();
          });
        }
    }
  
    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', () => {
      // Navigation
      on($('continueBtn'), 'click', () => { playClick(); $('introScreen').classList.remove('active'); $('canvasScreen').classList.add('active'); updateProgress(1); });
      on($('backBtn'), 'click', () => { playClick(); $('canvasScreen').classList.remove('active'); $('introScreen').classList.add('active'); });
      on($('continueToLoadBtn'), 'click', () => { 
          playClick(); 
          $('canvasScreen').classList.remove('active'); 
          $('loadScreen').classList.add('active'); 
          ensureHiDPI($('loadCanvas')); drawImageFit($('slabCanvas'), $('loadCanvas'), '#e6f2fa');
      });
      on($('backToSlabBtn'), 'click', () => { playClick(); $('loadScreen').classList.remove('active'); $('canvasScreen').classList.add('active'); });
      
      on($('continueToTributaryBtn'), 'click', () => {
        playClick();
        showScreen('tributaryScreen');
        ensureHiDPI($('loadCanvasPreview'));
        drawImageFit($('loadCanvas'), $('loadCanvasPreview'), '#e6f2fa');
      });

      // Drawing
      on($('drawCanvasBtn'), 'click', () => {
        playClick();
        const width = parseFloat($('inputWidth')?.value);
        const length = parseFloat($('inputLength')?.value);
        const beamCount = parseInt($('inputBeamCount')?.value, 10);
        if (isNaN(width) || isNaN(length) || isNaN(beamCount) || beamCount < 2) { alert('Invalid dimensions'); return; }
        const spacing = width / (beamCount - 1);
        state.beamCount = beamCount;
        $('spacingInfo').textContent = `Calculated spacing: ${spacing.toFixed(2)} ft`;
        drawSlab(width, length, spacing, beamCount);
        updateProgress(2);
        const sel = $('beamSelect'); sel.innerHTML = '';
        for (let i = 1; i <= beamCount; i++) {
          const op = document.createElement('option'); op.value = `Beam ${i}`; op.textContent = `Beam ${i}`; sel.appendChild(op);
        }
      });

      // Load Images
      toggleLoadImage('permanentLoad', 'imgPermanent');
      toggleLoadImage('snowLoad', 'imgSnow');
      toggleLoadImage('windLoad', null);
      toggleLoadImage('mobileLoad', 'imgMobile');
      on($('toggleCombinedBtn'), 'click', () => { 
        playClick(); 
        const div = $('combinedLoadImage'); 
        div.style.display = div.style.display === 'none' ? 'block' : 'none';
        updateCombinedLoadImage();
        updateProgress(3);
      });

      // Tributary Logic
      on($('submitLoadBtn'), 'click', () => {
        playClick();
        const tributaryWidth = parseFloat($('tributaryWidth')?.value);
        const beamNumber = parseInt(($('beamSelect')?.value || '').replace('Beam ', ''), 10);
        const spacing = parseFloat($('inputWidth')?.value) / (state.beamCount - 1);
        const isEdge = beamNumber === 1 || beamNumber === state.beamCount;
        const expected = isEdge ? spacing / 2 : spacing;
        state.tributaryAttempts++;
        const feedback = $('feedback');

        if (Math.abs(tributaryWidth - expected) <= 0.1) {
            playSuccess();
            if (state.tributaryAttempts === 1) { state.tributaryPoints += 20; BadgeSystem.earn('accuracy'); }
            feedback.innerHTML = `✅ Correct! Tributary width is ${expected.toFixed(2)} ft.`;
            feedback.style.backgroundColor = '#e0f7e9'; feedback.style.borderLeft = '4px solid #2ecc71'; feedback.style.display = 'block';
            $('feedbackGif').src = './img/correct1.gif'; $('feedbackGif').style.display = 'block';
            
            // SHOW THE NEW CALCULATION SECTION
            $('finalCalcSection').style.display = 'block';
            $('finalCalcSection').scrollIntoView({behavior: 'smooth'});
            updateProgress(4);
            state.tributaryAttempts = 0;
        } else {
            state.tributaryPoints = Math.max(0, state.tributaryPoints - 10);
            playError();
            feedback.innerHTML = `❌ Incorrect. Is it an edge beam? (Hint: ${expected.toFixed(2)})`;
            feedback.style.backgroundColor = '#fff3cd'; feedback.style.borderLeft = '4px solid #f0ad4e'; feedback.style.display = 'block';
            $('feedbackGif').src = './img/fail1.gif'; $('feedbackGif').style.display = 'block';
        }
      });

      // Final Values Check
      on($('checkFinalValuesBtn'), 'click', () => {
        playClick();
        checkFinalValues();
      });

      on($('continueToSummaryBtn'), 'click', () => {
          playClick();
          showSummary();
      });

      // Badges
      BadgeSystem.init([
        { id: 'accuracy',  title: 'Accuracy Ace', img: './img/badge1.png', soundId: 'badgeSound' },
        { id: 'designEd',  title: 'Design Load Pro', img: './img/badge2.png', soundId: 'badgeSound' },
        { id: 'strength',  title: 'Strength Solver', img: './img/badge3.png', soundId: 'badgeSound' }
      ]);
    });
  })();
