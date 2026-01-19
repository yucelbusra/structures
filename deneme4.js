
// deneme1.js
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
      // Reset animation to play again
      banner.style.animation = 'none';
      setTimeout(() => {
        banner.style.animation = 'fadeInOut 3s forwards';
      }, 10);
      // Ensure it hides after animation
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
      currentLimitState: null,
      totalScore: 100,
      tributaryAttempts: 0,
      tributaryPoints: 100, // ADD THIS - was missing!
      canvasDrawn: false,  // ADD THIS for canvas tracking

      results: {
        Ed: null,
        Mmax: null,
        Vmax: null
      }
    };

  
// FIXED ensureHiDPI function
    function ensureHiDPI(canvas) {
      if (!canvas) return { dpr: 1, cw: 0, ch: 0 };
      
      const dpr = window.devicePixelRatio || 1;
      
      let cssW, cssH;
      
      // First time: store the original dimensions
      if (!canvas.dataset.originalWidth) {
        cssW = canvas.getAttribute('width') ? Number(canvas.getAttribute('width')) : canvas.clientWidth || 400;
        cssH = canvas.getAttribute('height') ? Number(canvas.getAttribute('height')) : canvas.clientHeight || 400;
        
        // Store original dimensions
        canvas.dataset.originalWidth = cssW;
        canvas.dataset.originalHeight = cssH;
      } else {
        // Use stored original dimensions
        cssW = Number(canvas.dataset.originalWidth);
        cssH = Number(canvas.dataset.originalHeight);
      }

      const applied = canvas._hidpi || { w: 0, h: 0, dpr: 1 };
      
      // Only update if dimensions or DPR changed
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
  
    // ---------- Eurocode (compact table) ----------
    const Eurocode = (() => {
      const ACTIONS = ['mobile', 'wind', 'snow'];
  
      const val = (id, d = 0) => {
        const el = $(id);
        const v = parseFloat(el?.value);
        if (el?.value === 'none' || el?.value === 'No') return d;
        return Number.isFinite(v) ? v : d;
      };
  
      function loadsLine() {
        const s = parseFloat($('tributaryWidth')?.value);
        if (!s || s <= 0) return { error: 'Please enter a valid tributary width (m).' };
        return {
          s,
          Gk: (parseFloat($('permanentLoad')?.value) || 0) * s,
          Qk: {
            mobile: (parseFloat($('mobileLoad')?.value) || 0) * s,
            wind:   (parseFloat($('windLoad')?.value)   || 0) * s,
            snow:   (parseFloat($('snowLoad')?.value)   || 0) * s
          }
        };
      }
  
      function readLeading() {
        const r = document.querySelector('input[name="leadingAction"]:checked');
        return r?.value || null;
      }
  
      function computeAll() {
        const lead = readLeading();
        if (!lead) return { error: 'Select a leading action.' };
  
        const L = loadsLine();
        if (L.error) return { error: L.error };
  
        const psi0 = {}, psi1 = {}, psi2 = {};
        ACTIONS.forEach(a => {
          psi0[a] = val(`psi0_${a}`, 0);
          psi1[a] = val(`psi1_${a}`, 0);
          psi2[a] = val(`psi2_${a}`, 0);
        });
  
        const gammaG = val('gammaG', 1.35);
        const gammaQlead = val('gammaQ', 1.5);
  
        const acc = {};
        ACTIONS.forEach(a => acc[a] = !!$(`acc_${a}`)?.checked);
        acc[lead] = false;
  
        const Qlead = L.Qk[lead] || 0;
  
        let sumULSacc = 0;
        ACTIONS.forEach(a => {
          if (a === lead || !acc[a]) return;
          sumULSacc += gammaQlead * psi0[a] * (L.Qk[a] || 0);
        });
        const Ed_ULS = gammaG * L.Gk + gammaQlead * Qlead + sumULSacc;
  
        let sumRare = 0;
        ACTIONS.forEach(a => { if (a !== lead && acc[a]) sumRare += psi0[a] * (L.Qk[a] || 0); });
        const Ed_SLS_rare = L.Gk + Qlead + sumRare;
  
        let sumFreq = 0;
        ACTIONS.forEach(a => { if (a !== lead && acc[a]) sumFreq += psi2[a] * (L.Qk[a] || 0); });
        const Ed_SLS_freq = L.Gk + psi1[lead] * Qlead + sumFreq;
  
        let sumQP = psi2[lead] * Qlead;
        ACTIONS.forEach(a => { if (a !== lead && acc[a]) sumQP += psi2[a] * (L.Qk[a] || 0); });
        const Ed_SLS_quasi = L.Gk + sumQP;
  
        const r2 = x => Math.round(x * 100) / 100;
        return {
          leading: lead,
          results: {
            ULS: r2(Ed_ULS),
            SLS_rare: r2(Ed_SLS_rare),
            SLS_frequent: r2(Ed_SLS_freq),
            SLS_quasi: r2(Ed_SLS_quasi)
          }
        };
      }
  
      return { computeAll };
    })();
  
    function computeExpectedEd() {
      const combo = Eurocode.computeAll();
      if (combo.error) return { error: combo.error };
      const expected = (state.currentLimitState === 'ULS') ? combo.results.ULS : combo.results.SLS_rare;
      return { Ed: Number(expected.toFixed(2)) };
    }

    function computeExpectedMV() {
      const L = parseFloat(document.getElementById('inputLength')?.value);
      if (!Number.isFinite(L) || L <= 0) return { error: 'Please enter a valid slab Length (m) on the Slab screen.' };

      const edCalc = computeExpectedEd();
      if (edCalc.error) return { error: edCalc.error };

      const w = edCalc.Ed;
      const Mmax = (w * L * L) / 8;
      const Vmax = (w * L) / 2;
      return { Mmax: Number(Mmax.toFixed(2)), Vmax: Number(Vmax.toFixed(2)), Ed: w, L };
    }

    function checkMAndV() {
      const mvFb = document.getElementById('mvFeedback');
      const mUser = parseFloat(document.getElementById('mMaxInput')?.value);
      const vUser = parseFloat(document.getElementById('vMaxInput')?.value);

      if (!Number.isFinite(mUser) || !Number.isFinite(vUser)) {
        alert('Please enter numeric values for both Mmax and Vmax.');
        return;
      }

      const exp = computeExpectedMV();
      if (exp.error) { alert(exp.error); return; }

      const tol = 0.10;
      const mOk = Math.abs(Number(mUser.toFixed(2)) - exp.Mmax) <= tol;
      const vOk = Math.abs(Number(vUser.toFixed(2)) - exp.Vmax) <= tol;

      state.results.Mmax = Number(mUser.toFixed(2));
      state.results.Vmax = Number(vUser.toFixed(2));

      if (mOk && vOk) {
        playSuccess?.();
        mvFb.style.color = '#2ecc71';
        mvFb.innerHTML = `✅ Correct! Expected M<sub>max</sub>=${exp.Mmax.toFixed(2)} lbs·ft, V<sub>max</sub>=${exp.Vmax.toFixed(2)} lbs.`;
        BadgeSystem?.earn?.('strength');
        document.getElementById('continueToSummaryBtn').disabled = false;
      } else {
        playError?.();
        mvFb.style.color = '#c26b00';
        mvFb.innerHTML = `❌ Check again.<br>
          Remember,  Mmax = (w * L * L) / 8 lbs·ft and Vmax = (w * L) / 2 lbs`;
        document.getElementById('continueToSummaryBtn').disabled = true;
      }
    }
    
    function showSummary() {
      if (state.results.Ed == null) {
        const ed = computeExpectedEd();
        if (!ed.error) state.results.Ed = ed.Ed;
      }
      
      document.getElementById('mvPanel')?.style?.setProperty('display', 'none'); 

      const earnedCount = document.querySelectorAll('#badgeBar .badge:not(.locked)').length;
      const totalScore = state.totalScore ?? '-'; 

      const p = document.getElementById('finalScore');
      if (p) {
        p.innerHTML = `
        <div style="text-align:left; max-width:560px;">
          <h3>Session Summary</h3>
          <ul>
            <li>Final Score: <b>${totalScore}</b></li>
            <li>Badges earned: <b>${earnedCount}</b></li>
            <li>E<sub>d</sub>: <b>${(state.results.Ed ?? '-')}</b> lbs/ft</li>
            <li>M<sub>max</sub> (your answer): <b>${(state.results.Mmax ?? '-')}</b> lbs·ft</li>
            <li>V<sub>max</sub> (your answer): <b>${(state.results.Vmax ?? '-')}</b> lbs</li>
          </ul>
        </div>`;
      }
      showScreen('resultScreen');
      updateProgress?.(6);
    }

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
  
      ctx.fillText(`Length: ${length} m`, originX + slabWpx + 8 * dpr, originY + slabHpx / 2);
  
      const bayStartX = originX, bayEndX = originX + spacing * scale, dimY = originY + slabHpx + 12 * dpr;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(bayStartX, dimY - 5 * dpr); ctx.lineTo(bayStartX, dimY + 5 * dpr);
      ctx.moveTo(bayEndX, dimY - 5 * dpr);   ctx.lineTo(bayEndX, dimY + 5 * dpr);
      ctx.moveTo(bayStartX, dimY); ctx.lineTo(bayEndX, dimY); ctx.stroke();
  
      const spacingLabel = `Spacing: ${spacing.toFixed(2)} m`;
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
        img.title = `Combined Load: ${combination}`;
        Object.assign(img.style, { width: '400px', height: 'auto', margin: '10px', border: '2px solid #333', borderRadius: '8px' });
        img.onerror = function () { this.style.display = 'none'; console.warn('Missing image:', this.src); };
        combinedImageDiv.appendChild(img);
  
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = combinedImageDiv.style.display === 'none'
          ? `Show Combined Loads (${combination})`
          : `Hide Combined Loads (${combination})`;
      } else {
        toggleBtn.style.display = 'none';
        combinedImageDiv.style.display = 'none';
      }
    }
  
    function toggleCombinedLoadImage() {
      const combinedImageDiv = $('combinedLoadImage');
      const toggleBtn = $('toggleCombinedBtn');
      if (!combinedImageDiv || !toggleBtn) return;
  
      const isVisible = combinedImageDiv.style.display !== 'none';
      combinedImageDiv.style.display = isVisible ? 'none' : 'block';
  
      const combo = toggleBtn.textContent.match(/\(([^)]+)\)/)?.[1] || '';
      toggleBtn.textContent = isVisible
        ? `Show Combined Loads (${combo})`
        : `Hide Combined Loads (${combo})`;
    }
  
    function toggleLoadImage(inputId, imgId) {
      const input = $(inputId);
      if (!input) return;
  
      if (inputId === 'windLoad') {
        const imgPositive = $('imgWindPositive');
        const imgNegative = $('imgWindNegative');
        if (!imgPositive || !imgNegative) return;
        imgPositive.style.display = 'none';
        imgNegative.style.display = 'none';
        on(input, 'input', () => {
          const v = parseFloat(input.value) || 0;
          imgPositive.style.display = 'none';
          imgNegative.style.display = 'none';
          if (v > 0) imgPositive.style.display = 'inline-block';
          else if (v < 0) imgNegative.style.display = 'inline-block';
          updateCombinedLoadImage();
        });
      } else {
        const img = $(imgId);
        if (!img) return;
        img.style.display = 'none';
        on(input, 'input', () => {
          const v = parseFloat(input.value) || 0;
          img.style.display = v > 0 ? 'inline-block' : 'none';
          updateCombinedLoadImage();
        });
      }
    }
  
    function initCompactComboUI() {
      const PSI_OPTS = [
        { label: 'No', value: 'none' },
        { label: '0.0', value: '0.0' }, { label: '0.1', value: '0.1' }, { label: '0.2', value: '0.2' },
        { label: '0.3', value: '0.3' }, { label: '0.4', value: '0.4' }, { label: '0.5', value: '0.5' },
        { label: '0.6', value: '0.6' }, { label: '0.7', value: '0.7' }, { label: '0.8', value: '0.8' },
        { label: '0.9', value: '0.9' }, { label: '1.0', value: '1.0' }
      ];
      const GAMMA_OPTS = [
        { label: 'No', value: 'none' },
        { label: '1.0', value: '1.0' },
        { label: '1.2', value: '1.2' },
        { label: '1.35', value: '1.35' },
        { label: '1.5', value: '1.5' }
      ];
  
      function fillSelectById(id, opts, defVal) {
        const el = $(id); if (!el) return;
        el.innerHTML = '';
        opts.forEach(o => {
          const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; el.appendChild(op);
        });
        if (defVal != null) el.value = defVal;
      }
  
      fillSelectById('gammaG', GAMMA_OPTS, '');
      fillSelectById('gammaQ', GAMMA_OPTS, '');
  
      ['mobile', 'wind', 'snow'].forEach(a => {
        fillSelectById(`psi0_${a}`, PSI_OPTS, '');
        fillSelectById(`psi1_${a}`, PSI_OPTS, '');
        fillSelectById(`psi2_${a}`, PSI_OPTS, '');
      });
  
      const leadRadios = document.querySelectorAll('input[name="leadingAction"]');
      function enforceAccDisabling() {
        const lead = document.querySelector('input[name="leadingAction"]:checked')?.value;
        ['mobile', 'wind', 'snow'].forEach(a => {
          const acc = $(`acc_${a}`);
          if (!acc) return;
          if (a === lead) { acc.checked = false; acc.disabled = true; }
          else acc.disabled = false;
        });
      }
      leadRadios.forEach(r => on(r, 'change', enforceAccDisabling));
      enforceAccDisabling();
    }
  
    function wireLimitState() {
      const chooseSLSBtn = $('chooseSLSBtn');
      const chooseULSBtn = $('chooseULSBtn');
      const selectedLimitState = $('selectedLimitState');
      const loadCaseScreen = $('loadCaseScreen');
  
      function setLimitStateText() {
        if (!selectedLimitState) return;
        if (state.currentLimitState) {
          selectedLimitState.innerText = `✅ Selected: ${state.currentLimitState}`;
          selectedLimitState.style.display = 'block';
        } else {
          selectedLimitState.textContent = '';
          selectedLimitState.style.display = 'none';
        }
      }
  
      function onLimitStateChange(changedId) {
        ['chooseSLSBtn', 'chooseULSBtn'].forEach(id => {
          if (id !== changedId) { const el = $(id); if (el) el.checked = false; }
        });
        state.currentLimitState = $('chooseULSBtn')?.checked ? 'ULS' : ($('chooseSLSBtn')?.checked ? 'SLS' : null);
        setLimitStateText();
        if (state.currentLimitState && loadCaseScreen) {
          loadCaseScreen.style.display = 'block';
          loadCaseScreen.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
      }
  
      on(chooseSLSBtn, 'change', () => onLimitStateChange('chooseSLSBtn'));
      on(chooseULSBtn, 'change', () => onLimitStateChange('chooseULSBtn'));
  
      if (chooseSLSBtn) chooseSLSBtn.checked = state.currentLimitState === 'SLS';
      if (chooseULSBtn) chooseULSBtn.checked = state.currentLimitState === 'ULS';
      setLimitStateText();
    }

      // ---------- Design load checks (bind to ALL matching buttons/inputs) ----------
    function wireDesignChecks() {
      function handleCheck(targetBtn) {
        // read the input within the same section (safer because of duplicate IDs)
        const container = targetBtn.closest('#designLoadSection, #designLoadSectionCombo') || document;
        const input = container.querySelector('input[type="number"]#designLoadInput') || $('designLoadInput');
        const feedbackBox = container.querySelector('#designLoadFeedback') || $('designLoadFeedback');

        const userVal = parseFloat(input?.value);
        const tol = 0.10;

        if (!Number.isFinite(userVal)) {
          alert('Please enter a valid design load value.');
          return;
        }
        if (!state.currentLimitState) {
          alert('Please select a limit state (ULS or SLS) first.');
          $('designChecksWrapper')?.scrollIntoView?.({ behavior: 'smooth' });
          return;
        }

        const combo = Eurocode.computeAll();
        if (combo.error) {
          alert(combo.error);
          $('loadCaseScreen')?.scrollIntoView?.({ behavior: 'smooth' });
          return;
        }

        const expected = (state.currentLimitState === 'ULS') ? combo.results.ULS : combo.results.SLS_rare;
        const expected2 = Number(expected.toFixed(2)); // The *correct* value, rounded to 2 decimal places
        const user2 = Number(userVal.toFixed(2));

        const ok = Math.abs(user2 - expected2) <= tol; // Check if user's value is within tolerance

        if (ok) {
          // ✅ SUCCESS BRANCH
          playSuccess();
          state.results = state.results || {};
          state.results.Ed = expected2;              // store verified Ed
          BadgeSystem.earn('designEd');              // unlock the 2nd badge

          if (feedbackBox) {
            feedbackBox.innerHTML = `✅ <strong>Correct.</strong> Expected E<sub>d</sub> = <strong>${expected2.toFixed(2)} kN/m</strong>`;
            feedbackBox.style.backgroundColor = '#e0f7e9';
            feedbackBox.style.borderLeft = '4px solid #2ecc71';
            feedbackBox.style.display = 'block';
            feedbackBox.style.padding = '10px';
          }

          // reveal the M/V panel (if it's on another screen) and navigate
          const mvPanel = document.getElementById('mvPanel');
          if (mvPanel) mvPanel.style.display = 'block';
          showScreen('dimensionScreen');             // go to M & V screen
          updateProgress(5);

        } else {
          // ❌ ERROR BRANCH
          playError();
          if (feedbackBox) {
            feedbackBox.innerHTML =
              `❌ <strong>Incorrect.</strong> Check your Psi and Gamma values!`;
            feedbackBox.style.backgroundColor = '#fff3cd';
            feedbackBox.style.borderLeft = '4px solid #f39c12';
            feedbackBox.style.display = 'block';
            feedbackBox.style.padding = '10px';
          }
        }
      }

      // Bind to BOTH “Submit Design Load” (inner) and “Check Design Load” (outer)
      document.querySelectorAll('#checkDesignLoadBtn, #checkDesignLoadBtn2').forEach(btn => {
        on(btn, 'click', (e) => { playClick(); handleCheck(e.currentTarget); });
      });

      // Also wire the “Continue to Beam Cross-Section” button to move to the M/V page,
      // in case the user prefers to navigate after seeing the correct Ed message.
      const goToMV1 = document.getElementById('continueDimensionBtnCombo'); // inner section button
      const goToMV2 = document.getElementById('continueToDesignLoadBtn');    // existing outer button
      [goToMV1, goToMV2].forEach(b =>
        on(b, 'click', () => {
          playClick();
          // require a verified Ed before moving on
          if (!state.results || state.results.Ed == null) {
            alert('Please verify Eₙ (Design Load) first.');
            return;
          }
          document.getElementById('mvPanel')?.style?.setProperty('display','block');
          showScreen('dimensionScreen');
          updateProgress(5);
        })
      );
    }

  
    // ---------- Tributary & gamification ----------
    function wireTributary() {
      on($('continueToTributaryBtn'), 'click', () => {
        playClick();
        showScreen('tributaryScreen');
  
        const originalCanvas = $('loadCanvas');
        const cloneCanvas = $('loadCanvasPreview');
        if (originalCanvas && cloneCanvas) {
          ensureHiDPI(cloneCanvas);
          drawImageFit(originalCanvas, cloneCanvas, '#e6f2fa');
        }
  
        const combinedOriginal = $('combinedLoadImage');
        const combinedClone = $('combinedImagePreview');
        if (combinedOriginal && combinedClone) combinedClone.innerHTML = combinedOriginal.innerHTML;
      });
  
      // Removed local variables tributaryPoints/tributaryAttempts, now using state.
  
      on($('submitLoadBtn'), 'click', () => {
        playClick();
        const tributaryWidth = parseFloat($('tributaryWidth')?.value);
        const selectedBeam = $('beamSelect')?.value;
        const beamNumber = parseInt((selectedBeam || '').replace('Beam ', ''), 10);
        const spacing = parseFloat($('inputWidth')?.value) / (state.beamCount - 1);
        const isEdgeBeam = beamNumber === 1 || beamNumber === state.beamCount;
        const expectedTributary = isEdgeBeam ? spacing / 2 : spacing;
        const tolerance = 0.1;
        const feedback = $('feedback');
        const gifContainer = $('feedbackGif');
  
        state.tributaryAttempts++; // Use state
  
        if (Math.abs(tributaryWidth - expectedTributary) <= tolerance) {
          playSuccess();
          if (state.tributaryAttempts === 1) { // Use state
            state.tributaryPoints += 20; // Use state (Bonus for first try)
            BadgeSystem.earn('accuracy');
          }
          if (feedback) {
            feedback.innerHTML = `✅ Correct! Tributary width for ${selectedBeam} is ${expectedTributary.toFixed(2)} m.<br>Points: ${state.tributaryPoints}`; // Use state
            feedback.style.backgroundColor = '#e0f7e9';
            feedback.style.borderLeft = '4px solid #2ecc71';
            feedback.style.display = 'block';
          }
          if (gifContainer) { gifContainer.src = './img/correct1.gif'; gifContainer.style.display = 'block'; }
  
          updateProgress(4);
          state.tributaryAttempts = 0; // Use state (Reset attempts on success)
  
          const designChecksWrapper = $('designChecksWrapper');
          const checkTypeScreen = $('checkTypeScreen');
          const loadCaseScreen = $('loadCaseScreen');
          if (designChecksWrapper) designChecksWrapper.style.display = 'block';
          if (checkTypeScreen) checkTypeScreen.style.display = 'block';
          if (loadCaseScreen) loadCaseScreen.style.display = 'none';
          checkTypeScreen?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  
        } else {
          state.tributaryPoints = Math.max(0, state.tributaryPoints - 10); // Use state & deduct points
          playError();
  
          let hint = '';
          if (state.tributaryAttempts === 1) hint = '💡 Hint: Is it an edge beam?'; // Use state
          else if (state.tributaryAttempts === 2) hint = '💡 Tributary width = half the spacing for edge beams, full spacing for interior beams.'; // Use state
          else if (state.tributaryAttempts >= 3) hint = `The correct value is ${expectedTributary.toFixed(2)} m. Try again!`; // Use state
  
          if (feedback) {
            feedback.innerHTML = `❌ Incorrect. Points: ${state.tributaryPoints} <br> ${hint}`; // Use state
            feedback.style.backgroundColor = '#fff3cd';
            feedback.style.borderLeft = '4px solid #f0ad4e';
            feedback.style.display = 'block';
          }
          const failGifs = ['./img/fail1.gif', './img/fail2.gif'];
          if (gifContainer) {
            gifContainer.src = failGifs[Math.floor(Math.random() * failGifs.length)];
            gifContainer.style.display = 'block';
          }
        }
      });
    }

    function initSaveHandler() {
      on($('saveLoadCombBtn'), 'click', () => {
        playClick();
        const combo = Eurocode.computeAll();
        if (combo.error) {
          alert(combo.error);
          return;
        }
        
        // Show the inner design load section
        const designSection = $('designLoadSectionCombo');
        if (designSection) {
          designSection.style.display = 'block';
          designSection.scrollIntoView?.({ behavior: 'smooth' });
        }
      });
    }
  
    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', () => {
      // Intro → slab
      on($('continueBtn'), 'click', () => {
        playClick();
        $('introScreen')?.classList.remove('active');
        $('canvasScreen')?.classList.add('active');
        updateProgress(1);
      });
  
      // Back from slab
      on($('backBtn'), 'click', () => {
        playClick();
        $('canvasScreen')?.classList.remove('active');
        $('introScreen')?.classList.add('active');
      });
  
      // Badges
      BadgeSystem.init([
        { id: 'accuracy',  title: 'Accuracy Ace', img: './img/badge1.png', soundId: 'badgeSound' },   // tributary correct on 1st try
        { id: 'designEd',  title: 'Design Load Pro', img: './img/badge2.png', soundId: 'badgeSound' },// unlocked when Ed is correct
        { id: 'strength',  title: 'Strength Solver', img: './img/badge3.png', soundId: 'badgeSound' } // unlocked when M & V both correct
      ]);

  
      // Slab → Loads (copy drawing smaller)
      on($('continueToLoadBtn'), 'click', () => {
        playClick();
        $('canvasScreen')?.classList.remove('active');
        $('loadScreen')?.classList.add('active');
        const loadCanvas = $('loadCanvas');
        const src = $('slabCanvas');
        if (loadCanvas && src) {
          ensureHiDPI(loadCanvas);
          drawImageFit(src, loadCanvas, '#e6f2fa');
        }
      });
  
      // Back to slab
      on($('backToSlabBtn'), 'click', () => {
        playClick();
        $('loadScreen')?.classList.remove('active');
        $('canvasScreen')?.classList.add('active');
      });
  
      // Draw slab
      on($('drawCanvasBtn'), 'click', () => {
        playClick();
        const width = parseFloat($('inputWidth')?.value);
        const length = parseFloat($('inputLength')?.value);
        const beamCount = parseInt($('inputBeamCount')?.value, 10);
  
        if (isNaN(width) || isNaN(length) || isNaN(beamCount) || beamCount < 2) {
          alert('Please enter valid slab dimensions and at least 2 beams.');
          return;
        }
  
        const spacing = width / (beamCount - 1);
        state.beamCount = beamCount;
  
        $('spacingInfo') && ( $('spacingInfo').textContent = `Calculated spacing: ${spacing.toFixed(2)} m` );
  
        drawSlab(width, length, spacing, beamCount);
        updateProgress(2);
  
        // Populate beam dropdown
        const sel = $('beamSelect');
        if (sel) {
          sel.innerHTML = '';
          for (let i = 1; i <= beamCount; i++) {
            const op = document.createElement('option');
            op.value = `Beam ${i}`; op.textContent = `Beam ${i}`;
            sel.appendChild(op);
          }
        }
      });

      // -- Go to Tributary screen --
      const contTrib = document.getElementById('continueToTributaryBtn');
      if (contTrib) {
        contTrib.type = 'button';        // make sure it doesn't submit anything
        contTrib.addEventListener('click', goToTributary);
      }

      
      function goToTributary() {
      playClick();
      showScreen('tributaryScreen');

      // clone load canvas → preview (fit-scaled)
      const originalCanvas = document.getElementById('loadCanvas');
      const cloneCanvas = document.getElementById('loadCanvasPreview');
      if (originalCanvas && cloneCanvas) {
        ensureHiDPI(cloneCanvas);
        drawImageFit(originalCanvas, cloneCanvas, '#e6f2fa');
      }

      // clone combined load image
      const combinedOriginal = document.getElementById('combinedLoadImage');
      const combinedClone = document.getElementById('combinedImagePreview');
      if (combinedOriginal && combinedClone) {
        combinedClone.innerHTML = combinedOriginal.innerHTML;
      }
    }

  
            // When the user clicks "Check M & V"
      on(document.getElementById('checkMvBtn'), 'click', () => {
        playClick?.();
        checkMAndV();
      });

      // Go to Summary
      on(document.getElementById('continueToSummaryBtn'), 'click', () => {
        playClick?.();
        showSummary();
      });

      
      // Load images and combined preview
      toggleLoadImage('permanentLoad', 'imgPermanent');
      toggleLoadImage('snowLoad', 'imgSnow');
      toggleLoadImage('windLoad', null);
      toggleLoadImage('mobileLoad', 'imgMobile');
      updateCombinedLoadImage();
      on($('toggleCombinedBtn'), 'click', () => { playClick(); toggleCombinedLoadImage(); updateProgress(3); });
  
      // Hints
      on($('hintPsiBtn'), 'click', () => { $('hintImage') && ($('hintImage').src = './img/psi-factors.PNG'); $('hintModal') && ( $('hintModal').style.display = 'flex' ); });
      on($('hintGammaBtn'), 'click', () => { $('hintImage') && ($('hintImage').src = './img/gamma-factors.PNG'); $('hintModal') && ( $('hintModal').style.display = 'flex' ); });
      on($('closeHintModal'), 'click', () => { $('hintModal') && ( $('hintModal').style.display = 'none' ); });
  
      // Limit state + compact table
      wireLimitState();
      initCompactComboUI();
  
      // Save selection & design checks
      initSaveHandler();
      wireDesignChecks();
  
      // Tributary flow
      wireTributary();
  
      // Misc nav buttons present later in the doc
      on($('backToLoadBtn'), 'click', () => { playClick(); showScreen('loadScreen'); });
      on($('continueToDesignLoadBtn'), 'click', () => { 
        playClick(); 
        if (!state.results || state.results.Ed == null) {
          alert('Please verify Ed (Design Load) first.');
          return;
        }
        $('mvPanel')?.style?.setProperty('display','block');
        showScreen('dimensionScreen'); 
        updateProgress(5);
      });
      // Add to dimensionScreen
      on($('backToDesignLoadBtn2'), 'click', () => { 
        playClick(); 
        showScreen('tributaryScreen'); 
      });
    });

  })();




