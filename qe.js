class Complex {
    constructor(re, im = 0) { this.re = re; this.im = im; }
    add(o) { return new Complex(this.re + o.re, this.im + o.im); }
    sub(o) { return new Complex(this.re - o.re, this.im - o.im); }
    mul(o) { return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re); }
    magSq() { return this.re * this.re + this.im * this.im; }
    mag() { return Math.sqrt(this.magSq()); }
    phase() { return Math.atan2(this.im, this.re); }
    toString() {
        if (this.magSq() < 1e-6) return "0";
        const r = this.re.toFixed(2);
        const i = Math.abs(this.im).toFixed(2);
        if (Math.abs(this.im) < 1e-4) return r;
        if (Math.abs(this.re) < 1e-4) return (this.im < 0 ? '-' : '') + i + "i";
        return `${r}${this.im >= 0 ? '+' : '-'}${i}i`;
    }
}

const QUBITS = 5;
const STATES = 32;
let circuit = [];
let currentStep = 0;
let animationTime = 0;
let activeTab = 'circuit';
let stateHistory = [];
let corkscrew = { scene: null, camera: null, renderer: null, controls: null, lines: [], labels: [], needles: [], compositeLine: null };
let wavefront = { scene: null, camera: null, renderer: null, controls: null, mesh: null, geometry: null, container: null };
let qsphere = { scene: null, camera: null, renderer: null, controls: null, nodes: [], labels: [], vectors: [] };
let vsphere = { scene: null, camera: null, renderer: null, controls: null, vectors: [], groups: [], labels: [] };
let entanglementView = { scene: null, camera: null, renderer: null, controls: null, nodes: [], edges: [] };
let polytopeViews = [];
let wavefrontlabels = [];

const WF_GRID_X = 8;
const WF_SPACING = 2.5;
let globalTooltip = null;

function createToolTip() {
    globalTooltip = document.createElement('div');
    globalTooltip.className = "fixed hidden bg-black text-white text-[10px] px-2 py-1 rounded z-[10000] pointer-events-none whitespace-normal shadow-xl";
    document.body.appendChild(globalTooltip);
}


function getEmitterCoords(s) {
    const ex = ((s % WF_GRID_X) - (WF_GRID_X / 2 - 0.5)) * WF_SPACING;
    const ey = ((Math.floor(s / WF_GRID_X)) - (2 - 0.5)) * WF_SPACING; // 4 rows total
    return { x: ex, y: ey };
}

function switchTab(tabId) {
    document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    activeTab = tabId;
    setTimeout(() => {
        if (tabId === 'corkscrew') initCorkscrew();
        if (tabId === 'wavefront') initWavefront();
        if (tabId === 'qsphere') initQSphere();
        if (tabId === 'vsphere') initVSphere();
        if (tabId === 'hinton') { initPolytopeView(); initHintonLabels(); }
        if (tabId === 'entanglement') initEntanglementView();
        if (tabId === 'history') updateHistoryView();
        runSimulation();
    }, 50);
}

