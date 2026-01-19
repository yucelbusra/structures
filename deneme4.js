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
        totalLoad: 0,
        confirmedTrib: 0, // Stores the correctly verified tributary width
        confirmedW: 0,    // Stores the correctly verified line load
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

    // --- LOGIC: 1. TOTAL LOAD SUM ---
    function checkTotalSum() {
        const dead = parseFloat($('permanentLoad').value) || 0;
        const snow = parseFloat($('snowLoad').value) || 0;
        const wind = Math.abs(parseFloat($('windLoad').value) || 0);
        const live = parseFloat($('mobileLoad').value) || 0;
        
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
            
            state.totalLoad = expectedSum;
            contBtn.style.display = 'inline-block';
            contBtn.disabled = false;
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ Incorrect.<br><strong>Hint:</strong> Sum all entered loads: ${dead} + ${snow} + ${wind} + ${live}`;
            play('errorSound');
            contBtn.style.display = 'none';
        }
    }

    // --- LOGIC: 2. TRIBUTARY (Step A) ---
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
            
            state.confirmedTrib = expected;
            // Reveal Step B
            $('stepB_LineLoad').style.display = 'block';
            $('stepB_LineLoad').scrollIntoView({ behavior: 'smooth' });
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ Incorrect. <br>Hint: Interior beams = spacing ($s$). Edge beams = half spacing ($s/2$).`;
            play('errorSound');
        }
    }

    // --- LOGIC: 3. LINE LOAD (Step B) ---
    function checkLineLoad() {
        // w = Total Load * Tributary Width
        const expectedW = state.totalLoad * state.confirmedTrib;
        const userW = parseFloat($('inputLineLoad').value);
        const fb = $('lineLoadFeedback');
        
        fb.style.display = 'block';
        
        // Tolerance: relative 2% or absolute 1
        const diff = Math.abs(userW - expectedW);
        const isCorrect = diff < (expectedW * 0.02 + 1);

        if (isCorrect) {
            fb.className = 'success-box';
            fb.innerHTML = `✅ Correct! Line Load ($w$) = <strong>${expectedW.toFixed(2)} lbs/ft</strong>.`;
            play('successSound');
            
            state.confirmedW = expectedW;
            // Reveal Step C
            $('stepC_Forces').style.display = 'block';
            $('stepC_Forces').scrollIntoView({ behavior: 'smooth' });
        } else {
            fb.className = 'error-box';
            fb.innerHTML = `❌ Incorrect.<br>Hint: Multiply Total Load (${state.totalLoad.toFixed(1)}) by Tributary Width (${state.confirmedTrib.toFixed(2)}).`;
            play('errorSound');
        }
    }

    // --- LOGIC: 4. FORCES (Step C) ---
    function checkForces() {
        const w = state.confirmedW; // Must use the verified line load
        const L = parseFloat($('inputLength').value);
        
        const expV = (w * L) / 2;
        const expM = (w * L * L) / 8;
        
        const uV = parseFloat($('inputVmax').value);
        const uM = parseFloat($('inputMmax').value);
        const uDef = parseFloat($('inputDelta').value);

        const fb = $('forcesFeedback');
        fb.style.display = 'block';

        // Tolerance 5%
        const check = (user, real) => Math.abs(user - real) < (real * 0.05 + 1.0);

        let errors = [];
        if (!check(uV, expV)) errors.push(`Max Shear ($V_{max}$) seems wrong. Expected approx ${expV.toFixed(1)}.`);
        if (!check(uM, expM)) errors.push(`Max Moment ($M_{max}$) seems wrong. Expected approx ${expM.toFixed(1)}.`);
        if (isNaN(uDef) || uDef <= 0) errors.push(`Deflection ($\delta_{max}$) must be a positive number.`);

        // Store results for summary
        state.results = { uV, uM, uDef, expW: w };

        if (errors.length === 0) {
            fb.className = 'success-box';
            fb.innerHTML = `✅ <strong>Perfect Design!</strong><br>All values are correct.`;
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
            <p><strong>Status:</strong> Design Completed</p>
            <hr>
            <p><strong>Total Surface Load:</strong> ${state.totalLoad.toFixed(2)} psi</p>
            <p><strong>Line Load (w):</strong> ${state.confirmedW.toFixed(2)} lbs/ft</p>
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

        // Calculations
        on($('checkTotalLoadBtn'), 'click', () => { play('clickSound'); checkTotalSum(); });
        on($('submitTribBtn'), 'click', () => { play('clickSound'); checkTributary(); });
        on($('checkLineLoadBtn'), 'click', () => { play('clickSound'); checkLineLoad(); });
        on($('checkForcesBtn'), 'click', () => { play('clickSound'); checkForces(); });
        
        on($('continueToSummaryBtn'), 'click', () => { play('clickSound'); showSummary(); });

        drawSlab();
    });

})();
