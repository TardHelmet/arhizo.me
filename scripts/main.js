document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('backgroundText');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let letterPositions = new Map();
    let highlightedPositions = new Set();
    let currentAnimation = null;

    const messageToHighlight = "WHEN YOU DO NOT KNOW WHAT TO DO YOU SHOULD TRY SOMETHING";
    const messageWords = messageToHighlight.split(' ');
    let messageIndices = [];

    function initializeCanvas() {
        const updateCanvasSize = () => {
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        };
        updateCanvasSize();
        window.addEventListener('resize', () => {
            updateCanvasSize();
            drawText();
        });
        container.appendChild(canvas);
    }

    function findMessageLetters() {
        const text = siteText.toUpperCase();
        let foundIndices = [];
        let currentSearchStart = 0;

        // Calculate word positions
        const lineHeight = 20; // Increased line height
        const indentSize = 50; // Increased indent size
        let y = lineHeight * 3; // Start a few lines down
        let wordGroup = 0;

        ctx.font = '14px Arial'; // Larger font for message

        for (let i = 0; i < messageWords.length; i++) {
            const word = messageWords[i];
            const wordIndex = i % 5; // Reset every 5 words
            const x = (wordIndex * indentSize) + 20; // More left padding

            // Find each letter in the word
            for (let j = 0; j < word.length; j++) {
                const letter = word[j];
                if (letter === ' ') continue;

                const index = text.indexOf(letter, currentSearchStart);
                if (index !== -1) {
                    foundIndices.push({
                        index,
                        x: x + (j * 8), // Wider letter spacing
                        y: y,
                        isMessage: true
                    });
                    currentSearchStart = index + 1;
                }
            }

            // Move to next line
            y += lineHeight;
            
            // Reset position after every 5 words
            if ((i + 1) % 5 === 0) {
                y += lineHeight * 1.5; // More space between groups
                wordGroup++;
            }
        }

        return foundIndices;
    }

    function drawText() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        letterPositions.clear();
        highlightedPositions.clear();

        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        
        const lineHeight = 11;
        const text = siteText;
        let x = 5;
        let y = lineHeight;

        // Find message letters with their positions
        messageIndices = findMessageLetters();

        // Create a map of indices to positions for message letters
        const messagePositions = new Map();
        messageIndices.forEach(({index, x, y, isMessage}) => {
            messagePositions.set(index, {x, y, isMessage});
        });

        // Draw all text
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const metrics = ctx.measureText(char);
            const charWidth = metrics.width;

            // Handle line wrapping
            if (x + charWidth > canvas.width - 10) {
                x = 5;
                y += lineHeight;
            }

            // Store letter position
            if (!letterPositions.has(char.toLowerCase())) {
                letterPositions.set(char.toLowerCase(), []);
            }

            // If this is a message letter, use its pre-calculated position
            if (messagePositions.has(i)) {
                const pos = messagePositions.get(i);
                letterPositions.get(char.toLowerCase()).push({ x: pos.x, y: pos.y, char });
                
                ctx.save();
                if (pos.isMessage) {
                    ctx.font = '14px Arial'; // Larger font for message
                }
                ctx.fillStyle = 'white';
                ctx.fillText(char, pos.x, pos.y);
                ctx.restore();
                highlightedPositions.add(`${pos.x},${pos.y}`);
            } else {
                letterPositions.get(char.toLowerCase()).push({ x, y, char });
                ctx.fillText(char, x, y);
            }
            
            x += charWidth + 0.5;
        }
    }

    function highlightLetter(x, y, char) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillText(char, x, y);
        ctx.restore();
    }

    function startCascadingHighlight(letter) {
        if (currentAnimation) {
            cancelAnimationFrame(currentAnimation.id);
        }

        const positions = letterPositions.get(letter.toLowerCase());
        if (!positions) return;

        const unhighlighted = positions.filter(pos => !highlightedPositions.has(`${pos.x},${pos.y}`));
        if (unhighlighted.length === 0) return;

        // Shuffle the unhighlighted positions for more random visual effect
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
                const pos = unhighlighted[index];
                highlightedPositions.add(`${pos.x},${pos.y}`);
                highlightLetter(pos.x, pos.y, pos.char);

                index++;
                timeSinceLastHighlight = 0;
                
                acceleration += 0.2;
                delay = Math.max(10, 300 / acceleration);
            }

            if (index < unhighlighted.length) {
                currentAnimation = {
                    id: requestAnimationFrame(animate),
                    letter: letter
                };
            } else {
                currentAnimation = null;
            }
        }

        currentAnimation = {
            id: requestAnimationFrame(animate),
            letter: letter
        };
    }

    function handleKeyPress(event) {
        if (event.key.length !== 1) return;
        startCascadingHighlight(event.key);
    }

    function handleClick(event) {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const allPositions = Array.from(letterPositions.values()).flat();
        const unhighlighted = allPositions.filter(pos => !highlightedPositions.has(`${pos.x},${pos.y}`));
        if (unhighlighted.length === 0) return;

        const pos = unhighlighted[Math.floor(Math.random() * unhighlighted.length)];
        startCascadingHighlight(pos.char);
    }

    // Initialize
    initializeCanvas();
    document.fonts.ready.then(() => {
        drawText();
    });

    // Event listeners
    document.addEventListener('keypress', handleKeyPress);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleClick(e.touches[0]);
    });
});
