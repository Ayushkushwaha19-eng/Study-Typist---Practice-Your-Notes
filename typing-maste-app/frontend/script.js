// State Management
let currentTestId = null;
let currentContent = '';
let testStarted = false;
let timer = null;
let seconds = 0;
let currentCharIndex = 0;
let correctChars = 0;
let wrongChars = 0;
let isFinished = false;
let resultSaved = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadStatus = document.getElementById('uploadStatus');
const testsList = document.getElementById('testsList');
const textDisplay = document.getElementById('textDisplay');
const typingInput = document.getElementById('typingInput');
const startBtn = document.getElementById('startBtn');
const wpmDisplay = document.getElementById('wpmDisplay');
const accuracyDisplay = document.getElementById('accuracyDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const testTitle = document.getElementById('testTitle');

// ============ TAB MANAGEMENT ============
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'tests') loadTests();
    if (tabName === 'practice') resetTest();
}

// ============ FILE UPLOAD ============
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
});

async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showUploadStatus('Uploading...', 'info');
    
    try {
        const response = await fetch('http://localhost:5000/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showUploadStatus('✅ ' + data.message, 'success');
            setTimeout(() => loadTests(), 1000);
        } else {
            showUploadStatus('❌ ' + data.error, 'error');
        }
    } catch (error) {
        showUploadStatus('❌ Network error: ' + error.message, 'error');
    }
}

function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'upload-status ' + type;
}

