document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'arhizome-memory';
    const MESSAGE = 'WHEN YOU DO NOT KNOW WHAT TO DO YOU SHOULD TRY SOMETHING';
    const WORDS = MESSAGE.split(' ');
    const CONTACT_TEXT = 'CONTACT ME';
    const DIM = 'rgba(255, 255, 255, 0.45)';
    const CORPUS_FONT = '10px Arial';
    const MESSAGE_FONT = '14px Arial';
    const MAX_LOG = 800;

    const container = document.getElementById('backgroundText');
    const contactLink = document.querySelector('.contact-link');
    const soundToggle = document.getElementById('soundToggle');
    const audio = window.arhizomeAudio;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.createElement('canvas');
    const octx = overlay.getContext('2d');
    overlay.className = 'assembly-canvas';

    let memory = loadMemory();
    let letterPositions = new Map();
    let messageGlyphs = [];
    let highlightedPositions = new Set();
    let currentAnimation = null;
    let wordsLit = 0;
    let forgetBuffer = '';
    let cursorTimer = null;
    let cursorOn = false;
    let assembled = false;
    let locked = false;

    function loadMemory() {
        const fallback = { v: 1, keys: [], muted: false, done: false };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return fallback;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.keys)) return fallback;
            return {
                v: 1,
                keys: data.keys.slice(-MAX_LOG),
                muted: !!data.muted,
                done: !!data.done
            };
        } catch (e) {
            return fallback;
        }
    }

    function saveMemory() {
        try {
            memory.keys = memory.keys.slice(-MAX_LOG);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
        } catch (e) { /* private mode etc. — the site simply forgets */ }
    }

    function initializeCanvas() {
        const updateCanvasSize = () => {
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            overlay.width = container.offsetWidth;
            overlay.height = container.offsetHeight;
        };
        updateCanvasSize();
        window.addEventListener('resize', () => {
            updateCanvasSize();
            layout();
            redraw();
        });
        container.appendChild(canvas);
        container.appendChild(overlay);
    }

    function layout() {
        letterPositions.clear();
        messageGlyphs = [];

        // Corpus: lay out only what fits on screen.
        ctx.font = CORPUS_FONT;
        const lineHeight = 11;
        const widthCache = new Map();
        let x = 5;
        let y = lineHeight;

        for (let i = 0; i < siteText.length && y <= canvas.height; i++) {
            const char = siteText[i];
            let charWidth = widthCache.get(char);
            if (charWidth === undefined) {
                charWidth = ctx.measureText(char).width;
                widthCache.set(char, charWidth);
            }
            if (x + charWidth > canvas.width - 10) {
                x = 5;
                y += lineHeight;
                if (y > canvas.height) break;
            }
            if (char !== ' ') {
                const key = char.toLowerCase();
                if (!letterPositions.has(key)) letterPositions.set(key, []);
                letterPositions.get(key).push({ x, y, char });
            }
            x += charWidth + 0.5;
        }

        // Hidden message: staircase of words down the left side.
        const msgLine = 20;
        const indent = 50;
        let my = msgLine * 3;
        for (let w = 0; w < WORDS.length; w++) {
            const word = WORDS[w];
            const wx = (w % 5) * indent + 20;
            for (let j = 0; j < word.length; j++) {
                messageGlyphs.push({ char: word[j], x: wx + j * 8, y: my, word: w });
            }
            my += msgLine;
            if ((w + 1) % 5 === 0) my += msgLine * 1.5;
        }
    }

    function paintCorpusChar(pos, style) {
        ctx.font = CORPUS_FONT;
        ctx.fillStyle = style;
        ctx.fillText(pos.char, pos.x, pos.y);
        highlightedPositions.add(`${pos.x},${pos.y}`);
    }

    function paintWord(w) {
        ctx.font = MESSAGE_FONT;
        ctx.fillStyle = 'white';
        for (const g of messageGlyphs) {
            if (g.word === w) ctx.fillText(g.char, g.x, g.y);
        }
    }

    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        highlightedPositions.clear();

        const awakened = new Set(memory.keys.map(k => k.toLowerCase()));
        for (const letter of awakened) {
            const positions = letterPositions.get(letter);
            if (!positions) continue;
            for (const pos of positions) paintCorpusChar(pos, DIM);
        }
        for (let w = 0; w < wordsLit; w++) paintWord(w);
        if (cursorTimer && cursorOn) paintCursor();
    }

    // --- blinking cursor: the only thing a first-time visitor sees ---

    function cursorRect() {
        return { x: Math.round(canvas.width / 2) - 5, y: Math.round(canvas.height / 2) - 9 };
    }

    function paintCursor() {
        const { x, y } = cursorRect();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, y, 10, 18);
    }

    function eraseCursor() {
        const { x, y } = cursorRect();
        ctx.clearRect(x - 1, y - 1, 12, 20);
    }

    function startCursor() {
        if (cursorTimer) return;
        cursorOn = true;
        paintCursor();
        cursorTimer = setInterval(() => {
            cursorOn = !cursorOn;
            cursorOn ? paintCursor() : eraseCursor();
        }, 550);
    }

    function stopCursor() {
        if (!cursorTimer) return;
        clearInterval(cursorTimer);
        cursorTimer = null;
        eraseCursor();
    }

    // --- cascading awakening (with sound) ---

    function startCascadingHighlight(letter) {
        if (currentAnimation) cancelAnimationFrame(currentAnimation.id);
        currentAnimation = null;

        const positions = letterPositions.get(letter.toLowerCase());
        if (!positions) return;

        const unhighlighted = positions.filter(pos => !highlightedPositions.has(`${pos.x},${pos.y}`));
        if (unhighlighted.length === 0) return;

        for (let i = unhighlighted.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unhighlighted[i], unhighlighted[j]] = [unhighlighted[j], unhighlighted[i]];
        }

        let index = 0;
        let delay = 300;
        let lastTime = 0;
        let timeSinceLastHighlight = 0;
        let acceleration = 1.0;

        function animate(currentTime) {
            if (!lastTime) lastTime = currentTime;
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            timeSinceLastHighlight += deltaTime;

            if (timeSinceLastHighlight >= delay) {
                // Once the accelerando saturates, awaken in growing batches so
                // common letters (thousands of instances) finish in seconds.
                const batch = Math.max(1, Math.floor((acceleration - 8) / 2));
                for (let b = 0; b < batch && index < unhighlighted.length; b++, index++) {
                    paintCorpusChar(unhighlighted[index], DIM);
                }
                audio.playNote(letter);

                timeSinceLastHighlight = 0;
                acceleration += 0.2;
                delay = Math.max(10, 300 / acceleration);
            }

            if (index < unhighlighted.length) {
                currentAnimation = { id: requestAnimationFrame(animate), letter };
            } else {
                currentAnimation = null;
            }
        }

        currentAnimation = { id: requestAnimationFrame(animate), letter };
    }

    // --- interactions: every attempt awakens a word of the message ---

    function interact(char) {
        if (locked) return;
        stopCursor();

        memory.keys.push(char);
        const target = Math.min(memory.keys.length, WORDS.length);
        while (wordsLit < target) {
            paintWord(wordsLit);
            wordsLit++;
        }
        saveMemory();

        startCascadingHighlight(char);

        if (wordsLit === WORDS.length && !memory.done) {
            memory.done = true;
            saveMemory();
            setTimeout(() => {
                audio.playMelody();
                setTimeout(() => assembleContact(false), 1400);
            }, 600);
        }
    }

    function handleKeydown(event) {
        if (event.key.length !== 1 || event.repeat) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        audio.ensure();

        forgetBuffer = (forgetBuffer + event.key).slice(-6).toLowerCase();
        if (forgetBuffer === 'forget') {
            forgetBuffer = '';
            forget();
            return;
        }
        interact(event.key);
    }

    function handleClick() {
        if (locked) return;
        audio.ensure();

        // A touch is a wandering keypress: pick a letter that still has
        // something left to awaken.
        const candidates = [];
        for (const [letter, positions] of letterPositions) {
            if (positions.some(pos => !highlightedPositions.has(`${pos.x},${pos.y}`))) {
                candidates.push(letter);
            }
        }
        const letter = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        interact(letter);
    }

    // --- CONTACT ME assembles itself out of the text ---

    function assembleContact(quick) {
        if (assembled) return;
        assembled = true;

        const style = getComputedStyle(contactLink);
        const fontPx = parseFloat(style.fontSize);
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const rect = contactLink.getBoundingClientRect();
        const baseline = rect.top + fontPx * 0.8;

        octx.font = font;
        const letters = [];
        let advance = rect.left;
        for (let i = 0; i < CONTACT_TEXT.length; i++) {
            const char = CONTACT_TEXT[i];
            const width = octx.measureText(char).width;
            if (char !== ' ') {
                const sources = letterPositions.get(char.toLowerCase()) || [];
                const src = sources.length > 0
                    ? sources[Math.floor(Math.random() * sources.length)]
                    : { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
                const tx = advance;
                const ty = baseline;
                letters.push({
                    char,
                    sx: src.x, sy: src.y,
                    tx, ty,
                    // control point bends each flight path a little differently
                    cx: (src.x + tx) / 2 + (Math.random() - 0.5) * canvas.width * 0.4,
                    cy: (src.y + ty) / 2 + (Math.random() - 0.5) * canvas.height * 0.4,
                    start: (quick ? 60 : 140) * letters.length,
                    dur: quick ? 900 : 1600,
                    landed: false
                });
            }
            advance += width;
        }

        const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        let t0 = null;

        function frame(now) {
            if (t0 === null) t0 = now;
            const elapsed = now - t0;
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.fillStyle = 'white';

            let allLanded = true;
            for (const l of letters) {
                const raw = (elapsed - l.start) / l.dur;
                if (raw < 0) { allLanded = false; continue; }
                const t = ease(Math.min(1, raw));
                const u = 1 - t;
                const x = u * u * l.sx + 2 * u * t * l.cx + t * t * l.tx;
                const y = u * u * l.sy + 2 * u * t * l.cy + t * t * l.ty;
                const size = 10 + (fontPx - 10) * t;
                octx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
                octx.fillText(l.char, x, y);
                if (raw < 1) {
                    allLanded = false;
                } else if (!l.landed) {
                    l.landed = true;
                    audio.playNote(l.char);
                }
            }

            if (!allLanded) {
                requestAnimationFrame(frame);
            } else {
                setTimeout(() => {
                    contactLink.classList.add('revealed');
                    octx.clearRect(0, 0, overlay.width, overlay.height);
                }, 250);
            }
        }
        requestAnimationFrame(frame);
    }

    // --- FORGET: deterritorialize ---

    function forget() {
        locked = true;
        stopCursor();
        if (currentAnimation) cancelAnimationFrame(currentAnimation.id);
        currentAnimation = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* nothing to forget */ }

        contactLink.classList.remove('revealed');
        canvas.style.transition = 'opacity 2s ease';
        overlay.style.transition = 'opacity 2s ease';
        canvas.style.opacity = '0';
        overlay.style.opacity = '0';

        setTimeout(() => {
            memory = { v: 1, keys: [], muted: memory.muted, done: false };
            wordsLit = 0;
            assembled = false;
            highlightedPositions.clear();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            octx.clearRect(0, 0, overlay.width, overlay.height);
            canvas.style.transition = 'opacity 1.2s ease';
            overlay.style.transition = 'opacity 1.2s ease';
            canvas.style.opacity = '1';
            overlay.style.opacity = '1';
            locked = false;
            startCursor();
        }, 2100);
    }

    // --- sound toggle ---

    function reflectMute() {
        audio.setMuted(memory.muted);
        soundToggle.classList.toggle('muted', memory.muted);
    }

    soundToggle.addEventListener('click', () => {
        memory.muted = !memory.muted;
        saveMemory();
        reflectMute();
        if (!memory.muted) {
            audio.ensure();
            audio.playNote('a');
        }
    });

    // --- boot: restore everything this browser has ever awakened ---

    initializeCanvas();
    reflectMute();
    document.fonts.ready.then(() => {
        layout();
        wordsLit = Math.min(memory.keys.length, WORDS.length);
        redraw();
        if (memory.done) {
            setTimeout(() => assembleContact(true), 800);
        } else if (memory.keys.length === 0) {
            startCursor();
        }
    });

    document.addEventListener('keydown', handleKeydown);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleClick();
    }, { passive: false });
});