function toggleInfoPanel() {
    const panel = document.getElementById('info-panel');
    const isHidden = panel.classList.contains('hidden');
    
    if (isHidden) {
        // Update content before showing
        document.getElementById('info-panel-content').innerHTML = getInfoText(activeTab);
        panel.classList.remove('hidden');
        // Small delay to allow CSS transition to trigger
        setTimeout(() => panel.classList.add('visible'), 10);
    } else {
        panel.classList.remove('visible');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}

function getInfoText(view) {
    const infoMap = {
        'circuit': `
<div style="font-family: sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
    <h2 style="margin-top: 0;">Phase Disk Guide</h2>
    <p>In a 5-qubit system, there are 32 possible states (from |00000&gt; to |11111&gt;). Each phase disk represents the <strong>complex amplitude</strong> of one of those states. Here is what you should look for:</p>
    
    <ol>
        <li style="margin-bottom: 15px;">
            <strong>Magnitude and Probability (The Fill Level):</strong>
            <br>
            The amount of color filling the disk represents the <strong>magnitude</strong> of the amplitude. However, remember that the probability of the system collapsing into that specific state is the <em>square</em> of that fill level (P = |a|^2). If all disks are empty except one, the system is in a "basis state." If many disks are partially filled, the system is in a <strong>superposition</strong>.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>Relative Phase (The Dial Direction):</strong>
            <br>
            The line indicates the phase angle (&theta;) in the complex plane. Watch how these angles change relative to one another after a gate is applied. In quantum algorithms, the phase doesn't change the probability of a single disk, but it determines how that state will <strong>interfere</strong> with others when the next operation occurs.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>Constructive vs. Destructive Interference:</strong>
            <br>
            This is the core of quantum computation. When gates (like the Hadamard or QFT) are applied, states with <strong>pointing-in-the-same-direction</strong> phases will reinforce each other (constructive), increasing their fill level. States with <strong>opposite</strong> phases (180° apart) will cancel each other out (destructive), causing their fill levels to shrink or disappear.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>Entanglement Patterns:</strong>
            <br>
            Look for correlations between disks. If the system is <strong>entangled</strong>, you will notice that only specific, separated states have magnitude. For example, in a Bell State, you might see |00000&gt; and |11111&gt; fully filled while all 30 other disks remain empty. This indicates that the qubits no longer have independent states.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>Global Phase Shifts:</strong>
            <br>
            If you apply an operation that rotates <em>every</em> disk's dial by the same amount (e.g., all dials move 90° clockwise), notice that the "picture" remains functionally the same. This is a <strong>global phase</strong>. While it looks different visually, it is physically undetectable upon measurement, as the <em>relative</em> difference between the disks hasn't changed.
        </li>
    </ol>
    
    <p style="font-style: italic; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
        Tip: Watch for "symmetry" in the 32 disks. Algorithms like Grover's Search or Shor's Algorithm create distinct geometric patterns in the phases before "collapsing" the magnitude into the correct answer.
    </p>
</div>`,



        
        'corkscrew': `
<div>
  <h2>3D Corkscrew Wave Guide</h2>
    <p>As you navigate the 3D space of these 2^5 (32) basis states, use this guide to interpret the interaction between individual state "corkscrews" and the resulting composite wave.</p>

    <ol style="padding-left: 20px;">
        <li style="margin-bottom: 15px;">
            <strong>1. Phase Alignment and Interference Patterns</strong>
            Observe the "phase lines" at the end of each corkscrew. When multiple lines point in the same direction, they are <em>in phase</em>, leading to <strong>constructive interference</strong> and a larger amplitude in the composite wave. If phase lines point in opposite directions, look for the composite wave to flatten, signifying <strong>destructive interference</strong>.
            <div class="technical-note">This is the fundamental mechanism of quantum algorithms: amplifying the correct answer while suppressing wrong ones.</div>
        </li>

        <li style="margin-bottom: 15px;">
            <strong>2. Helicity and Magnitude Distribution</strong>
            Orient the view to look directly "down the barrel" of the corkscrews. The radius of each screw represents the probability amplitude of that specific state. A system in a uniform superposition will show 32 screws of equal thickness, while a system collapsing toward a solution will show one or two screws dominating the volume.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>3. Global vs. Relative Phase Shifts</strong>
            Rotate the entire view. If you apply an operation that shifts every phase line by the same angle, notice that the <em>shape</em> of the composite wave remains unchanged. However, if only a subset of states (like those starting with |1>) shift, the composite wave's geometry will distort.
            <div class="technical-note">This helps you visualize why "Global Phase" is physically unobservable, while "Relative Phase" drives the computation.</div>
        </li>

        <li style="margin-bottom: 15px;">
            <strong>4. Entanglement Signatures</strong>
            Look for correlations in the wave behavior. In an entangled state, you cannot change the phase or amplitude of one corkscrew (e.g., state |00000>) without seeing a synchronized transformation in another (e.g., |11111>). If the corkscrews appear to act in isolated groups, the qubits may be partially or fully decohered/unentangled.
        </li>

        <li style="margin-bottom: 15px;">
            <strong>5. The "Composite Envelope" Geometry</strong>
            Switch your focus to the composite wave. Its peaks and valleys represent the collective state of the computer. In a successful computation, the composite wave should show a distinct "surge" or high-energy peak corresponding to the specific binary state that solves your problem.
        </li>
    </ul>

    <p><em>Pro Tip: Try aligning your view parallel to the phase lines to see which states are currently contributing most effectively to the total probability density.</em></p>
</div>`,


        
        'wavefront': `
<div>
    <h2 style="margin-top: 0;">Wave Front Guide</h2>
    <p>This visualization represents the <strong>32 possible basis states</strong> (2^5) of your quantum system. Each point on the grid corresponds to a specific bitstring (from |00000> to |11111>). Use the following guide to interpret the "wave" interference patterns you observe.</p>
    
    <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">

    <h3>5 Things to Look For</h3>
    
    <ol style="padding-left: 20px;">
        <li style="margin-bottom: 15px;">
            <strong>Constructive vs. Destructive Interference:</strong> 
            Watch for areas where wave peaks align and amplify (Constructive) versus areas where the grid remains flat or "hollowed out" (Destructive). In quantum algorithms, we use operations like the Hadamard gate to create these patterns, pushing the system's probability toward the correct solution.
        </li>
        <li style="margin-bottom: 15px;">
            <strong>Global vs. Relative Phase:</strong> 
            Rotate the view to look at the "height" and "tilt" of the generators. If all generators are oscillating in unison, they share a <em>global phase</em>. If they are out of sync, the <em>relative phase</em> differences are what determine how these states will interfere when you apply the next gate.
        </li>
        <li style="margin-bottom: 15px;">
            <strong>State Entanglement:</strong> 
            Look for correlations across the grid. If the wave activity is localized to two distant "peaks" (e.g., at |00000> and |11111>) with nothing in between, you are likely viewing a <em>Bell State</em> or <em>GHZ State</em>, indicating high entanglement where the qubits are no longer independent.
        </li>
        <li style="margin-bottom: 15px;">
            <strong>Probability Density:</strong> 
            The amplitude (magnitude) of the wave at any grid point represents the likelihood of the system collapsing into that state upon measurement. A single high-frequency tower suggests a <em>deterministic</em> state, while a broad, low-level ripple across the whole grid suggests <em>superposition</em>.
        </li>
        <li style="margin-bottom: 15px;">
            <strong>Smoothing Effects on Symmetry:</strong> 
            Toggle between <strong>Gaussian</strong> and <strong>Linear</strong> smoothing. Gaussian smoothing often reveals the "neighborhood" of a state, helping you see if the algorithm is "close" to a solution in terms of Hamming distance. Linear smoothing can make it easier to spot sharp transitions and phase boundaries.
        </li>
    </ol>

    <div style="padding: 15px; border-radius: 8px; margin-top: 20px;">
        <h4 style="margin-top: 0;">Pro-Tip for Viewers</h4>
        <p style="margin-bottom: 0; font-size: 0.9em;">
            Try orienting the view to a <strong>Top-Down (Bird's Eye) perspective</strong> to identify patterns of symmetry in the 5-qubit architecture. Then, switch to a <strong>Side-Profile view</strong> to better gauge the comparative amplitudes of different computational paths.
        </p>
    </div>
</div>`,


        
        'qsphere': `
<div style="padding: 20px; font-family: sans-serif; line-height: 1.6; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
  <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.25rem;">Q-Sphere* Guide</h3>
   <p>This is a modified version of the Qiskit Q-Sphere<p>
    
    <ol style="padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 12px;">
            <strong>Interference Patterns (Distance and Motion):</strong> 
            Watch the nodes move toward or away from the center. <strong>Constructive interference</strong> is visible when a node moves outward toward the surface, indicating an increase in probability. <strong>Destructive interference</strong> occurs when a node retreats toward the center (0,0,0), signaling that different paths in the calculation have canceled each other out.
        </li>
        <li style="margin-bottom: 12px;">
            <strong>Phase Relationships (Color):</strong> 
            The color of each node and its connecting vector represents its quantum phase. When performing operations like the Hadamard (H) or Phase (Z) gates, look for color shifts. States with the same color are "in phase," while states with opposite colors (on the color wheel) are "out of phase," which is the precursor to destructive interference.
        </li>
        <li style="margin-bottom: 12px;">
            <strong>Computational Weight (Node Size):</strong> 
            The size of each node represents its <strong>Hamming Weight</strong>—the number of '1's in that state's binary string. Smaller nodes represent states closer to |000...0>, while larger nodes represent states with more active qubits. This helps you identify which specific "types" of states are being targeted by an algorithm.
        </li>
        <li style="margin-bottom: 12px;">
            <strong>State Evolution (Vector Length):</strong> 
            The line connecting the center to the node acts as a visual "gauge." Since the radius is mapped to probability, a full-length vector indicates a <strong>basis state</strong> (100% certainty). A cluster of short vectors indicates <strong>superposition</strong>, where the system’s "certainty" is spread across many different possibilities simultaneously.
        </li>
        <li style="margin-bottom: 12px;">
            <strong>Symmetry and Entanglement:</strong> 
            Look for patterns in how nodes are distributed across the sphere. In non-entangled states (like a simple H-gate on all qubits), nodes will appear symmetrically. When <strong>entanglement</strong> is introduced (via CNOT gates), you will notice specific pairs or groups of nodes moving in sync while others remain at the center, revealing the hidden correlations between qubits.
        </li>
    </ol>
</div>`,



        'hinton': `
<div style="font-family: sans-serif; line-height: 1.6; padding: 15px; border: 1px solid #ccc; border-radius: 8px;">
  <h3 style="margin-top: 0;">Hinton Density Matrix and Polytope Guide</h3>
  <p style="font-size: 0.95em;">Use this guide to interpret the relationship between the Hinton Density Matrix and the individual qubit polytopes.</p>
  
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 15px;">
      <strong>Off-Diagonal Magnitudes (Coherence & Phase):</strong> 
      In the Hinton Plot, look at the squares located off the main diagonal. These represent the "coherences" between basis states. Large off-diagonal elements indicate that the qubits are in a superposition. The size of the square represents the magnitude, while the visual style (often color or shading) represents the phase. Watching these change during a gate operation reveals how <strong>constructive and destructive interference</strong> is being "steered" to favor specific outcomes.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>The Diagonal Distribution (Measurement Probability):</strong> 
      The squares along the main diagonal represent the population of each computational basis state ($|00000\rangle$ to $|11111\rangle$). The larger the square on the diagonal, the higher the probability that the system will collapse into that specific state upon measurement. If you see many small squares, the system is highly diffused; a single large square indicates the algorithm has successfully used interference to converge on a solution.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Polytope Purity vs. Mixedness:</strong> 
      Observe the vector within each qubit’s polytope. If the vector reaches the surface (the "skin") of the polytope, the qubit is in a <strong>pure state</strong>. If the vector shrinks toward the center, the qubit is in a <strong>mixed state</strong>. In a density matrix view, a loss of purity often corresponds to the "blurring" or disappearance of off-diagonal coherence squares, indicating interaction with the environment or noise (decoherence).
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Entanglement Signatures:</strong> 
      Compare the polytopes to the density matrix. If the individual qubit polytopes show vectors that have shrunk toward the center (appearing "mixed"), but the overall Hinton Plot shows a highly structured, coherent state, this is a hallmark of <strong>entanglement</strong>. It indicates that information is not stored in individual qubits, but in the correlations between them, which are visible only in the full system matrix.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Phase Rotations and Symmetry:</strong> 
      Look for patterns or symmetries in the Hinton Plot. Quantum algorithms like Grover's or the Quantum Fourier Transform (QFT) create distinct geometric patterns of phase shifts. By watching the phases (the "colors" or "angles" within the Hinton squares) alongside the rotations on the individual polytopes, you can see how local operations on a single qubit can rotate the global state vector through the high-dimensional Hilbert space.
    </li>
  </ol>
</div>`,

        'matrix': `
<div style="font-family: sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
  <h3 style="margin-top: 0;">Quantum State and Operator Matrices Guide</h3>
  <p>When viewing a 5-qubit system ($2^5 = 32$ possible states), use the following guide to interpret how gates transform the state vector through interference and entanglement.</p>
  
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 15px;">
      <strong>Identify Constructive and Destructive Interference:</strong>
      Look at the transition between the input and output state vectors. If a gate (like the Hadamard) causes multiple computational basis states to have non-zero amplitudes that later "collapse" back into a single state, you are witnessing interference. 
      <ul style="margin-top: 5px;">
        <li><strong>Constructive:</strong> Amplitudes with the same sign/phase add together to increase the probability of a state.</li>
        <li><strong>Destructive:</strong> Amplitudes with opposite phases ($1$ and $-1$) cancel each other out, resulting in a zero probability for that outcome.</li>
      </ul>
    </li>

    <li style="margin-bottom: 15px;">
      <strong>Matrix Sparsity and Computational Path:</strong>
      Examine the gate matrix for its density. A <strong>sparse matrix</strong> (mostly zeros) indicates a gate that performs simple permutations or phase shifts (like X or Z). A <strong>dense matrix</strong> (many non-zero entries) represents a gate that creates superpositions. In the view, the columns of the gate matrix show exactly how each input basis state is redistributed across the 32 possible output states.
    </li>

    <li style="margin-bottom: 15px;">
      <strong>Phase Rotations and Complex Amplitudes:</strong>
      Quantum states are not just probabilities; they have phases. Look for complex numbers or negative signs in the state vector. These do not change the <em>probability</em> of measuring a state (which is the square of the magnitude), but they are the "engines" of quantum algorithms. These phases determine how the state will interfere with others in subsequent gate operations.
    </li>

    <li style="margin-bottom: 15px;">
      <strong>Detecting Entanglement via State Separability:</strong>
      Observe if the 32-element state vector can be described as a simple combination of individual qubit states. If a gate matrix (like a CNOT) creates a state where the outcome of one qubit is strictly dependent on another (e.g., the Bell State $\frac{|00\rangle + |11\rangle}{\sqrt{2}}$), you will see non-zero amplitudes only in specific, correlated indices. If you cannot "factor out" the qubits, the system is entangled.
    </li>

    <li style="margin-bottom: 15px;">
      <strong>Unitary Preservation (Normalization):</strong>
      Note that despite the complexity of the gate matrix, the total "energy" of the state vector remains constant. The sum of the squares of the magnitudes of all 32 amplitudes must always equal 1. If you see the amplitudes shifting significantly but the total probability remains 1, you are observing a <strong>Unitary Transformation</strong>, the fundamental requirement for all quantum logic gates.
    </li>
  </ol>
</div>`,

        'entanglement': `
<div style="font-family: sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
  <h3 style="margin-top: 0;">Entanglement Guide</h3>
  <p style="margin-bottom: 15px;">Use this view to track qubits are entangled or related.</p>
</div>  
`,


        'history': `
<div style="font-family: sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
  <h3 style="margin-top: 0;">Amplitude History Guide</h3>
  <p style="margin-bottom: 15px;">Use this view to track how quantum gates transform information across all 32 possible states ($2^{5}$ qubits). Observe the following patterns to understand the "logic" of the quantum system:</p>
  
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 15px;">
      <strong>Constructive and Destructive Interference:</strong> 
      Watch how the bars change as you apply gates. When bars grow taller, the amplitudes are interfering <strong>constructively</strong>, increasing the probability of that state. When bars shrink or disappear, <strong>destructive</strong> interference is occurring, where the "phases" (represented here by the direction of the bars) cancel each other out.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Phase Transitions (Bar Direction):</strong> 
      Pay close attention to bars pointing downward. In quantum mechanics, amplitudes can be negative (or complex). A gate that flips a bar from upward to downward has applied a <strong>phase shift</strong>. While this doesn't change the immediate probability of that single state, it fundamentally changes how that state will interfere with others in the next step.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Superposition Breadth:</strong> 
      Look at how many of the 32 states have active bars at any given time. A single tall bar represents a <strong>basis state</strong> (classical-like certainty). Many short bars spread across the chart indicate the system is in a <strong>superposition</strong>, holding multiple values simultaneously.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Amplitude Distribution (Probability Density):</strong> 
      The total "weight" of the system is always conserved. If one bar goes down, others must go up. By looking at the <strong>amplitude</strong> (the magnitude of the bar, regardless of direction), you are seeing the square root of the probability. The taller the bar, the more likely the computer is to "collapse" into that specific state upon measurement.
    </li>
    
    <li style="margin-bottom: 15px;">
      <strong>Gate Impact Reversibility:</strong> 
      Compare the charts before and after a gate is applied. Quantum gates are <strong>unitary</strong>, meaning they are reversible. If a gate spreads one state into many (like a Hadamard gate), applying that same gate again (or its inverse) will often "uncompute" the spread and interfere the amplitudes back into a single, certain state.
    </li>
  </ol>
</div>`

    };

    return infoMap[view] || "<p>Explore the circuit to see quantum logic in action.</p>";
}

// Update the info panel automatically if it's open when switching tabs
const originalSwitchTab = switchTab;
switchTab = function(tabId) {
    originalSwitchTab(tabId);
    const panel = document.getElementById('info-panel');
    if (!panel.classList.contains('hidden')) {
        document.getElementById('info-panel-content').innerHTML = getInfoText(tabId);
    }
};      

function runSimulation() {
    stateVector = Array(STATES).fill(0).map(() => new Complex(0, 0));
    stateVector[0] = new Complex(1, 0);

    // Reset history
    stateHistory = [];
    // Push initial state
    stateHistory.push({
        state: [...stateVector], // copy
        gate: null
    });

    const INV_SQRT2 = 1 / Math.sqrt(2);
    let lastMatrix = null;
    let lastGateInfo = "None";

    if (currentStep > circuit.length) currentStep = circuit.length;

    for (let s = 0; s < currentStep; s++) {
        const gate = circuit[s];
        if (!gate) continue;

        const nextState = Array(STATES).fill(0).map(() => new Complex(0, 0));
        const bitMask = 1 << ((QUBITS - 1) - gate.target);

        if (s === currentStep - 1) {
            lastMatrix = Array(STATES).fill(0).map(() => Array(STATES).fill(new Complex(0, 0)));
            lastGateInfo = `${gate.type} on Q${gate.target}`;
        }

        for (let i = 0; i < STATES; i++) {
            const amp = stateVector[i];
            const bitIsSet = (i & bitMask) !== 0;
            const ctrlSatisfied = gate.controls.every(c => (i & (1 << ((QUBITS - 1) - c))) !== 0);

            if (gate.type === 'H') {
                if (!ctrlSatisfied) {
                    nextState[i] = nextState[i].add(amp);
                    if (lastMatrix) lastMatrix[i][i] = new Complex(1);
                    continue;
                }
                const idx0 = i & ~bitMask; const idx1 = i | bitMask;
                if (!bitIsSet) {
                    nextState[idx0] = nextState[idx0].add(amp.mul(new Complex(INV_SQRT2)));
                    nextState[idx1] = nextState[idx1].add(amp.mul(new Complex(INV_SQRT2)));
                    if (lastMatrix) { lastMatrix[idx0][i] = new Complex(INV_SQRT2); lastMatrix[idx1][i] = new Complex(INV_SQRT2); }
                } else {
                    nextState[idx0] = nextState[idx0].add(amp.mul(new Complex(INV_SQRT2)));
                    nextState[idx1] = nextState[idx1].add(amp.mul(new Complex(-INV_SQRT2)));
                    if (lastMatrix) { lastMatrix[idx0][i] = new Complex(INV_SQRT2); lastMatrix[idx1][i] = new Complex(-INV_SQRT2); }
                }
            } else if (gate.type === 'X' || (gate.type === 'CNOT')) {
                const target = ctrlSatisfied ? i ^ bitMask : i;
                nextState[target] = nextState[target].add(amp);
                if (lastMatrix) lastMatrix[target][i] = new Complex(1);
            } else if (gate.type === 'Y') {
                const target = ctrlSatisfied ? i ^ bitMask : i;
                const phase = (ctrlSatisfied && bitIsSet) ? new Complex(0, -1) : (ctrlSatisfied ? new Complex(0, 1) : new Complex(1));
                nextState[target] = nextState[target].add(amp.mul(phase));
                if (lastMatrix) lastMatrix[target][i] = phase;
            } else if (gate.type === 'Z' || gate.type === 'CZ' || gate.type === 'MCZ') {
                const phase = (ctrlSatisfied && bitIsSet) ? new Complex(-1) : new Complex(1);
                nextState[i] = nextState[i].add(amp.mul(phase));
                if (lastMatrix) lastMatrix[i][i] = phase;
            } else if (gate.type === 'S') {
                const phase = bitIsSet ? new Complex(0, 1) : new Complex(1);
                nextState[i] = nextState[i].add(amp.mul(phase));
                if (lastMatrix) lastMatrix[i][i] = phase;
            } else if (gate.type === 'T') {
                const phase = bitIsSet ? new Complex(Math.SQRT1_2, Math.SQRT1_2) : new Complex(1);
                nextState[i] = nextState[i].add(amp.mul(phase));
                if (lastMatrix) lastMatrix[i][i] = phase;

            } else if (gate.type === 'SWAP') {
                const target2 = gate.controls[0];
                const bitMask2 = 1 << ((QUBITS - 1) - target2);
                const bit1 = (i & bitMask) !== 0;
                const bit2 = (i & bitMask2) !== 0;

                if (bit1 !== bit2) {
                    const targetIdx = i ^ bitMask ^ bitMask2;
                    nextState[targetIdx] = amp;
                    if (lastMatrix) lastMatrix[targetIdx][i] = new Complex(1);
                } else {
                    nextState[i] = amp;
                    if (lastMatrix) lastMatrix[i][i] = new Complex(1);
                }

            } else if (gate.type === 'U' || gate.type === 'CU') {
                const [theta, phi, lambda] = gate.angles;
                const cosT = Math.cos(theta / 2);
                const sinT = Math.sin(theta / 2);

                const u00 = new Complex(cosT);
                const u01 = new Complex(-Math.cos(lambda) * sinT, -Math.sin(lambda) * sinT);
                const u10 = new Complex(Math.cos(phi) * sinT, Math.sin(phi) * sinT);
                const u11 = new Complex(Math.cos(phi + lambda) * cosT, Math.sin(phi + lambda) * cosT);

                if (!bitIsSet) {
                    const idx0 = i;
                    const idx1 = i | bitMask;
                    const ctrlSatisfied = gate.controls.every(c => (i & (1 << ((QUBITS - 1) - c))) !== 0);

                    if (gate.type === 'U' || (gate.type === 'CU' && ctrlSatisfied)) {
                        const amp0 = stateVector[idx0];
                        const amp1 = stateVector[idx1];

                        nextState[idx0] = amp0.mul(u00).add(amp1.mul(u01));
                        nextState[idx1] = amp0.mul(u10).add(amp1.mul(u11));

                        if (lastMatrix) {
                            lastMatrix[idx0][idx0] = u00; lastMatrix[idx0][idx1] = u01;
                            lastMatrix[idx1][idx0] = u10; lastMatrix[idx1][idx1] = u11;
                        }
                    } else {
                        nextState[idx0] = nextState[idx0].add(stateVector[idx0]);
                        nextState[idx1] = nextState[idx1].add(stateVector[idx1]);
                        if (lastMatrix) {
                            lastMatrix[idx0][idx0] = new Complex(1);
                            lastMatrix[idx1][idx1] = new Complex(1);
                        }
                    }
                }
            }
        }
        stateVector = nextState;
        // Capture state for history
        stateHistory.push({
            state: [...stateVector],
            gate: gate
        });
    }
    updateViews(lastMatrix, lastGateInfo);
}

function updateViews(lastMatrix, lastGateInfo) {
    updateCircuitView();
    updateMatrixDisplay(lastMatrix, lastGateInfo);
    updateVectorDisplay();
    updatePolytopeView();
    updateHintonView();
    updateEntanglementGraph();
    updateInterpretation(lastGateInfo);
    if (activeTab === 'history') updateHistoryView();

    const list = document.getElementById('probabilities-list');
    if (list) list.innerHTML = stateVector.map((amp, i) => amp.magSq() > 0.001 ? `<div class="p-1 text-sky-400 font-bold border-b border-slate-800">|${i.toString(2).padStart(QUBITS, '0')}⟩ ${(amp.magSq() * 100).toFixed(1)}%</div>` : '').join('');
}

function updateHistoryView() {
    const container = document.getElementById('view-history');
    if (!container) return;
    container.innerHTML = '';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = "flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2";
    container.appendChild(scrollContainer);

    // Iterate reversed: Latest first
    for (let i = stateHistory.length - 1; i >= 0; i--) {
        const entry = stateHistory[i];
        const isCurrent = i === stateHistory.length - 1;

        const row = document.createElement('div');
        row.className = `flex items-center gap-4 p-3 rounded-lg border ${isCurrent ? 'bg-slate-800 border-sky-500' : 'bg-slate-900 border-slate-700'}`;

        // Gate Info Column
        const infoCol = document.createElement('div');
        infoCol.className = "w-24 shrink-0 flex flex-col items-center justify-center";

        if (entry.gate) {
            const badge = document.createElement('div');
            badge.className = "px-2 py-1 bg-indigo-600 rounded text-xs font-bold text-white mb-1";
            badge.innerText = entry.gate.type;
            infoCol.appendChild(badge);
            const sub = document.createElement('div');
            sub.className = "text-[9px] text-slate-400";
            sub.innerText = `Q${entry.gate.target}`;
            infoCol.appendChild(sub);

            // Controls info
            if (entry.gate.controls && entry.gate.controls.length) {
                const ctrls = document.createElement('div');
                ctrls.className = "text-[8px] text-slate-500";
                ctrls.innerText = `Ctrl: ${entry.gate.controls.join(',')}`;
                infoCol.appendChild(ctrls);
            }
        } else {
            const txt = document.createElement('div');
            txt.className = "text-[10px] text-slate-500 uppercase tracking-wider font-bold";
            txt.innerText = "Initial State";
            infoCol.appendChild(txt);
        }
        row.appendChild(infoCol);

        // Bar Chart
        const chart = document.createElement('div');
        chart.className = "flex-1 h-16 flex items-center justify-between gap-[1px] bg-slate-950/50 p-1 rounded relative";

        // Center line
        const centerLine = document.createElement('div');
        centerLine.className = "absolute left-0 right-0 top-1/2 h-[1px] bg-slate-700 z-0";
        chart.appendChild(centerLine);

        entry.state.forEach((amp, idx) => {
            const mag = amp.mag(); // Height is magnitude
            const phase = amp.phase(); // range -PI to PI

            const barContainer = document.createElement('div');
            barContainer.className = "flex-1 h-full relative group"; // Relative for absolute positioning

            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = "hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[9px] p-1 rounded whitespace-nowrap z-50 pointer-events-none";
            tooltip.innerHTML = `|${idx.toString(2).padStart(QUBITS, '0')}⟩<br>Mag: ${mag.toFixed(2)}<br>Phase: ${(phase / Math.PI).toFixed(2)}π`;
            barContainer.appendChild(tooltip);

            if (mag > 0.01) {
                const bar = document.createElement('div');
                const hue = (phase / (2 * Math.PI) * 360) + 180;
                bar.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
                bar.style.position = "absolute";
                bar.style.left = "10%";
                bar.style.width = "80%";
                bar.style.height = (mag * 50) + "%"; // Max height 50% of container (from center to edge)

                const isDown = amp.re < -0.001;

                if (isDown) {
                    bar.style.top = "50%"; // Starts at center, grows down
                    bar.style.transformOrigin = "top";
                } else {
                    bar.style.bottom = "50%"; // Starts at center, grows up
                    bar.style.transformOrigin = "bottom";
                }

                barContainer.appendChild(bar);

                // State Label
                const label = document.createElement('div');
                label.className = "absolute text-[7px] text-slate-400 font-mono pointer-events-none w-full text-center";
                // Position based on bar direction to avoid overlap
                if (isDown) {
                    label.style.top = `calc(50% + ${mag * 50}% + 2px)`;
                } else {
                    label.style.bottom = `calc(50% + ${mag * 50}% + 2px)`;
                }
                label.innerText = `|${idx.toString(2).padStart(QUBITS, '0')}⟩`;
                barContainer.appendChild(label);
            }
            chart.appendChild(barContainer);
        });

        row.appendChild(chart);
        scrollContainer.appendChild(row);
    }
}

function createTextSprite(text, color = '#94a3b8', scale=1.2) {
    const formattedText = text.replace('|', '∣').replace('>', '⟩');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128; canvas.height = 64;

    ctx.fillStyle = color;
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = color; ctx.font = 'Bold 32px monospace'; ctx.textAlign = 'center';
    ctx.fillText(formattedText, 64, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(scale, scale/2, 1);
    return sprite;
}

function initCorkscrew() {
    const container = document.getElementById('three-corkscrew-container');
    if (corkscrew.renderer) { corkscrew.renderer.setSize(container.clientWidth, container.clientHeight); return; }
    corkscrew.scene = new THREE.Scene();
    corkscrew.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    corkscrew.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    corkscrew.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(corkscrew.renderer.domElement);
    corkscrew.controls = new THREE.OrbitControls(corkscrew.camera, corkscrew.renderer.domElement);
    corkscrew.camera.position.set(-7.5, 0, 15);
    corkscrew.controls.target.set(-7.5, 0, -10);
    corkscrew.controls.update();

    const grid = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    grid.position.y = -3;
    corkscrew.scene.add(grid);

    for (let i = 0; i < STATES; i++) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 }));
        corkscrew.scene.add(line);
        corkscrew.lines.push(line);

        const needleGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
        const needle = new THREE.Line(needleGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        corkscrew.scene.add(needle);
        corkscrew.needles.push(needle);

        const label = createTextSprite(`|${i.toString(2).padStart(QUBITS, '0')}⟩`);
        label.position.set(i - (STATES / 2 - 0.5), -2.5, 2);
        corkscrew.scene.add(label);
        corkscrew.labels.push(label);
    }

    const compositeGeom = new THREE.BufferGeometry();
    compositeGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3));
    corkscrew.compositeLine = new THREE.Line(compositeGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 }));
    corkscrew.scene.add(corkscrew.compositeLine);
}

