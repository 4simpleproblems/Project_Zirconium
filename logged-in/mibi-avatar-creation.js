/**
 * Mibi Avatar Creation Logic
 * Handles the canvas rendering, asset layering, and UI for the avatar creator.
 */

export class MibiAvatarCreator {
    constructor(saveCallback, closeCallback) {
        this.saveCallback = saveCallback;
        this.closeCallback = closeCallback;
        
        // Configuration
        this.canvas = document.getElementById('mibiCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.assetsPath = '../mibi-avatars';
        
        // State
        this.state = {
            step: 'customization', // customization, background, position
            activeCategory: 'hats', // hats, eyes, mouths
            assets: {
                base: null,
                hat: null,
                eyes: null,
                mouth: null
            },
            config: {
                hat: null,    // filename
                eyes: null,   // filename
                mouth: null,  // filename
                bgColor: '#4f46e5',
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0
            }
        };

        // Available Assets (Mock data - You should populate this with real filenames)
        this.library = {
            hats: ['hat1.png', 'hat2.png', 'hat3.png', 'hat4.png'], // Add your real filenames here
            eyes: ['eyes1.png', 'eyes2.png', 'eyes3.png'],
            mouths: ['mouth1.png', 'mouth2.png', 'mouth3.png'],
            colors: ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff']
        };

        this.init();
    }

    async init() {
        // Set canvas size
        this.canvas.width = 500;
        this.canvas.height = 500;

        // Load Base Head
        this.state.assets.base = await this.loadImage(`${this.assetsPath}/head.png`);
        
        // Bind UI Elements
        this.bindEvents();
        
        // Initial Draw
        this.draw();
        this.updateUI();
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`Failed to load image: ${src}`);
                resolve(null); // Resolve null so it doesn't break the app
            };
            img.src = src;
        });
    }

    bindEvents() {
        // Toolbar Buttons
        document.querySelectorAll('.mibi-tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.setCategory(category);
            });
        });

        // Navigation Buttons
        document.getElementById('mibiNavCustom').addEventListener('click', () => this.setStep('customization'));
        document.getElementById('mibiNavBg').addEventListener('click', () => this.setStep('background'));
        document.getElementById('mibiNavPos').addEventListener('click', () => this.setStep('position'));

        // Save/Close
        document.getElementById('mibiSaveBtn').addEventListener('click', () => this.save());
        document.getElementById('mibiCancelBtn').addEventListener('click', () => this.closeCallback());

        // Sliders (Positioning)
        ['posX', 'posY', 'scale', 'rotation'].forEach(prop => {
            const slider = document.getElementById(`mibiSlider-${prop}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    let val = parseFloat(e.target.value);
                    if (prop === 'x' || prop === 'y') this.state.config[prop] = val; // Direct mapping removed for simplicity in example
                    
                    if (prop === 'posX') this.state.config.x = val;
                    if (prop === 'posY') this.state.config.y = val;
                    if (prop === 'scale') this.state.config.scale = val;
                    if (prop === 'rotation') this.state.config.rotation = val;
                    
                    this.draw();
                });
            }
        });
    }

    setStep(step) {
        this.state.step = step;
        
        // Update UI Visibility
        document.getElementById('mibi-panel-customization').classList.toggle('hidden', step !== 'customization');
        document.getElementById('mibi-panel-background').classList.toggle('hidden', step !== 'background');
        document.getElementById('mibi-panel-position').classList.toggle('hidden', step !== 'position');
        
        // Update Nav visual state
        document.querySelectorAll('.mibi-step-btn').forEach(btn => btn.classList.remove('active'));
        if(step === 'customization') document.getElementById('mibiNavCustom').classList.add('active');
        if(step === 'background') document.getElementById('mibiNavBg').classList.add('active');
        if(step === 'position') document.getElementById('mibiNavPos').classList.add('active');

        // Layout Shift Logic
        const container = document.getElementById('mibiCanvasContainer');
        if (step === 'customization' || step === 'background') {
            container.classList.add('shifted');
        } else {
            // In position mode, center the canvas
            container.classList.remove('shifted');
        }

        this.draw();
    }

    setCategory(category) {
        this.state.activeCategory = category;
        this.setStep('customization'); // Ensure we are on the customization step
        this.updateUI();
    }

    updateUI() {
        // Highlight active toolbar button
        document.querySelectorAll('.mibi-tool-btn').forEach(btn => {
            if (btn.dataset.category === this.state.activeCategory) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Populate Grid based on active category
        const grid = document.getElementById('mibiOptionsGrid');
        grid.innerHTML = '';

        // Add "None" option
        const noneBtn = document.createElement('div');
        noneBtn.className = 'mibi-grid-item';
        noneBtn.innerHTML = '<i class="fa-solid fa-ban text-gray-500"></i>';
        noneBtn.onclick = () => this.selectAsset(this.state.activeCategory, null);
        grid.appendChild(noneBtn);

        // Add Assets
        const items = this.library[this.state.activeCategory] || [];
        items.forEach(filename => {
            const item = document.createElement('div');
            item.className = 'mibi-grid-item';
            if (this.state.config[this.state.activeCategory.slice(0, -1)] === filename) {
                item.classList.add('selected');
            }

            const img = document.createElement('img');
            // Assuming folder structure: ../mibi-avatars/hats/filename
            img.src = `${this.assetsPath}/${this.state.activeCategory}/${filename}`;
            
            item.appendChild(img);
            item.onclick = () => this.selectAsset(this.state.activeCategory, filename);
            grid.appendChild(item);
        });

        // Populate Colors if needed (separate panel)
        const colorGrid = document.getElementById('mibiColorGrid');
        colorGrid.innerHTML = '';
        this.library.colors.forEach(color => {
            const circle = document.createElement('div');
            circle.className = 'mibi-color-circle';
            circle.style.backgroundColor = color;
            if (this.state.config.bgColor === color) circle.classList.add('selected');
            circle.onclick = () => {
                this.state.config.bgColor = color;
                this.draw();
                this.updateUI(); // To update selection border
            };
            colorGrid.appendChild(circle);
        });
    }

    async selectAsset(category, filename) {
        // category is 'hats', key is 'hat'
        const key = category.slice(0, -1); 
        this.state.config[key] = filename;

        if (filename) {
            this.state.assets[key] = await this.loadImage(`${this.assetsPath}/${category}/${filename}`);
        } else {
            this.state.assets[key] = null;
        }

        this.draw();
        this.updateUI();
    }

    draw() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        const config = this.state.config;

        // 1. Clear & Background
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = config.bgColor;
        ctx.fillRect(0, 0, width, height);

        // 2. Setup Transformations (Positioning)
        ctx.save();
        
        // Translate to center, apply transforms, then translate back relative to image size
        // We pivot around the center of the canvas
        ctx.translate(width / 2 + config.x, height / 2 + config.y);
        ctx.rotate((config.rotation * Math.PI) / 180);
        ctx.scale(config.scale, config.scale);
        
        // Draw centered relative to the translation point
        const drawImageCentered = (img) => {
            if (img) ctx.drawImage(img, -250, -250, 500, 500); // Assuming assets are 500x500
        };

        // 3. Draw Layers
        // Base
        drawImageCentered(this.state.assets.base);
        // Eyes
        drawImageCentered(this.state.assets.eyes);
        // Mouth
        drawImageCentered(this.state.assets.mouth);
        // Hat (Usually on top)
        drawImageCentered(this.state.assets.hat);

        ctx.restore();

        // 4. Draw Overlay (only in Position mode)
        if (this.state.step === 'position') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            // Draw a circle representing the PFP cut
            ctx.arc(width / 2, height / 2, width / 2 - 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    save() {
        // Temporarily ensure overlay is not drawn
        const prevStep = this.state.step;
        this.state.step = 'saving';
        this.draw();
        
        const dataUrl = this.canvas.toDataURL('image/png');
        
        // Restore state
        this.state.step = prevStep;
        this.draw();

        this.saveCallback(dataUrl);
    }
}
