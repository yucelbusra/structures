(function () {
    // --- HELPERS ---
    const $ = (id) => document.getElementById(id);
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

    // --- SOUNDS ---
    const play = (id) => $(id)?.play?.().catch(() => {}); 
    
    // --- BADGES ---
    const BadgeSystem = {
        earned: new Set(),
        init() { this.render(); },
        earn(id, title) {
            if (this.earned.has(id)) return;
            this.earned.add(id);
            this.render();
            play('badgeSound');
            
            const banner = $('badgeNotification');
            banner.innerHTML = `🎉 Earned Badge: ${title}`;
            banner.style.display = 'block';
            banner.style.animation = 'fadeInOut 3s forwards';
            setTimeout(() => banner.style.display = 'none', 3000);
        },
        render() {
            const container = $('badgeBar');
            container.innerHTML = '';
            const badges = [
                { id: 'load', img: './img/badge2.png', title: 'Load Specialist' },
                { id: 'geo', img: './img/badge1.png', title: 'Geometry Guru' },
                { id: 'eng', img: './img/badge3.png', title: 'Chief Engineer' }
            ];
            badges.forEach(b => {
                const img = document.createElement('img');
                img.className = `badge ${this.earned.has(b.id) ? '' : 'locked'}`;
                img.src = b.img;
                img.title = b.title;
                container.appendChild(img);
            });
        }
    };

    // --- STATE ---
    const state = {
        beamCount: 0,
        totalLoad: 0, // Stores the verified total load (sum)
        results: {}
    };

    // --- CANVAS FUNCTIONS ---
    function ensureHiDPI(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        return { ctx: canvas.getContext('2d'), width: canvas.width, height: canvas.height, dpr };
    }

    function drawSlab() {
        const canvas = $('slabCanvas');
        const { ctx, width, height, dpr } = ensureHiDPI(canvas);
        
        const W_ft = parseFloat($('inputWidth').value) || 0;
        const L_ft = parseFloat($('inputLength').value) || 0;
        const count = parseInt($('inputBeamCount').value) || 0;
        
        ctx.fillStyle = '#e6f2fa';
        ctx.fillRect(0, 0, width, height);

        if (W_ft <= 0 || L_ft <= 0 || count < 2) return;

        const padding = 40 * dpr;
        const drawW = width - 2 * padding;
        const drawH = height - 2 * padding;
        const scale = Math.min(drawW / W_ft, drawH / L_ft);
        
        const slabPxW = W_ft * scale;
        const slabPxH = L_ft * scale;
        const startX = (width - slabPxW) / 2;
        const startY = (height - slabPxH) / 2;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3 * dpr;
        ctx.strokeRect(startX, startY, slabPxW, slabPxH);

        const spacingFt = W_ft / (count - 1);
        ctx.strokeStyle = '#0077cc';
        ctx.lineWidth = 2 * dpr;
        ctx.fillStyle = '#003366';
        ctx.font = `${12 * dpr}px sans-serif`;

        for (let i = 0; i < count; i++) {
            const x = startX + (i * spacingFt * scale);
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, startY + slabPxH);
            ctx.stroke();
            const txt = `Beam ${i+1}`;
            const txtW = ctx.measureText(txt).width;
            ctx.fillText(txt, x - txtW/2, startY - 10 * dpr);
        }

        $('spacingInfo').textContent = `Spacing (s): ${spacingFt.toFixed(2)} ft`;
        state.beamCount = count;
        
        const sel = $('beamSelect');
        const currentSel = sel.value;
        sel.innerHTML = '';
        for(let i=1; i<=count; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = `Beam ${i}`;
            sel.appendChild(opt);
        }
        if(currentSel) sel.value = currentSel;
    }

    function copyCanvas(sourceId, targetId) {
        const src = $(sourceId);
        const tgt = $(targetId);
        const ctxT = tgt.getContext('2d');
        tgt.width = src.width;
        tgt.height = src.height;
        ctxT.drawImage(src, 0, 0);
    }

    // --- LOGIC: TOTAL LOAD SUM ---
    function checkTotalSum() {
        const dead = parseFloat($('permanentLoad').value) || 0;
        const snow = parseFloat($('snowLoad').value) || 0;
        const wind = Math.abs(parseFloat($('windLoad').value) || 0);
        const live = parseFloat($('mobileLoad').value) || 0;
        
        // As requested: Sum of all loads entered
        const expectedSum = dead + snow + wind + live;
        
        const userSum = parseFloat($('inputTotalLoad').value);
        const fb = $('loadFeedback');
        const contBtn = $('continueToTributaryBtn');
        
        fb.style.display = 'block';

        if (Math.abs(userSum - expectedSum) <= 0.1) {
            fb.className = 'success-box';
            fb.innerHTML = `✅ Correct! Total Load = <strong>${expectedSum.toFixed(1)} psi</strong>`;
            play('successSound');
            BadgeSystem.earn('load', 'Load Specialist');
            
            // Unlock next step
            state.totalLoad = expectedSum;
            contBtn.style.display = 'inline-block';
            contBtn.disabled = false;
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ Incorrect.<br><strong>Hint:</strong> Just add all the load values together:<br> Dead + Snow + |Wind| + Live`;
            play('errorSound');
            contBtn.style.display = 'none';
        }
    }

    // --- LOGIC: TRIBUTARY ---
    function checkTributary() {
        const userVal = parseFloat($('tributaryWidth').value);
        const beamIdx = parseInt($('beamSelect').value);
        const W = parseFloat($('inputWidth').value);
        const count = state.beamCount;
        const spacing = W / (count - 1);
        
        const isEdge = (beamIdx === 1 || beamIdx === count);
        const expected = isEdge ? (spacing / 2) : spacing;

        const fb = $('tribFeedback');
        fb.style.display = 'block';

        if (Math.abs(userVal - expected) < 0.1) {
            fb.className = 'success-box';
            fb.innerHTML = `✅ Correct! Tributary width for Beam ${beamIdx} is <strong>${expected.toFixed(2)} ft</strong>.`;
            play('successSound');
            BadgeSystem.earn('geo', 'Geometry Guru');
            
            $('finalCalcSection').style.display = 'block';
            $('finalCalcSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ Incorrect. <br>Hint: Interior beams carry full spacing ($s$). Edge beams carry half ($s/2$).`;
            play('errorSound');
        }
    }

    // --- LOGIC: FINAL VALUES ---
    function calculateExpectedValues() {
        // Line Load (w) = Total Pressure Load * Tributary Width
        // NOTE: Previous prompt used ULS factors. This prompt emphasized "Total Load Entered".
        // To be consistent with "Design Load" passed from Step 3, we use state.totalLoad (the sum).
        
        const trib = parseFloat($('tributaryWidth').value);
        
        // 1. Line Load w (lbs/ft)
        const w = state.totalLoad * trib; 

        // 2. Beam Forces
        const L = parseFloat($('inputLength').value);
        const Vmax = (w * L) / 2;
        const Mmax = (w * L * L) / 8;

        return { w, Vmax, Mmax };
    }

    function checkFinalDesign() {
        const exp = calculateExpectedValues();
        
        const uEd = parseFloat($('inputEd').value); // Line load input
        const uV = parseFloat($('inputVmax').value);
        const uM = parseFloat($('inputMmax').value);
        const uDef = parseFloat($('inputDelta').value);

        const fb = $('finalFeedback');
        fb.style.display = 'block';

        // Tolerance 5%
        const check = (user, real) => Math.abs(user - real) < (real * 0.05 + 0.5);

        let errors = [];
        if (!check(uEd, exp.w)) errors.push(`Line Load ($w$) seems wrong. <br>Hint: Total Load (${state.totalLoad}) × Tributary Width.`);
        if (!check(uV, exp.Vmax)) errors.push(`Max Shear ($V_{max}$) seems wrong. Expected approx ${exp.Vmax.toFixed(1)}.`);
        if (!check(uM, exp.Mmax)) errors.push(`Max Moment ($M_{max}$) seems wrong. Expected approx ${exp.Mmax.toFixed(1)}.`);
        if (isNaN(uDef) || uDef <= 0) errors.push(`Deflection ($\delta_{max}$) must be a positive number.`);

        // Store results for summary
        state.results = { uEd, uV, uM, uDef, expEd: exp.w };

        if (errors.length === 0) {
            fb.className = 'success-box';
            fb.innerHTML = `✅ <strong>Perfect Design!</strong><br>All values are within tolerance.`;
            play('successSound');
            BadgeSystem.earn('eng', 'Chief Engineer');
            $('continueToSummaryBtn').style.display = 'inline-block';
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ <strong>Review Needed:</strong><ul><li>${errors.join('</li><li>')}</li></ul>`;
            play('errorSound');
        }
    }

    function showSummary() {
        const s = $('resultScreen');
        const content = $('finalScore');
        
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        s.classList.add('active');
        $('step5').classList.add('completed');

        content.innerHTML = `
            <h3>Final Report</h3>
            <p><strong>Status:</strong> Passed</p>
            <hr>
            <p><strong>Total Surface Load:</strong> ${state.totalLoad.toFixed(2)} psi</p>
            <p><strong>Line Load (w):</strong> ${state.results.uEd} lbs/ft</p>
            <p><strong>Max Shear:</strong> ${state.results.uV} lbs</p>
            <p><strong>Max Moment:</strong> ${state.results.uM} lbs-ft</p>
            <p><strong>Badges Earned:</strong> ${BadgeSystem.earned.size} / 3</p>
        `;
    }

    // --- NAVIGATION ---
    function goto(id, stepNum) {
        play('clickSound');
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $(id).classList.add('active');
        
        for(let i=1; i<=5; i++) {
            const el = $(`step${i}`);
            if(i <= stepNum) el.classList.add('completed');
            else el.classList.remove('completed');
        }

        if(id === 'tributaryScreen') {
            copyCanvas('slabCanvas', 'loadCanvasPreview');
        }
    }

    // --- INIT ---
    document.addEventListener('DOMContentLoaded', () => {
        BadgeSystem.init();

        on($('continueBtn'), 'click', () => goto('canvasScreen', 1));
        
        on($('drawCanvasBtn'), 'click', () => { play('clickSound'); drawSlab(); });
        
        on($('continueToLoadBtn'), 'click', () => { 
            drawSlab(); 
            goto('loadScreen', 2); 
            setTimeout(() => copyCanvas('slabCanvas', 'loadCanvas'), 50);
        });
        
        on($('backBtn'), 'click', () => goto('introScreen', 0));
        
        on($('backToSlabBtn'), 'click', () => goto('canvasScreen', 1));
        
        on($('continueToTributaryBtn'), 'click', () => goto('tributaryScreen', 3));
        
        // Visual Toggles
        const loadInputs = ['permanentLoad', 'snowLoad', 'mobileLoad'];
        loadInputs.forEach(id => {
            on($(id), 'input', (e) => {
               const img = $(`img${id.replace('Load','').replace(/^\w/, c => c.toUpperCase())}`);
               if(img) img.style.display = parseFloat(e.target.value) > 0 ? 'inline-block' : 'none';
            });
        });
        on($('windLoad'), 'input', (e) => {
            const v = parseFloat(e.target.value);
            $('imgWindPositive').style.display = v > 0 ? 'inline-block' : 'none';
            $('imgWindNegative').style.display = v < 0 ? 'inline-block' : 'none';
        });

        // Main Interaction Buttons
        on($('checkTotalLoadBtn'), 'click', () => { play('clickSound'); checkTotalSum(); });
        on($('submitTribBtn'), 'click', () => { play('clickSound'); checkTributary(); });
        on($('checkFinalValuesBtn'), 'click', () => { play('clickSound'); checkFinalDesign(); });
        on($('continueToSummaryBtn'), 'click', () => { play('clickSound'); showSummary(); });

        drawSlab();
    });

})();