function renderCorkscrew() {
    if (!corkscrew.renderer) return;
    const BASE_RADIUS = 1.8;
    const POINTS = 100;
    const PROPAGATION_STEP = 0.15;
    const SPIRAL_WAVELENGTH = 1.2;

    const compositePoints = Array.from({ length: POINTS }, () => new Complex(0, 0));

    stateVector.forEach((amp, idx) => {
        const prob = amp.magSq();
        const line = corkscrew.lines[idx];
        const needle = corkscrew.needles[idx];
        const label = corkscrew.labels[idx];
        if (!line) return;

        if (prob < 0.001) {
            line.visible = false; needle.visible = false; label.material.opacity = 0.1;
            return;
        }

        line.visible = true; needle.visible = true; label.material.opacity = 1;
        line.material.color.setHSL(idx / STATES, 0.8, 0.5);

        const pos = line.geometry.attributes.position.array;
        const phase0 = amp.phase();
        const radius = Math.sqrt(prob) * BASE_RADIUS;
        const xCenter = idx - (STATES / 2 - 0.5);

        for (let i = 0; i < POINTS; i++) {
            const z = i * PROPAGATION_STEP;
            const totalPhase = phase0 + (z * SPIRAL_WAVELENGTH) - animationTime;

            const localX = Math.cos(totalPhase) * radius;
            const localY = Math.sin(totalPhase) * radius;

            pos[i * 3] = xCenter + localX;
            pos[i * 3 + 1] = localY;
            pos[i * 3 + 2] = -z;

            compositePoints[i] = compositePoints[i].add(new Complex(localX, localY));
        }
        line.geometry.attributes.position.needsUpdate = true;

        needle.position.set(xCenter, 0, 0);
        needle.rotation.z = phase0 - animationTime;
        needle.scale.setScalar(radius);
    });

    const cPos = corkscrew.compositeLine.geometry.attributes.position.array;
    for (let i = 0; i < POINTS; i++) {
        const z = i * PROPAGATION_STEP;
        cPos[i * 3] = -(STATES / 2 + 6) + compositePoints[i].re;
        cPos[i * 3 + 1] = compositePoints[i].im;
        cPos[i * 3 + 2] = -z;
    }
    corkscrew.compositeLine.geometry.attributes.position.needsUpdate = true;

    corkscrew.renderer.render(corkscrew.scene, corkscrew.camera);
}

