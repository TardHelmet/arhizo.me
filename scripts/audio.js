// The site as instrument: a small modular-synth-ish patch.
// Voices (triangle osc + envelope) -> lowpass -> feedback delay -> master.
// Every letter maps deterministically to a pitch in A minor pentatonic,
// so the page has a key signature.
window.arhizomeAudio = (() => {
    let ctx = null;
    let master, filter, delay, feedback, delaySend;
    let muted = false;
    const voices = [];
    const MAX_VOICES = 16;

    // A minor pentatonic (A C D E G) spread over ~2.5 octaves, rooted at A3.
    const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29];
    const BASE = 220;

    function ensure() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();

            master = ctx.createGain();
            master.gain.value = 0.5;
            master.connect(ctx.destination);

            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2500;
            filter.Q.value = 0.7;
            filter.connect(master);

            delay = ctx.createDelay(1.0);
            delay.delayTime.value = 0.375;
            feedback = ctx.createGain();
            feedback.gain.value = 0.35;
            delaySend = ctx.createGain();
            delaySend.gain.value = 0.3;

            filter.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(delaySend);
            delaySend.connect(master);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function freqFor(char) {
        const code = char.toLowerCase().charCodeAt(0);
        const i = code >= 97 && code <= 122 ? code - 97 : code;
        return BASE * Math.pow(2, SCALE[i % SCALE.length] / 12);
    }

    function spawn(freq, time, peak, decay) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(peak, time + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, time + decay);

        osc.connect(env);
        env.connect(filter);
        osc.start(time);
        osc.stop(time + decay + 0.05);

        voices.push({ osc, env });
        if (voices.length > MAX_VOICES) {
            const old = voices.shift();
            try {
                old.env.gain.cancelScheduledValues(ctx.currentTime);
                old.env.gain.setValueAtTime(old.env.gain.value, ctx.currentTime);
                old.env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
                old.osc.stop(ctx.currentTime + 0.05);
            } catch (e) { /* already stopped */ }
        }
        osc.onended = () => {
            const idx = voices.findIndex(v => v.osc === osc);
            if (idx !== -1) voices.splice(idx, 1);
        };
    }

    function playNote(char) {
        if (muted || !ensure()) return;
        spawn(freqFor(char), ctx.currentTime, 0.12, 0.45);
    }

    // A short rising affirmation for when the hidden message completes.
    function playMelody() {
        if (muted || !ensure()) return;
        const phrase = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 880];
        phrase.forEach((freq, i) => {
            spawn(freq, ctx.currentTime + i * 0.17, 0.15, 0.9);
        });
    }

    return {
        ensure,
        playNote,
        playMelody,
        setMuted(value) { muted = value; },
        isMuted() { return muted; }
    };
})();