// ============ LOAD TESTS ============
async function loadTests() {
    testsList.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">Loading...</div>';
    
    try {
        const response = await fetch('http://localhost:5000/api/tests');
        const tests = await response.json();
        
        if (tests.length === 0) {
            testsList.innerHTML = `
                <div class="test-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <i class="fas fa-file-alt fa-3x" style="color: #b2bec3;"></i>
                    <p style="margin-top: 15px; color: var(--text-light);">No tests available. Upload your notes to get started!</p>
                </div>
            `;
            return;
        }
        
        testsList.innerHTML = tests.map(test => `
            <div class="test-card">
                <h3>${test.title}</h3>
                <div class="test-meta">
                    <span><i class="fas fa-file-word"></i> ${test.word_count} words</span>
                    <span><i class="fas fa-signal"></i> ${test.difficulty}</span>
                    <span><i class="fas fa-calendar"></i> ${test.created_at}</span>
                </div>
                <p class="test-preview">${test.preview}</p>
                <div class="test-actions">
                    <button class="btn btn-primary" onclick="loadTest(${test.id})">
                        <i class="fas fa-play"></i> Practice
                    </button>
                    <button class="btn btn-danger" onclick="deleteTest(${test.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        testsList.innerHTML = `<div style="color:red;">Failed to load tests: ${error.message}</div>`;
    }
}

// ============ LOAD SPECIFIC TEST ============
async function loadTest(testId) {
    showTab('practice');
    
    try {
        const response = await fetch(`http://localhost:5000/api/test/${testId}`);
        const test = await response.json();
        
        currentTestId = testId;
        currentContent = test.content;
        testTitle.textContent = test.title;
        
        renderText(test.content);
        typingInput.disabled = true;
        typingInput.value = '';
        resetStats();
        
        // Update tab button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.tab-btn:last-child').classList.add('active');
        
        // Load results for this test
        loadResults(testId);
        
    } catch (error) {
        alert('Failed to load test: ' + error.message);
    }
}

// ============ RENDER TEXT ============
function renderText(text) {
    textDisplay.innerHTML = text.split('').map((char, index) => 
        `<span class="char" data-index="${index}">${char === ' ' ? '&nbsp;' : char}</span>`
    ).join('');
    
    const firstChar = textDisplay.querySelector('.char');
    if (firstChar) firstChar.classList.add('current');
}

// ============ TYPING LOGIC ============
function startTest() {
    if (!currentContent) {
        alert('Please upload notes or select a test first!');
        return;
    }
    
    if (isFinished) {
        resetTest();
        setTimeout(() => startTest(), 100);
        return;
    }
    
    testStarted = true;
    typingInput.disabled = false;
    typingInput.focus();
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Typing...';
    
    if (!timer) {
        timer = setInterval(() => {
            seconds++;
            timerDisplay.textContent = seconds + 's';
        }, 1000);
    }
}

function resetTest() {
    testStarted = false;
    isFinished = false;
    resultSaved = false;
    clearInterval(timer);
    timer = null;
    seconds = 0;
    currentCharIndex = 0;
    correctChars = 0;
    wrongChars = 0;
    
    timerDisplay.textContent = '0s';
    wpmDisplay.textContent = '0';
    accuracyDisplay.textContent = '100%';
    typingInput.value = '';
    typingInput.disabled = true;
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Test';
    
    document.querySelectorAll('.char').forEach(char => {
        char.className = 'char';
    });
    
    const firstChar = textDisplay.querySelector('.char');
    if (firstChar) firstChar.classList.add('current');
}

// FIXED: Backspace support
typingInput.addEventListener('input', function(e) {
    if (!testStarted || isFinished) return;
    
    const typed = this.value;
    const chars = document.querySelectorAll('.char');
    
    // Handle backspace
    if (typed.length < currentCharIndex) {
        const newIndex = typed.length;
        
        for (let i = newIndex; i < currentCharIndex; i++) {
            if (chars[i]) {
                chars[i].className = 'char';
            }
        }
        
        currentCharIndex = newIndex;
        
        if (chars[currentCharIndex]) {
            chars[currentCharIndex].classList.add('current');
        }
        
        recalculateStats();
        return;
    }
    
    // Handle typing
    if (typed.length > currentCharIndex) {
        const currentChar = chars[currentCharIndex];
        if (!currentChar) return;
        
        const expected = currentContent[currentCharIndex];
        const actual = typed[typed.length - 1] || '';
        
        if (actual === expected) {
            currentChar.classList.add('correct');
            correctChars++;
        } else {
            currentChar.classList.add('incorrect');
            wrongChars++;
        }
        
        currentCharIndex++;
        
        if (chars[currentCharIndex]) {
            chars[currentCharIndex].classList.add('current');
        }
        
        updateStats();
        
        if (currentCharIndex >= currentContent.length) {
            finishTest();
        }
    }
    
    // Auto-scroll
    const container = textDisplay;
    const currentElement = chars[currentCharIndex - 1];
    if (currentElement) {
        const elementRect = currentElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (elementRect.bottom > containerRect.bottom) {
            container.scrollTop += elementRect.bottom - containerRect.bottom + 20;
        }
    }
});

function recalculateStats() {
    const chars = document.querySelectorAll('.char');
    correctChars = 0;
    wrongChars = 0;
    
    for (let i = 0; i < currentCharIndex && i < chars.length; i++) {
        if (chars[i].classList.contains('correct')) {
            correctChars++;
        } else if (chars[i].classList.contains('incorrect')) {
            wrongChars++;
        }
    }
    
    updateStats();
}

function updateStats() {
    const total = correctChars + wrongChars;
    if (total === 0) return;
    
    const accuracy = (correctChars / total) * 100;
    const timeMinutes = seconds / 60;
    const wpm = timeMinutes > 0 ? Math.round((correctChars / 5) / timeMinutes) : 0;
    
    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = Math.round(accuracy) + '%';
}

function resetStats() {
    correctChars = 0;
    wrongChars = 0;
    currentCharIndex = 0;
    isFinished = false;
    resultSaved = false;
    seconds = 0;
    timerDisplay.textContent = '0s';
    wpmDisplay.textContent = '0';
    accuracyDisplay.textContent = '100%';
    clearInterval(timer);
    timer = null;
}

function finishTest() {
    isFinished = true;
    testStarted = false;
    clearInterval(timer);
    timer = null;
    typingInput.disabled = true;
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Test';
    
    if (!resultSaved) {
        saveResult();
        resultSaved = true;
    }
    
    const total = correctChars + wrongChars;
    const accuracy = total > 0 ? Math.round((correctChars / total) * 100) : 0;
    const wpm = wpmDisplay.textContent;
    
    const existingMsg = textDisplay.querySelector('.completion-message');
    if (existingMsg) existingMsg.remove();
    
    const completionMsg = document.createElement('div');
    completionMsg.className = 'completion-message';
    completionMsg.style.cssText = 'margin-top: 20px; padding: 15px; background: #d4edda; border-radius: 10px; color: #155724;';
    completionMsg.innerHTML = `
        <h3>🎉 Test Complete!</h3>
        <p>WPM: <strong>${wpm}</strong> | Accuracy: <strong>${accuracy}%</strong></p>
        <p>Time: ${seconds}s | Characters: ${total}</p>
    `;
    textDisplay.appendChild(completionMsg);
}

// ============ SAVE RESULTS ============
async function saveResult() {
    if (!currentTestId) return;
    
    const total = correctChars + wrongChars;
    const accuracy = total > 0 ? (correctChars / total) * 100 : 0;
    const timeMinutes = seconds / 60;
    const wpm = timeMinutes > 0 ? (correctChars / 5) / timeMinutes : 0;
    
    const data = {
        wpm: wpm,
        accuracy: accuracy,
        duration: seconds,
        correct_chars: correctChars,
        wrong_chars: wrongChars
    };
    
    try {
        await fetch(`http://localhost:5000/api/test/${currentTestId}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Failed to save result:', error);
    }
}

// ============ LOAD RESULTS ============
async function loadResults(testId) {
    try {
        const response = await fetch(`http://localhost:5000/api/test/${testId}/results`);
        const results = await response.json();
        
        if (results.length > 0) {
            const best = results.reduce((a, b) => a.wpm > b.wpm ? a : b);
            console.log(`Best WPM: ${best.wpm} | Best Accuracy: ${best.accuracy}%`);
        }
    } catch (error) {
        console.error('Failed to load results:', error);
    }
}

// ============ SHOW RESULTS ============
async function showResults() {
    if (!currentTestId) {
        alert('No test selected!');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/test/${currentTestId}/results`);
        const results = await response.json();
        
        if (results.length === 0) {
            alert('No results found for this test. Complete a typing test first!');
            return;
        }
        
        const modal = document.getElementById('resultsModal');
        const content = document.getElementById('resultsContent');
        
        content.innerHTML = `
            <div class="result-item">
                <strong>Total Attempts</strong>
                <span>${results.length}</span>
            </div>
            <div class="result-item">
                <strong>Best WPM</strong>
                <span>${Math.max(...results.map(r => r.wpm))}</span>
            </div>
            <div class="result-item">
                <strong>Best Accuracy</strong>
                <span>${Math.max(...results.map(r => r.accuracy))}%</span>
            </div>
            <div class="result-item">
                <strong>Average WPM</strong>
                <span>${Math.round(results.reduce((a, b) => a + b.wpm, 0) / results.length)}</span>
            </div>
            <div class="result-item">
                <strong>Average Accuracy</strong>
                <span>${Math.round(results.reduce((a, b) => a + b.accuracy, 0) / results.length)}%</span>
            </div>
            <hr style="margin: 20px 0;">
            <h4>Recent Attempts</h4>
            ${results.slice(0, 5).map(r => `
                <div class="result-item">
                    <span>${r.completed_at}</span>
                    <span>${r.wpm} WPM | ${r.accuracy}%</span>
                </div>
            `).join('')}
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        alert('Failed to load results: ' + error.message);
    }
}

function closeResults() {
    document.getElementById('resultsModal').style.display = 'none';
}

// ============ DELETE TEST ============
async function deleteTest(testId) {
    if (!confirm('Delete this test and all its results?')) return;
    
    try {
        await fetch(`http://localhost:5000/api/test/${testId}`, {
            method: 'DELETE'
        });
        loadTests();
    } catch (error) {
        alert('Failed to delete test: ' + error.message);
    }
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!testStarted) startTest();
    }
});

// ============ INIT ============
loadTests();

// Close modal on background click
document.getElementById('resultsModal').addEventListener('click', function(e) {
    if (e.target === this) closeResults();
});