function updateDecayMethod() {
    const selector = document.getElementById('decay-selector');
    const value = parseFloat(selector.value);
    
    // Update the uniform in the shader material
    if (wavefront.mesh && wavefront.mesh.material.uniforms.uDecayType) {
        wavefront.mesh.material.uniforms.uDecayType.value = value;
    }
}

function initWavefront() {
    const container = document.getElementById('three-wavefront-container');
    wavefront.container = container;
    if (wavefront.renderer) {
        wavefront.renderer.setSize(container.clientWidth, container.clientHeight);
        return;
    }

    wavefront.scene = new THREE.Scene();
    wavefront.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    wavefront.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    wavefront.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(wavefront.renderer.domElement);

    wavefront.controls = new THREE.OrbitControls(wavefront.camera, wavefront.renderer.domElement);
    wavefront.camera.position.set(0, 15, 20);
    wavefront.controls.update();

    // Plane Setup
    const segments = 1024;
    wavefront.geometry = new THREE.PlaneGeometry(20, 20, segments, segments);
    const count = wavefront.geometry.attributes.position.count;
    wavefront.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    // Data to send to the GPU
    const waveUniforms = {
        uTime: { value: 0 },
        uAmplitudes: { value: new Float32Array(32) },
        uPhases: { value: new Float32Array(32) },
        uEmitterCoords: { value: [] }, // Array of Vector2
        uDecayType: { value: 0.0 }
    };

    // Populate emitter coordinates once
    for (let i = 0; i < 32; i++) {
        const coords = getEmitterCoords(i);
        waveUniforms.uEmitterCoords.value.push(new THREE.Vector2(coords.x, coords.y));
    }

    const shaderMaterial = new THREE.ShaderMaterial({
        uniforms: waveUniforms,
        vertexShader: `
        varying float vZ;
        varying float vNetPhase;
        uniform float uTime;
        uniform float uAmplitudes[32];
        uniform float uPhases[32];
        uniform vec2 uEmitterCoords[32];
        uniform float uDecayType;

        void main() {
            float realSum = 0.0;
            float imagSum = 0.0;

            for (int i = 0; i < 32; i++) {
                if (uAmplitudes[i] < 0.001) continue;
                
                float d = distance(position.xy, uEmitterCoords[i]);
                float decay;
                if(uDecayType < 0.5){                    
                   decay = exp(-pow(d, 2.0) * 0.4);
                }
                else {
                   decay = 1.0 / (1.0 + d * 0.5);
                }
                float angle = d * 2.5 - uTime + uPhases[i];
                
                realSum += uAmplitudes[i] * cos(angle) * decay;
                imagSum += uAmplitudes[i] * sin(angle) * decay;
            }

            float netMag = sqrt(realSum * realSum + imagSum * imagSum);
            vNetPhase = atan(imagSum, realSum);
            vZ = sin(vNetPhase) * netMag * 2.5;

            vec3 newPosition = position;
            newPosition.z = vZ;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `,
        fragmentShader: `
        varying float vZ;
        varying float vNetPhase;

        void main() {
            // Smoothly blend colors based on the phase calculated in vertex shader
            float hue = 0.55 + (vNetPhase / 6.2831) * 0.2;
            vec3 color = vec3(0.1, 0.5, 0.8); // Base Cyan logic
            
            // Simplified HSL to RGB conversion for the GPU
            gl_FragColor = vec4(color + (vNetPhase * 0.1), 0.9);
        }
    `,
        transparent: true
    });


    
    const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
    topLight.position.set(0, 50, 0);
    wavefront.scene.add(topLight);

    wavefront.mesh = new THREE.Mesh(wavefront.geometry, shaderMaterial);
    wavefront.mesh.rotation.x = -Math.PI / 2;
    wavefront.scene.add(wavefront.mesh);

    createWavefrontLabels();

    const ambientLight = new THREE.AmbientLight(0x404040);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 20, 10);
    wavefront.scene.add(ambientLight, pointLight);
}                        

function createWavefrontLabels() {
    wavefront.labels = [];
    for (let i = 0; i < STATES; i++) {
        const coords = getEmitterCoords(i);
        const label = createTextSprite(`|${i.toString(2).padStart(5, '0')}>`,
                                       color='#ffffff');
        
        label.position.set(coords.x, 0.5, -coords.y); // Static height above the plane (Z axis is height)
        label.scale.set(1.5, 0.75, 1);
        
        wavefront.scene.add(label);
        wavefront.labels.push(label);
    }
}                                     

