// --- AUDIO SYNTHESIZER (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq = 440, type = 'sine', duration = 0.15) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

const alertSounds = {
  countdown: () => playBeep(600, 'sine', 0.1),
  transition: () => playBeep(900, 'triangle', 0.3),
  finished: () => {
    playBeep(523.25, 'sine', 0.15);
    setTimeout(() => playBeep(659.25, 'sine', 0.15), 150);
    setTimeout(() => playBeep(783.99, 'sine', 0.3), 300);
  }
};

// --- APP STATE ---
let exercises = JSON.parse(localStorage.getItem('timer_exercises')) || [
  { id: '1', name: 'Pushups', duration: 30 },
  { id: '2', name: 'Squats', duration: 45 }
];
let restDuration = parseInt(localStorage.getItem('timer_rest')) || 15;

let currentStepIndex = 0; // Index in generated sequence
let workoutSequence = [];
let timerInterval = null;
let timeRemaining = 0;
let isPaused = false;

// --- DOM ELEMENTS ---
const setupView = document.getElementById('setup-view');
const workoutView = document.getElementById('workout-view');
const exerciseList = document.getElementById('exercise-list');
const addForm = document.getElementById('add-exercise-form');
const restInput = document.getElementById('rest-duration');

const phaseBadge = document.getElementById('phase-badge');
const currentTitle = document.getElementById('current-title');
const timerCountdown = document.getElementById('timer-countdown');
const nextTitle = document.getElementById('next-title');
const pauseBtn = document.getElementById('pause-btn');

const progressBar = document.getElementById('progress-bar');
const CIRCUMFERENCE = 2 * Math.PI * 120; // 753.98
let totalStepDuration = 0;
progressBar.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;

// --- HELPER FUNCTIONS ---
function parseTime(input) {
  return parseInt(input, 10) || 0;
}

function formatTime(seconds) {
  return `${seconds}s`;
}

function saveData() {
  localStorage.setItem('timer_exercises', JSON.stringify(exercises));
  localStorage.setItem('timer_rest', restDuration);
}

// --- SETUP VIEW LOGIC ---
function renderExercises() {
  exerciseList.innerHTML = '';
  exercises.forEach((ex, index) => {
    const li = document.createElement('li');
    li.className = 'exercise-item';
    li.innerHTML = `
      <span><strong>${ex.name}</strong> (${formatTime(ex.duration)})</span>
      <div class="exercise-item-actions">
        <button class="btn-icon" onclick="moveExercise(${index}, -1)">▲</button>
        <button class="btn-icon" onclick="moveExercise(${index}, 1)">▼</button>
        <button class="btn-icon" onclick="deleteExercise(${index})" style="color:var(--danger)">✕</button>
      </div>
    `;
    exerciseList.appendChild(li);
  });
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('ex-name');
  const durInput = document.getElementById('ex-duration');
  
  const parsedDur = parseTime(durInput.value);
  if (parsedDur <= 0) return;

  exercises.push({
    id: Date.now().toString(),
    name: nameInput.value.trim(),
    duration: parsedDur
  });

  nameInput.value = '';
  durInput.value = '';
  saveData();
  renderExercises();
});

restInput.addEventListener('change', (e) => {
  restDuration = Math.max(0, parseInt(e.target.value, 10) || 0);
  saveData();
});

window.deleteExercise = (index) => {
  exercises.splice(index, 1);
  saveData();
  renderExercises();
};

window.moveExercise = (index, direction) => {
  const target = index + direction;
  if (target < 0 || target >= exercises.length) return;
  const temp = exercises[index];
  exercises[index] = exercises[target];
  exercises[target] = temp;
  saveData();
  renderExercises();
};

// --- WORKOUT RUNNER LOGIC ---
function buildSequence() {
  workoutSequence = [];
  exercises.forEach((ex, idx) => {
    workoutSequence.push({ type: 'WORK', name: ex.name, duration: ex.duration });
    if (restDuration > 0 && idx < exercises.length - 1) {
      workoutSequence.push({ type: 'REST', name: 'REST', duration: restDuration });
    }
  });
}

function startWorkout() {
  if (exercises.length === 0) return alert('Add at least one exercise!');
  buildSequence();
  currentStepIndex = 0;
  setupView.classList.remove('active');
  workoutView.classList.add('active');
  runStep();
}

function runStep() {
  clearInterval(timerInterval);
  if (currentStepIndex >= workoutSequence.length) {
    alertSounds.finished();
    endWorkout();
    return;
  }

  const step = workoutSequence[currentStepIndex];
  timeRemaining = step.duration;
  totalStepDuration = step.duration; // 1. Set total duration BEFORE updating display

  // 2. Snap ring back to 100% instantly without animation delay
  progressBar.style.transition = 'none';
  progressBar.style.strokeDashoffset = '0';
  progressBar.getBoundingClientRect(); // Force browser reflow
  progressBar.style.transition = 'stroke-dashoffset 1s linear, stroke 0.3s ease';

  // Update UI text
  phaseBadge.textContent = step.type;
  workoutView.className = `view active ${step.type.toLowerCase()}`;
  currentTitle.textContent = step.name;
  
  const nextStep = workoutSequence[currentStepIndex + 1];
  nextTitle.textContent = nextStep ? `${nextStep.name} (${formatTime(nextStep.duration)})` : 'Workout Complete!';

  updateTimerDisplay();
  alertSounds.transition();

  timerInterval = setInterval(() => {
    if (isPaused) return;
    
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 3 && timeRemaining > 0) {
      alertSounds.countdown();
    }

    if (timeRemaining <= 0) {
      currentStepIndex++;
      runStep();
    }
  }, 1000);
}

function updateTimerDisplay() {
  timerCountdown.textContent = formatTime(timeRemaining);
  
  // Guard against division by zero
  if (!totalStepDuration) return;

  // Aim for upcoming second so CSS smoothly animates towards it
  const targetTime = Math.max(0, timeRemaining - 1);
  const fraction = targetTime / totalStepDuration;
  progressBar.style.strokeDashoffset = CIRCUMFERENCE - (fraction * CIRCUMFERENCE);
}

function endWorkout() {
  clearInterval(timerInterval);
  workoutView.classList.remove('active');
  setupView.classList.add('active');
  isPaused = false;
  pauseBtn.textContent = 'Pause';
}

// Control Event Listeners
document.getElementById('start-workout-btn').addEventListener('click', startWorkout);
document.getElementById('quit-btn').addEventListener('click', endWorkout);

pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
});

document.getElementById('skip-btn').addEventListener('click', () => {
  currentStepIndex++;
  runStep();
});

// Initial Setup
restInput.value = restDuration;
renderExercises();

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW Registered'))
      .catch(err => console.error('SW Registration Failed', err));
  });
}