function renderWavefront() {
    if (!wavefront.renderer || activeTab !== 'wavefront' || !stateVector) return;

    // Update time for movement
    wavefront.mesh.material.uniforms.uTime.value = animationTime * 2.8;
    
    // Transfer amplitudes and phases to the GPU
    for (let i = 0; i < STATES; i++) {
        wavefront.mesh.material.uniforms.uAmplitudes.value[i] = stateVector[i].mag();
        wavefront.mesh.material.uniforms.uPhases.value[i] = stateVector[i].phase();
    }

    for (let i = 0; i < STATES; i++) {
        const mag = stateVector[i].mag();
        const label = wavefront.labels[i];
        
        if (mag > 0.1) {
            label.visible = true;
            label.material.opacity = Math.min(1.0, mag * 2.0);
            const d = 0; // At the center of the emitter
            const angle = - (animationTime * 2.8) + stateVector[i].phase();
            label.position.y = 2 + (Math.sin(angle) * mag * 1.0);
        } else {
            label.visible = false;
        }
    }

    wavefront.renderer.render(wavefront.scene, wavefront.camera);
}                                

function initQSphere() {
    const container = document.getElementById('three-qsphere-container');
    if (qsphere.renderer) { qsphere.renderer.setSize(container.clientWidth, container.clientHeight); return; }
    qsphere.scene = new THREE.Scene();
    qsphere.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    qsphere.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    qsphere.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(qsphere.renderer.domElement);
    qsphere.controls = new THREE.OrbitControls(qsphere.camera, qsphere.renderer.domElement);
    qsphere.camera.position.set(6, 6, 8);
    qsphere.camera.lookAt(0, 0, 0);

    const shellGeom = new THREE.SphereGeometry(4, 32, 32);
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.1 });
    const shell = new THREE.Mesh(shellGeom, shellMat);
    qsphere.scene.add(shell);

    for (let k = 0; k <= QUBITS; k++) {
        const phi = (k / QUBITS) * Math.PI;
        const r = 4 * Math.sin(phi);
        const y = 4 * Math.cos(phi);

        if (r > 0.1) {
            const ringGeom = new THREE.RingGeometry(r - 0.02, r + 0.02, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            qsphere.scene.add(ring);
        }
    }

    for (let m = 0; m < 8; m++) {
        const lon = (m / 8) * Math.PI * 2;
        const points = [];
        for (let lat = 0; lat <= 20; lat++) {
            const p = (lat / 20) * Math.PI;
            points.push(new THREE.Vector3(4 * Math.sin(p) * Math.cos(lon), 4 * Math.cos(p), 4 * Math.sin(p) * Math.sin(lon)));
        }
        const meridianGeom = new THREE.BufferGeometry().setFromPoints(points);
        const meridian = new THREE.Line(meridianGeom, new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.1 }));
        qsphere.scene.add(meridian);
    }

    for (let i = 0; i < STATES; i++) {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const hamming = i.toString(2).split('1').length - 1;
        const phi = (hamming / QUBITS) * Math.PI;
        const theta = (i / STATES) * Math.PI * 2;
        node.position.set(4 * Math.sin(phi) * Math.cos(theta), 4 * Math.cos(phi), 4 * Math.sin(phi) * Math.sin(theta));
        qsphere.scene.add(node);
        qsphere.nodes.push(node);

        const label = createTextSprite(`|${i.toString(2).padStart(QUBITS, '0')}⟩`, color='#ffffff');
        label.scale.set(0.75, 0.5, 0.75);
        label.position.copy(node.position).multiplyScalar(1.075);
        qsphere.scene.add(label);
        qsphere.labels.push(label);
        const points = [new THREE.Vector3(0, 0, 0), node.position.clone()];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const vectorLine = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ 
            color: 0x38bdf8, 
            transparent: true, 
            opacity: 0.3 
        }));
        
        qsphere.scene.add(vectorLine);
        qsphere.vectors.push(vectorLine);                
    }
}

function renderQSphere() {
    if (!qsphere.renderer) return;
    stateVector.forEach((amp, i) => {
        const prob = amp.magSq();
        const node = qsphere.nodes[i];
        const label = qsphere.labels[i];
        const vector = qsphere.vectors[i];
        if (!node || !label) return;

        if (prob < 0.001) {
            node.scale.setScalar(0.4);
            node.material.color.setHex(0x1e293b);
            node.visible = false;
            label.visible = false;
            vector.visible = false;
            node.position.set(0,0,0);       
        }
        else {
            label.visible = true;
            vector.visible = true;
            const hamming = i.toString(2).split('1').length - 1;
            const phi = (hamming / QUBITS) * Math.PI;
            const theta = (i / STATES) * Math.PI * 2;            

            let dynamicRadius = 4.0;
            const checkbox = document.getElementById('qsphere-dynamic');

            if(checkbox.checked){
                dynamicRadius = 0.5 + (prob * 3.5);
            }
                        
            const newPos = new THREE.Vector3(
                dynamicRadius * Math.sin(phi) * Math.cos(theta),
                dynamicRadius * Math.cos(phi),
                dynamicRadius * Math.sin(phi) * Math.sin(theta)
            );

            node.position.copy(newPos);
            node.visible = true;

            const baseSize = 0.5 + (hamming / QUBITS) * 1.5; 
            const importanceScale = baseSize * (0.8 + Math.sqrt(prob)); 

            node.scale.setScalar(importanceScale * 0.75);
            //node.scale.setScalar(0.5 + Math.sqrt(prob) * 1.5);
            node.material.color.setHSL(amp.phase() / (2 * Math.PI) + 0.5, 0.8, 0.5);
            label.position.copy(newPos).multiplyScalar(1.075);
            vector.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), newPos]);
            //vector.material.color.setHSL(amp.phase() / (2 * Math.PI) + 0.5, 0.8, 0.5);
            vector.material.opacity = Math.max(0.2, prob);
        }
    });
    qsphere.renderer.render(qsphere.scene, qsphere.camera);
}

// VSphere - BlochSphere for state vectors
//
// For each state vector with non-zero amplitude:
//    Compute the location on the BlochSphere where the vector
//       would point.  Use |amplitude| and phase for this.
//    Group all state vectors together that are at the same point.
//    Create labels for each group. If only one element in the group,
//       use the bitstring for the group, otherwise create a name.
//    Render the vectors and display the "legend" for the group names.
//


function createAxisLine(startVec, endVec, hexColor) {
    const geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
    const material = new THREE.LineBasicMaterial({ 
        color: new THREE.Color(hexColor),
        linewidth: 2,
        transparent: false,
        opacity: 1
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 0;
    return line;
}

function initVSphere() {
    if (vsphere.renderer) return;
    const container = document.getElementById('vsphere-container');
    vsphere.scene = new THREE.Scene();
    vsphere.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    vsphere.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    vsphere.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(vsphere.renderer.domElement);

    vsphere.controls = new THREE.OrbitControls(vsphere.camera, vsphere.renderer.domElement);
    vsphere.camera.position.set(8, 3, -8);
    vsphere.camera.lookAt(0, 0, 0);

    const yAxis = createAxisLine(new THREE.Vector3(2, 0, 0), new THREE.Vector3(-2, 0, 0), 0x29ba72);
    vsphere.scene.add(yAxis);

    const zAxis = createAxisLine(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -2, 0), 0x6c21b8);
    vsphere.scene.add(zAxis);

    const xAxis = createAxisLine(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -2), 0xca67db);
    vsphere.scene.add(xAxis);

    const labelY = createTextSprite("X", "#a6bfb3");
    labelY.position.set(2.4, 0, 0);
    vsphere.scene.add(labelY);

    const labelY2 = createTextSprite("-X", "#a6bfb3");
    labelY2.position.set(-2.4, 0, 0);
    vsphere.scene.add(labelY2);


    const labelZ = createTextSprite("0", "#a6bfb3");
    labelZ.position.set(0, 2.4, 0);
    vsphere.scene.add(labelZ);
    
    const labelZ2 = createTextSprite("1", "#a6bfb3");
    labelZ2.position.set(0, -2.4, 0);
    vsphere.scene.add(labelZ2);


    const labelX = createTextSprite("-Y", "#a6bfb3");
    labelX.position.set(0, 0, 2.4);
    vsphere.scene.add(labelX);

    const labelX2 = createTextSprite("Y", "#a6bfb3");
    labelX2.position.set(0, 0, -2.4);
    vsphere.scene.add(labelX2);

    // Grid and Sphere shell
    const sphereGeom = new THREE.SphereGeometry(2, 32, 32);
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0x1e293b, transparent: true, opacity: 0.1, wireframe: true });
    vsphere.scene.add(new THREE.Mesh(sphereGeom, sphereMat));
    
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    vsphere.scene.add(light);
    vsphere.scene.add(new THREE.AmbientLight(0x404040));

    function animate() {
        if (activeTab === 'vsphere') {
            requestAnimationFrame(animate);
            vsphere.renderer.render(vsphere.scene, vsphere.camera);
        }
    }
    animate();
}

function updateVSphereX() {
    if (!vsphere.scene) return;
    vsphere.vectors.forEach(v => vsphere.scene.remove(v));
    vsphere.vectors = [];
    vsphere.labels.forEach(v => vsphere.scene.remove(v));
    vsphere.labels = [];
    const legend = document.getElementById('vsphere-legend');
    legend.innerHTML = '';

    let meanRe = 0;
    let meanIm = 0;
    stateVector.forEach(amp => {
        meanRe += amp.re;
        meanIm += amp.im;
    });
    const meanAmp = new Complex(meanRe / STATES, meanIm / STATES);
    const meanMag = meanAmp.mag();
    
    const groups = new Map();

    stateVector.forEach((amp, i) => {
        if (amp.magSq() < 0.00001 && meanMag < 0.00001) return;

        // Bloch Sphere projection (standard mapping)
        const prob = amp.magSq();
        const theta = 2 * Math.acos(Math.sqrt(prob)); 
        const phi = amp.phase();
        
        // Round for grouping (precision 0.01)
        const key = `${theta.toFixed(2)}_${phi.toFixed(2)}`;
        if (!groups.has(key)) groups.set(key, { amp, theta, phi, states: [] });
        groups.get(key).states.push(i);
    });

    let groupCounter = 1;
    groups.forEach((data, key) => {
        const diff = data.amp.re - meanAmp.re;
        const azimuth = (i / STATES) * Math.PI * 2;
        
        const x = 2 * Math.sin(data.theta) * Math.cos(data.phi);
        const z = 2 * Math.sin(data.theta) * Math.sin(data.phi);
        const y = 2 * Math.cos(data.theta);

        // Color based on Phase (HSL: 0 to 360)
        const hue = (data.phi / (2 * Math.PI) * 360) + 180;
        const color = new THREE.Color();
        color.setHSL(hue, 1.0, 0.5);

        const dir = new THREE.Vector3(x, y, z);
        const origin = new THREE.Vector3(0, 0, 0);
        //const hex = data.states.length > 1 ? 0xff38d1 : 0x38bdf8;
        const arrow = new THREE.ArrowHelper(dir.normalize(), origin, 2, color.getHex(), 0.2, 0.1);
        arrow.renderOrder = 1;
        
        arrow.line.material.depthTest = false;
        arrow.cone.material.depthTest = false;
        
        vsphere.scene.add(arrow);
        vsphere.vectors.push(arrow);

        // Legend logic
        const labelText = data.states.length === 1 ? 
            `|${data.states[0].toString(2).padStart(QUBITS, '0')}⟩` : 
              `Group ${groupCounter++}`;

        const label = createTextSprite(labelText, '#ffffff', scale=0.8);
        label.position.copy(dir).multiplyScalar(2.25);
        vsphere.labels.push(label);
        vsphere.scene.add(label);
        
        const item = document.createElement('div');
        item.className = "flex items-center gap-2 p-2 rounded bg-slate-900/50 border-l-2";
        item.style.borderColor = `#${color.getHexString()}`;
        item.innerHTML = `
            <span class="text-[10px] font-mono text-white">${labelText}</span>
            <span class="text-[8px] text-slate-500">${data.states.length} states</span>
        `;
        legend.appendChild(item);
    });
}

function updateVSphere() {
    if (!vsphere.scene) return;
    vsphere.vectors.forEach(v => vsphere.scene.remove(v));
    vsphere.vectors = [];
    vsphere.labels.forEach(v => vsphere.scene.remove(v));
    vsphere.labels = [];
    
    // 1. Calculate the Mean Amplitude (Complex)
    let meanRe = 0;
    let meanIm = 0;
    stateVector.forEach(amp => {
        meanRe += amp.re;
        meanIm += amp.im;
    });
    const meanAmp = new Complex(meanRe / STATES, meanIm / STATES);
    const meanMag = meanAmp.mag();

    const legend = document.getElementById('vsphere-legend');
    legend.innerHTML = `<div class="text-[10px] text-yellow-500 mb-2 border-b border-yellow-500/20 pb-1">Mean Mag: ${meanMag.toFixed(4)}</div>`;

    stateVector.forEach((amp, i) => {
        if (amp.magSq() < 0.00001) return;

        // 2. Position logic: 
        // We treat the "Mean" as the vertical Z-axis.
        // The distance from the mean determines the 'spread'.
        const diff = amp.re - meanAmp.re; // Real part difference
        
        // Map the state index to a circle around the Z-axis (the Mean)
        const azimuth = (i / STATES) * Math.PI * 2;
        
        // Y-coordinate is the amplitude relative to the mean
        // If amp > mean, it points UP. If amp < mean, it points DOWN.
        const y = (amp.re - meanAmp.re) * 1.5; // Scaled for visibility
        const x = Math.cos(azimuth) * 1.5;
        const z = Math.sin(azimuth) * 1.5;

        const color = new THREE.Color();
        color.setHSL((amp.phase() + Math.PI) / (2 * Math.PI), 1.0, 0.5);

        // 3. Render the Vector Line
        const start = new THREE.Vector3(0, 0, 0);
        const end = new THREE.Vector3(x, y, z);
        
        const mat = new THREE.LineBasicMaterial({ color: color });
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geo, mat);
        
        vsphere.scene.add(line);
        vsphere.vectors.push(line);

        // 4. Add Label at the tip
        const label = createTextSprite(`|${i.toString(2).padStart(QUBITS, '0')}⟩`, `#${color.getHexString()}`, scale=0.8);
        label.position.copy(end.multiplyScalar(1.1));
        vsphere.scene.add(label);
        vsphere.labels.push(label);
    });
}



function initPolytopeView() {
    const container = document.getElementById('polytope-container');
    if (!container || polytopeViews.length > 0) return;
    container.innerHTML = '';
    polytopeViews = [];

    for (let q = 0; q < QUBITS; q++) {
        const card = document.createElement('div');
        card.className = "bg-slate-800 p-2 rounded-lg border border-slate-700 flex flex-col items-center min-h-[160px]";
        card.innerHTML = `<h4 class="text-[9px] font-bold text-slate-400 uppercase mb-1">Q${q}</h4><div id="poly-${q}" class="w-full h-28 block overflow-hidden"></div><div class="purity-val text-[8px] text-sky-400 mt-1"></div>`;
        container.appendChild(card);

        const viewContainer = card.querySelector(`#poly-${q}`);
        const w = viewContainer.clientWidth || 200, h = viewContainer.clientHeight || 112;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        renderer.setSize(w, h);
        viewContainer.appendChild(renderer.domElement);
        camera.position.set(3, 2, -4);
        camera.lookAt(0, 0, 0);
        const bloch = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ color: 0x475569, wireframe: true, transparent: true, opacity: 0.1 }));
        scene.add(bloch);

        const statePoint = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        scene.add(statePoint);
        const traceLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }));
        scene.add(traceLine);


        const yAxis = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), 2.0, 0x29ba72, 0.1, 0.05);
        scene.add(yAxis);

        const zAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), 2.0, 0x6c21b8, 0.1, 0.05);
        scene.add(zAxis);

        const xAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), 2.0, 0xca67db, 0.1, 0.05);
        scene.add(xAxis);

        const labelY = createTextSprite("|+>", "#a6bfb3");
        labelY.position.set(1.4, 0, 0);
        scene.add(labelY);

        const labelY2 = createTextSprite("|->", "#a6bfb3");
        labelY2.position.set(-1.4, 0, 0);
        scene.add(labelY2);


        const labelZ = createTextSprite("|0>", "#a6bfb3");
        labelZ.position.set(0, 1.4, 0);
        scene.add(labelZ);

        const labelZ2 = createTextSprite("|1>", "#a6bfb3");
        labelZ2.position.set(0, -1.4, 0);
        scene.add(labelZ2);


        const labelX = createTextSprite("|-i>", "#a6bfb3");
        labelX.position.set(0, 0, 1.4);
        scene.add(labelX);

        const labelX2 = createTextSprite("|i>", "#a6bfb3");
        labelX2.position.set(0, 0, -1.4);
        scene.add(labelX2);

        polytopeViews.push({ scene, camera, renderer, viewContainer, statePoint, traceLine, purityText: card.querySelector('.purity-val'), controls });
    }
}


function initHintonLabels() {
    const top = document.getElementById('hinton-top-labels');
    const left = document.getElementById('hinton-left-labels');
    if (!top || top.children.length > 0) return;
    for (let i = 0; i < STATES; i++) {
        const b = i.toString(2).padStart(QUBITS, '0');
        const tL = document.createElement('div'); tL.className = "hinton-label col"; tL.innerText = b; top.appendChild(tL);
        const lL = document.createElement('div'); lL.className = "hinton-label row"; lL.innerText = b; left.appendChild(lL);
    }
}

function updateViews(lastMatrix, lastGateInfo) {
    if (activeTab === 'history') updateHistoryView();
    updateCircuitView();
    updateMatrixDisplay(lastMatrix, lastGateInfo);
    updateVectorDisplay();
    updatePolytopeView();
    if (activeTab === 'vsphere') updateVSphere();
    updateHintonView();
    updateEntanglementGraph();
    updateInterpretation(lastGateInfo);
    const list = document.getElementById('probabilities-list');
    if (list) list.innerHTML = stateVector.map((amp, i) => amp.magSq() > 0.001 ? `<div class="p-1 text-sky-400 font-bold border-b border-slate-800">|${i.toString(2).padStart(QUBITS, '0')}⟩ ${(amp.magSq() * 100).toFixed(1)}%</div>` : '').join('');
}

function setInterpretation(label, content){
    const div = document.getElementById('insight-content');
    const tag = document.getElementById('insight-gate-tag');
    tag.innerText = label;
    div.innerHTML = content;
}

function updateInterpretation(info) {
    const content = document.getElementById('insight-content');
    const tag = document.getElementById('insight-gate-tag');
    if (!content || !tag) return;
    tag.innerText = info ? info.split(' ')[0] : "NONE";

    const interpretations = {
        'H': "Creates a superposition by mapping basis states to balanced linear combinations.",
        'X': "Bit-flip: maps |0⟩ to |1⟩ and vice versa.",
        'Y': "Bit and phase flip: introduces an imaginary phase component.",
        'Z': "Phase-flip: flips the sign of the |1⟩ component's amplitude.",
        'S': "Phase gate (√Z): rotates the state vector by π/2 around the Z-axis.",
        'T': "π/4 phase gate (⁴√Z): essential for universal fault-tolerant quantum computing.",
        'CNOT': "Entangles two qubits: flips the target if the control is |1⟩.",
        'CZ': "Conditional Phase Flip: Negates the phase only if both qubits are |1⟩.",
        'MCZ': "Multi-Controlled Phase: The core of the Grover reflection, flipping the sign only if all controlled qubits are set."
    };
    const gType = info ? info.split(' ')[0] : null;
    content.innerHTML = gType ? `<p>${interpretations[gType] || "Transforms the computational basis states through unitary evolution."}</p>` : `<p class="text-slate-400 italic">Drag a gate onto a qubit line to see how it transforms the quantum state.</p>`;
}

function updateVectorDisplay() {
    const vectorDiv = document.getElementById('vector-display');
    if (vectorDiv) {
        vectorDiv.innerHTML = stateVector.map((amp, i) => {
            const isNonZero = amp.magSq() > 1e-6;

            return `
                        <div class="flex justify-between items-center h-[26px] border-b border-slate-900 px-2 ${isNonZero ? 'bg-sky-500/10' : ''}">
                            <span class="text-[8px] text-slate-500 font-mono">|${i.toString(2).padStart(QUBITS, '0')}⟩</span>
                            <span class="text-[10px] font-mono ${isNonZero ? 'text-sky-300' : 'text-slate-700'}">
                                ${amp.toString() === "0" ? "0" : amp.toString()}
                            </span>
                        </div>
                    `;
        }).join('');
    }
}

function updateCircuitView() {
    stateVector.forEach((amp, i) => {
        const disk = document.getElementById(`disk-${i}`);
        if (!disk) return;
        const prob = amp.magSq();
        disk.querySelector('.phase-fill').style.width = disk.querySelector('.phase-fill').style.height = `${Math.sqrt(prob) * 100}%`;
        disk.querySelector('.phase-needle').style.transform = `rotate(${-amp.phase()}rad)`;
        disk.querySelector('.phase-needle').style.background = `hsl(${(amp.phase() / (2 * Math.PI) * 360) + 180}, 100%, 50%)`;                     
        disk.querySelector('.phase-fill').style.background = `hsl(${(amp.phase() / (2 * Math.PI) * 360) + 180}, 20%, 50%)`;                     
        
    });
    renderCircuitLines();
}

function updateMatrixDisplay(matrix, info) {
    const matDiv = document.getElementById('matrix-display');
    const titleEl = document.getElementById('matrix-title');
    if (titleEl) titleEl.innerText = info ? `Gate Matrix: ${info}` : "Gate Matrix";

    if (matDiv) {
        matDiv.innerHTML = '';
        for (let r = 0; r < STATES; r++) {
            for (let c = 0; c < STATES; c++) {
                const cell = document.createElement('div');
                const val = matrix ? matrix[r][c] : (r === c ? new Complex(1) : new Complex(0));
                cell.className = `matrix-cell ${val.magSq() > 0 ? 'text-sky-300 bg-sky-900/20' : 'text-slate-800'}`;
                cell.innerText = val.toString() === "0" ? "·" : val.toString();
                matDiv.appendChild(cell);
            }
        }
    }
}

function updatePolytopeView() {
    polytopeViews.forEach((view, q) => {
        let p0 = 0, p1 = 0, rho01 = new Complex(0, 0);
        const mask = 1 << ((QUBITS - 1) - q);
        stateVector.forEach((amp, i) => {
            const prob = amp.magSq();
            if (i & mask) p1 += prob; else {
                p0 += prob;
                const i1 = i | mask;
                rho01 = rho01.add(amp.mul(new Complex(stateVector[i1].re, -stateVector[i1].im)));
            }
        });
        const x = 2 * rho01.re, y = -2 * rho01.im, z = p0 - p1;
        const r = Math.sqrt(x * x + y * y + z * z);
        view.statePoint.position.set(x, z, y);
        view.traceLine.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, z, y)]);
        view.purityText.innerText = `Purity: ${((1 + r * r) / 2 * 100).toFixed(0)}% | R: ${r.toFixed(2)}`;
        //view.scene.rotation.y += 0.005;
        view.renderer.render(view.scene, view.camera);
    });
}

function updateHintonView() {
    const hinton = document.getElementById('hinton-container');
    if (!hinton) return;
    hinton.innerHTML = '';
    for (let i = 0; i < STATES; i++) {
        for (let j = 0; j < STATES; j++) {
            const val = stateVector[i].mul(new Complex(stateVector[j].re, -stateVector[j].im));
            const cell = document.createElement('div'); cell.className = "bg-slate-950 flex items-center justify-center";
            if (val.mag() > 0.001) {
                const inner = document.createElement('div');
                inner.style.width = inner.style.height = (Math.sqrt(val.mag()) * 18) + 'px';
                inner.style.backgroundColor = `hsl(${(val.phase() / (2 * Math.PI) * 360) + 180}, 80%, 50%)`;
                cell.appendChild(inner);
            }
            hinton.appendChild(cell);
        }
    }
}

function initEntanglementView() {
    const container = document.getElementById('three-entanglement-container');
    if (entanglementView.renderer) {
        entanglementView.renderer.setSize(container.clientWidth, container.clientHeight);
        return;
    }
    entanglementView.scene = new THREE.Scene();
    entanglementView.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    entanglementView.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    entanglementView.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(entanglementView.renderer.domElement);
    entanglementView.controls = new THREE.OrbitControls(entanglementView.camera, entanglementView.renderer.domElement);
    entanglementView.camera.position.set(0, 6, 10);

    // Create Qubit Nodes
    for (let i = 0; i < QUBITS; i++) {
        const angle = (i / QUBITS) * Math.PI * 2;
        const x = Math.cos(angle) * 4;
        const z = Math.sin(angle) * 4;

        const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 32, 32),
            new THREE.MeshPhongMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.5 })
        );
        node.position.set(x, 0, z);

        const label = createTextSprite(`Q${i}`, "#ffffff");
        label.position.set(x * 1.2, 0.8, z * 1.2);

        entanglementView.scene.add(node);
        entanglementView.scene.add(label);
        entanglementView.nodes.push(node);
    }

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(5, 10, 5);
    entanglementView.scene.add(light, new THREE.AmbientLight(0x404040));
}

function getNegativity(rdm) {
    // Calculates Negativity using the trace norm of the partial transpose
    // For stability in this single-file app without a full eigenvalue solver, 
    // we use the Purity Difference metric as a reliable proxy for visualization.
    return getPurityMetric(rdm);
}

function getGeometricMeasure(rdm) {
    // Uses the max diagonal element as a proxy for the geometric measure (overlap)
    let maxEig = 0;
    for (let i = 0; i < 4; i++) maxEig = Math.max(maxEig, rdm[i][i].re);
    return Math.max(0, 1 - maxEig);
}

function getPurityMetric(rdm) {
    // Purity of subsystem A (qubit 1)
    let rhoA = [[rdm[0][0].add(rdm[1][1]), rdm[0][2].add(rdm[1][3])],
                [rdm[2][0].add(rdm[3][1]), rdm[2][2].add(rdm[3][3])]];

    let purityA = rhoA[0][0].magSq() + rhoA[0][1].magSq() + rhoA[1][0].magSq() + rhoA[1][1].magSq();
    let pairPurity = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) pairPurity += rdm[r][c].magSq();
    return Math.max(0, pairPurity - purityA) * 2;
}

function calculateBipartiteEntanglement(q1, q2) {
    const metric = document.getElementById('metric-selector')?.value || 'purity';
    let rdm = Array(4).fill(0).map(() => Array(4).fill(new Complex(0, 0)));
    const mask1 = 1 << (QUBITS - 1 - q1);
    const mask2 = 1 << (QUBITS - 1 - q2);

    // Optimized RDM construction
    for (let i = 0; i < STATES; i++) {
        if (stateVector[i].magSq() < 1e-9) continue;
        for (let j = 0; j < STATES; j++) {
            if (stateVector[j].magSq() < 1e-9) continue;

            // Check match of environment bits
            // If bits other than q1, q2 differ, the trace is zero
            if (((i ^ j) & ~(mask1 | mask2)) !== 0) continue;

            const row = (((i & mask1) ? 2 : 0) + ((i & mask2) ? 1 : 0));
            const col = (((j & mask1) ? 2 : 0) + ((j & mask2) ? 1 : 0));
            rdm[row][col] = rdm[row][col].add(stateVector[i].mul(new Complex(stateVector[j].re, -stateVector[j].im)));
        }
    }

    if (metric === 'negativity') return getNegativity(rdm);
    if (metric === 'geometric') return getGeometricMeasure(rdm);
    return getPurityMetric(rdm);
}

function classifyEntanglementState() {
    // Placeholder for future state classification logic
}


function updateEntanglementGraph() {
    if (!entanglementView.renderer) return;

    // Clear existing edges
    entanglementView.edges.forEach(e => entanglementView.scene.remove(e));
    entanglementView.edges = [];

    const metric = document.getElementById('metric-selector')?.value || 'purity';

    for (let i = 0; i < QUBITS; i++) {
        for (let j = i + 1; j < QUBITS; j++) {
            const strength = calculateBipartiteEntanglement(i, j);

            if (strength > 0.01) {
                const v1 = entanglementView.nodes[i].position;
                const v2 = entanglementView.nodes[j].position;
                const distance = v1.distanceTo(v2);

                const geometry = new THREE.CylinderGeometry(0.04 * strength, 0.04 * strength, distance, 8);

                // COLOR LOGIC:
                // Purity/Negativity = Cyan (0.5 HSL)
                // Geometric = Purple/Magenta (0.8 HSL)
                let hue = (metric === 'geometric') ? 0.8 : 0.5;

                const edgeMaterial = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().setHSL(hue, 1, 0.4 + (strength * 0.4)),
                    transparent: true,
                    opacity: 0.4 + (strength * 0.6),
                    emissive: new THREE.Color().setHSL(hue, 1, 0.5),
                    emissiveIntensity: strength * 2
                });

                const edge = new THREE.Mesh(geometry, edgeMaterial);

                // Positioning
                edge.position.copy(v1).lerp(v2, 0.5);
                edge.lookAt(v2);
                edge.rotateX(Math.PI / 2);

                entanglementView.scene.add(edge);
                entanglementView.edges.push(edge);
            }
        }
    }

    classifyEntanglementState();
    entanglementView.renderer.render(entanglementView.scene, entanglementView.camera);
}


function animate() {
    requestAnimationFrame(animate);
    animationTime += 0.04;
    if (activeTab === 'corkscrew') renderCorkscrew();
    if (activeTab === 'wavefront') renderWavefront();                    
    if (activeTab === 'qsphere') renderQSphere();
    if (activeTab === 'hinton') {
        polytopeViews.forEach(view => {
            if (view.controls) {
                view.controls.update();
                view.renderer.render(view.scene, view.camera);
            }
        });
    }
    if (activeTab === 'entanglement' && entanglementView.renderer) {
        entanglementView.controls.update();
        entanglementView.renderer.render(entanglementView.scene, entanglementView.camera);
    }
}

function init() {
    document.documentElement.style.setProperty('--states', STATES);
    const container = document.getElementById('view-circuit');
    for (let i = 0; i < STATES; i++) {
        const clone = document.getElementById('disk-template').content.cloneNode(true);
        clone.querySelector('.phase-disk').id = `disk-${i}`;
        clone.querySelector('.state-label').innerText = `|${i.toString(2).padStart(QUBITS, '0')}⟩`;
        container.appendChild(clone);
    }
    const circuitRows = document.getElementById('circuit-rows');
    for (let i = 0; i < QUBITS; i++) {
        const row = document.createElement('div');
        row.className = "relative h-8 flex items-center";
        row.innerHTML = `<span class="absolute -left-8 text-[10px] font-bold text-slate-500">Q${i}</span><div class="qubit-line"></div><div id="row-${i}" class="gate-row flex gap-4 px-4 w-full h-full items-center relative z-10"></div>`;
        circuitRows.appendChild(row);
        const finalR = document.getElementById(`row-${i}`);
        finalR.addEventListener('dragover', e => { e.preventDefault(); finalR.classList.add('drag-over'); });
        finalR.addEventListener('dragleave', () => finalR.classList.remove('drag-over'));
        finalR.addEventListener('drop', e => handleDrop(e, i));
    }
    createToolTip();
    animate(); runSimulation();
}

function renderCircuitLines() {
    for (let q = 0; q < QUBITS; q++) {
        const row = document.getElementById(`row-${q}`);
        if (!row) continue;
        row.innerHTML = '';
        circuit.forEach((gate, idx) => {
            const gEl = document.createElement('div');
            gEl.className = `relative w-7 h-7 flex items-center justify-center rounded cursor-pointer shrink-0 z-20 ${idx < currentStep ? '' : 'opacity-10'}`;

            let tooltiptext = `${gate.type} Gate`;
            if (gate.type == 'H'){
                tooltiptext = '<p>Hadamard Gate<br>180&deg; (&pi;) rotation about the Hadamard axis (45&deg; between X and Z axis). The "superposition" gate.</p>';
            } else if(gate.type == 'X'){
                tooltiptext = '<p>X Gate<br>180&deg; (&pi;) rotation about the X axis. Called the "not" gate, as it flips 0 to 1 and vice versa</p>';
            } else if(gate.type == 'Y'){
                tooltiptext = '<p>Y Gate<br>180&deg; (&pi;) rotation about the Y axis. Combination of X and Z gates.</p>';
            } else if(gate.type == 'Z'){
                tooltiptext = '<p>Z Gate<br>180&deg; (&pi;) rotation about the Z axis. This is a phase manipulation gate.</p>';
            } else if(gate.type == 'S'){
                tooltiptext = '<p>S Gate<br>90&deg; (&pi;/2) rotation about the Z axis. This is a phase manipulation gate.</p>';
            } else if(gate.type == 'T'){
                tooltiptext = '<p>T Gate<br>45&deg; (&pi;/4) rotation about the Z axis. This is a phase manipulation gate.</p>';
            } else if (gate.type == 'CNOT'){
                tooltiptext = `<p>Controlled X (CNOT) Gate<br>180&deg; (&pi;) rotation about the X axis if control qubit is 1.</p><ol><li>Control: q${gate.controls[0]}</li></ol>`;
            } else if (gate.type == 'CU' || gate.type == 'U'){
                let angletext = `<li>Theta: ${gate.angles[0]}</li><li>Phi: ${gate.angles[1]}</li><li>Lambda: ${gate.angles[2]}</li></ol>`;
                if (gate.type == 'CU'){
                    tooltiptext = `<p>Controlled U Gate<br>Arbitrary rotation about the space if control qubit is 1.</p><ol><li>Control: q${gate.controls[0]}</li>${angletext}`;
                } else  {
                    tooltiptext = `<p>Unitary Gate<br>Arbitrary rotation about the space.</p><ol>${angletext}`;
                }
            } else if(gate.type == 'CZ'){
                tooltiptext = `<p>Controlled Z Gate<br>180&deg; (&pi;) rotation about the Z axis if control qubit is 1.</p><ol><li>Control: q${gate.controls[0]}</li></ol>`;
            } else if(gate.type == 'MCZ'){
                tooltiptext = `<p>Controlled Z Gate<br>180&deg; (&pi;) rotation about the Z axis if all control qubits are 1.</p><ol><li>Target: q${gate.target}</li><li>Control: ${gate.controls.map(x => "q"+x).join(", ")}</li></ol>`;
            } else if(gate.type == 'SWAP'){
                tooltiptext = '<p>Swap Gate<br>Swaps the state of the two qubits.</p>';
            }
            
            if (gate.target === q) {
                let t = gate.type;
                if (gate.type === 'SWAP') {
                    t = 'x';
                } else if (gate.type === 'CU') {
                    t = 'U';
                } else if (gate.type === 'CZ' || gate.type === 'MCZ') {
                    t = 'Z';
                }

                gEl.innerText = t;

                gEl.classList.add('bg-sky-600', 'text-white', 'font-bold', 'text-[9px]');
                gEl.onclick = () => {
                    circuit.splice(idx, 1);
                    if (currentStep > idx) currentStep--;
                    runSimulation();
                };
            } else if (gate.controls.includes(q)) {
                if (gate.type === 'SWAP') {
                    gEl.innerText = '×';
                    gEl.classList.add('text-white', 'font-bold');
                } else {
                    gEl.innerHTML = '<div class="w-2.5 h-2.5 bg-white rounded-full"></div>';
                }
            }

            gEl.addEventListener('mouseenter', () => {
                const rect = gEl.getBoundingClientRect();
                globalTooltip.innerHTML = tooltiptext;
                globalTooltip.style.left = `${rect.left + rect.width / 2}px`;
                globalTooltip.style.top = `${rect.top + 30}px`;
                globalTooltip.style.transform = "translateX(-50%)";
                
                globalTooltip.classList.remove('hidden');
            });

            gEl.addEventListener('mouseleave', () => {
                globalTooltip.classList.add('hidden');
            });

            

            
            row.appendChild(gEl);
        });
    }
}

function handleDragStart(e, type) { e.dataTransfer.setData("text", type); }
function handleDrop(e, q) {
    e.preventDefault();
    const type = e.dataTransfer.getData("text");
    let controls = [];
    let angles = []
    if (type === 'CNOT' || type === 'CZ' || type === 'CU' || type === 'SWAP') {
        const promptText = type === 'SWAP' ? `Second qubit for SWAP (0-${QUBITS - 1}):` : `Control for ${type} (0-${QUBITS - 1}):`;
        const c = prompt(promptText);
        if (c === null || isNaN(parseInt(c)) || parseInt(c) === q) return;
        controls = [parseInt(c)];
    } else if (type === 'MCZ') {
        controls = Array.from({ length: QUBITS }, (_, i) => i).filter(i => i !== q);
    }
    if (type === 'U' || type === 'CU') {
        const c = prompt(`Theta, Phi, Lambda:`);
        if (c === null) return;
        angles = c.split(/\s*,\s*/).map(item => {
            const expression = item.toLowerCase().replace(/pi/g, Math.PI);

            return Function(`return (${expression})`)();
        });
    }
    circuit.push({ type, target: q, controls, angles });
    currentStep = circuit.length; runSimulation();
}

function addGroverDiffusion() {
    const hGates = Array.from({ length: QUBITS }, (_, i) => ({ type: 'H', target: i, controls: [] }));
    const xGates = Array.from({ length: QUBITS }, (_, i) => ({ type: 'X', target: i, controls: [] }));
    const mczGate = { type: 'MCZ', target: QUBITS - 1, controls: Array.from({ length: QUBITS - 1 }, (_, i) => i) };

    circuit.push(...hGates, ...xGates, mczGate, ...xGates, ...hGates);
    currentStep = circuit.length;
    runSimulation();
    setInterpretation('Grover', 'The Grover Diffusion Operator.');

}

function addSuperpositionState() {
    resetCircuit();
    for (let i=0;i<QUBITS;i++){
        circuit.push({
            type: 'H',
            target: i,
            controls: [],
            angles: []
        });
    }
    currentStep = circuit.length;
    runSimulation();
    setInterpretation('Superposition', 'Circuit is cleared and all qubits are in superposition');
}


function addBellState() {
    const hGate = { type: 'H', target: 0, controls: [], angles: [] };
    const cnotGate = { type: 'CNOT', target: 1, controls: [0], angles: [] };

    circuit.push(hGate, cnotGate);

    currentStep = circuit.length;
    runSimulation();
    setInterpretation('Bell State', 'The Bell State creates the 4 maximally entangled quantum states of two qubits.');
}

function addQFT() {
    for (let i = 0; i < QUBITS; i++) {
        circuit.push({ type: 'H', target: i, controls: [], angles: [] });

        for (let j = i + 1; j < QUBITS; j++) {
            const distance = j - i;
            const angle = (2 * Math.PI) / Math.pow(2, distance + 1);

            circuit.push({
                type: 'CU',
                target: i,
                controls: [j],
                angles: [0, 0, angle]
            });
        }
    }

    for (let i = 0; i < Math.floor(QUBITS / 2); i++) {
        const target1 = i;
        const target2 = QUBITS - 1 - i;
        circuit.push({ type: 'SWAP', target: target1, controls: [target2], angles: [] });
    }

    currentStep = circuit.length;
    runSimulation();

    setInterpretation('QFT', 'The Quantum Fourier Transform operator.');
}

function addIQFT() {
    for (let i = 0; i < Math.floor(QUBITS / 2); i++) {
        const target1 = i;
        const target2 = QUBITS - 1 - i;
        circuit.push({ type: 'SWAP', target: target1, controls: [target2], angles: [] });
    }

    for (let i = QUBITS - 1; i >= 0; i--) {
        for (let j = QUBITS - 1; j > i; j--) {
            const distance = j - i;
            const angle = -(2 * Math.PI) / Math.pow(2, distance + 1);

            circuit.push({
                type: 'CU',
                target: i,
                controls: [j],
                angles: [0, 0, angle]
            });
        }

        circuit.push({ type: 'H', target: i, controls: [], angles: [] });
    }

    currentStep = circuit.length;
    runSimulation();
    setInterpretation('invQFT', 'The Inverse Quantum Fourier Transform operator.');
}

function openRecipeWindow() {
    const windowFeatures = "width=600,height=500,left=100,top=100,resizable=yes,scrollbars=yes";
    window.open("recipes/recipes.html", "Recipes", windowFeatures);
}

function stepForward() { if (currentStep < circuit.length) { currentStep++; runSimulation(); } }
function stepBack() { if (currentStep > 0) { currentStep--; runSimulation(); } }
function resetStep() { currentStep = 0; runSimulation(); }
function resetCircuit() { circuit = []; currentStep = 0; runSimulation(); }
