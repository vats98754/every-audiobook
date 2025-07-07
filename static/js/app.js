// Global variables
let socket;
let selectedBook = null;
let selectedVoiceEngine = null;
let availableVoices = null;
let currentConversionId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    loadAvailableVoices();
    setupEventListeners();
});

// Initialize WebSocket connection
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('conversion_progress', function(data) {
        updateProgress(data);
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
    });
}

// Setup event listeners
function setupEventListeners() {
    // Search input enter key
    document.getElementById('book-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBooks();
        }
    });
    
    // Voice engine selection
    document.addEventListener('click', function(e) {
        if (e.target.closest('.voice-engine')) {
            selectVoiceEngine(e.target.closest('.voice-engine'));
        }
    });
}

// Scroll to converter section
function scrollToConverter() {
    document.getElementById('converter').scrollIntoView({
        behavior: 'smooth'
    });
}

// Load available voices from server
async function loadAvailableVoices() {
    try {
        const response = await fetch('/api/available-voices');
        availableVoices = await response.json();
        renderVoiceEngines();
    } catch (error) {
        console.error('Failed to load available voices:', error);
        showError('Failed to load voice options. Please refresh the page.');
    }
}

// Render voice engines
function renderVoiceEngines() {
    const container = document.getElementById('voice-engines');
    
    if (!availableVoices || !availableVoices.engines.length) {
        container.innerHTML = '<p class="text-gray-500">No voice engines available</p>';
        return;
    }
    
    container.innerHTML = availableVoices.engines.map(engine => `
        <div class="voice-engine" data-engine="${engine.id}">
            <div class="voice-engine-name">${engine.name}</div>
            <div class="voice-engine-desc">${engine.description}</div>
        </div>
    `).join('');
}

// Select voice engine
function selectVoiceEngine(element) {
    // Remove previous selection
    document.querySelectorAll('.voice-engine').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection
    element.classList.add('selected');
    selectedVoiceEngine = element.dataset.engine;
    
    // Show voice settings
    renderVoiceSettings(selectedVoiceEngine);
}

// Render voice settings based on selected engine
function renderVoiceSettings(engineId) {
    const container = document.getElementById('voice-settings');
    const engine = availableVoices.engines.find(e => e.id === engineId);
    
    if (!engine) {
        container.innerHTML = '';
        return;
    }
    
    let settingsHTML = '';
    
    // Language selection for GTTS
    if (engineId === 'gtts') {
        settingsHTML += `
            <div class="voice-setting">
                <label for="tts-language">Language</label>
                <select id="tts-language">
                    ${availableVoices.gtts_languages.map(lang => `
                        <option value="${lang.code}">${lang.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="voice-setting">
                <label for="tts-slow">Speed</label>
                <select id="tts-slow">
                    <option value="false">Normal</option>
                    <option value="true">Slow</option>
                </select>
            </div>
        `;
    }
    
    // System voices for pyttsx3
    if (engineId === 'pyttsx3' && engine.voices) {
        settingsHTML += `
            <div class="voice-setting">
                <label for="system-voice">Voice</label>
                <select id="system-voice">
                    ${engine.voices.map(voice => `
                        <option value="${voice.id}">${voice.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="voice-setting">
                <label for="voice-rate">Rate: <span id="rate-value">200</span></label>
                <input type="range" id="voice-rate" min="100" max="300" value="200" 
                       oninput="document.getElementById('rate-value').textContent = this.value">
            </div>
            <div class="voice-setting">
                <label for="voice-volume">Volume: <span id="volume-value">0.9</span></label>
                <input type="range" id="voice-volume" min="0" max="1" step="0.1" value="0.9"
                       oninput="document.getElementById('volume-value').textContent = this.value">
            </div>
        `;
    }
    
    // OpenAI voices
    if (engineId === 'openai' && engine.voices) {
        settingsHTML += `
            <div class="voice-setting">
                <label for="openai-voice">Voice</label>
                <select id="openai-voice">
                    ${engine.voices.map(voice => `
                        <option value="${voice.id}">${voice.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="voice-setting">
                <label for="openai-speed">Speed: <span id="speed-value">1.0</span></label>
                <input type="range" id="openai-speed" min="0.25" max="4.0" step="0.25" value="1.0"
                       oninput="document.getElementById('speed-value').textContent = this.value">
            </div>
        `;
    }
    
    container.innerHTML = settingsHTML;
    container.classList.add('active');
}

// Search for books
async function searchBooks() {
    const title = document.getElementById('book-search').value.trim();
    const language = document.getElementById('language-select').value;
    
    if (!title) {
        showError('Please enter a book title');
        return;
    }
    
    showSearchLoading(true);
    hideSearchResults();
    
    try {
        const response = await fetch('/api/search-libgen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, language })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }
        
        showSearchLoading(false);
        renderSearchResults(data);
        
    } catch (error) {
        showSearchLoading(false);
        showError(`Search failed: ${error.message}`);
    }
}

// Show/hide search loading
function showSearchLoading(show) {
    const loading = document.getElementById('search-loading');
    loading.style.display = show ? 'flex' : 'none';
}

// Hide search results
function hideSearchResults() {
    const results = document.getElementById('search-results');
    results.style.display = 'none';
    results.innerHTML = '';
}

// Render search results
function renderSearchResults(data) {
    const container = document.getElementById('search-results');
    const results = data.results || [];
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="search-message">
                <div class="search-icon">📚</div>
                <div class="search-title">No books found</div>
                <div class="search-subtitle">${data.message || 'Try a different search term or language'}</div>
            </div>
        `;
    } else {
        // Add header with search info
        let headerHtml = '';
        if (data.message) {
            headerHtml = `
                <div class="search-header">
                    <div class="search-info">
                        ${data.message}
                        ${data.searchType === 'exact' ? '✅ Exact matches found' : '🔍 Showing broader search results'}
                    </div>
                </div>
            `;
        }
        
        const resultsHtml = results.map((book, index) => `
            <div class="search-result ${selectedBook && selectedBook.id === book.id ? 'selected' : ''}" 
                 onclick="selectBook(${index})" 
                 data-book-index="${index}">
                <div class="result-header">
                    <div class="result-rank">#${book.rank || index + 1}</div>
                    <div class="result-title">${escapeHtml(book.title)}</div>
                </div>
                <div class="result-author">
                    👤 ${escapeHtml(book.author)}
                </div>
                <div class="result-meta">
                    <span class="meta-item">📅 ${book.year}</span>
                    <span class="meta-item">📄 ${book.pages} pages</span>
                    <span class="meta-item">💾 ${book.size}</span>
                    <span class="meta-item">🌍 ${book.language}</span>
                </div>
                ${book.publisher !== 'Unknown' ? `<div class="result-publisher">🏢 ${escapeHtml(book.publisher)}</div>` : ''}
                ${book.isbn !== 'Unknown' ? `<div class="result-isbn">🔢 ${escapeHtml(book.isbn)}</div>` : ''}
            </div>
        `).join('');
        
        container.innerHTML = headerHtml + resultsHtml;
    }
    
    container.style.display = 'block';
    
    // Store results for selection
    window.searchResults = results;
    
    // Store results for later use
    window.searchResults = results;
}

// Select a book from search results
function selectBook(index) {
    // Remove previous selection
    document.querySelectorAll('.search-result').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection
    const selectedElement = document.querySelector(`[data-book-index="${index}"]`);
    selectedElement.classList.add('selected');
    
    selectedBook = window.searchResults[index];
    
    // Show voice selection step
    showStep('voice-step');
}

// Show a specific step
function showStep(stepId) {
    // Hide all steps first
    document.querySelectorAll('.converter-step').forEach(step => {
        step.style.display = 'none';
        step.classList.remove('active');
    });
    
    // Show the requested step
    const step = document.getElementById(stepId);
    step.style.display = 'block';
    step.classList.add('active');
    
    // Also show previous steps
    if (stepId === 'voice-step' || stepId === 'convert-step') {
        document.getElementById('search-step').style.display = 'block';
    }
    if (stepId === 'convert-step') {
        document.getElementById('voice-step').style.display = 'block';
        renderBookPreview();
    }
}

// Render book preview
function renderBookPreview() {
    const container = document.getElementById('book-preview');
    
    if (!selectedBook) {
        container.innerHTML = '<p>No book selected</p>';
        return;
    }
    
    const engineName = availableVoices.engines.find(e => e.id === selectedVoiceEngine)?.name || 'Unknown';
    
    container.innerHTML = `
        <div class="book-preview-card">
            <h3>${escapeHtml(selectedBook.title)}</h3>
            <p><strong>Author:</strong> ${escapeHtml(selectedBook.author)}</p>
            <p><strong>Language:</strong> ${selectedBook.language}</p>
            <p><strong>Pages:</strong> ${selectedBook.pages}</p>
            <p><strong>Voice Engine:</strong> ${engineName}</p>
        </div>
    `;
}

// Preview voice
function previewVoice() {
    if (!selectedVoiceEngine) {
        showError('Please select a voice engine first');
        return;
    }
    
    // This would implement voice preview functionality
    showError('Voice preview feature coming soon!');
}

// Start conversion
async function startConversion() {
    if (!selectedBook) {
        showError('Please select a book first');
        return;
    }
    
    if (!selectedVoiceEngine) {
        showError('Please select a voice engine');
        return;
    }
    
    // Collect voice settings
    const voiceSettings = getVoiceSettings();
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: selectedBook.title,
                language: selectedBook.language,
                voice_engine: selectedVoiceEngine,
                voice_settings: voiceSettings
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Conversion failed to start');
        }
        
        currentConversionId = data.conversion_id;
        
        // Join the conversion room for real-time updates
        socket.emit('join_conversion', { conversion_id: currentConversionId });
        
        // Show progress section
        showProgressSection();
        
    } catch (error) {
        showError(`Failed to start conversion: ${error.message}`);
    }
}

// Get voice settings from form
function getVoiceSettings() {
    const settings = {};
    
    if (selectedVoiceEngine === 'gtts') {
        const language = document.getElementById('tts-language')?.value;
        const slow = document.getElementById('tts-slow')?.value === 'true';
        if (language) settings.language = language;
        settings.slow = slow;
    }
    
    if (selectedVoiceEngine === 'pyttsx3') {
        const voiceId = document.getElementById('system-voice')?.value;
        const rate = document.getElementById('voice-rate')?.value;
        const volume = document.getElementById('voice-volume')?.value;
        if (voiceId) settings.voice_id = voiceId;
        if (rate) settings.rate = parseInt(rate);
        if (volume) settings.volume = parseFloat(volume);
    }
    
    if (selectedVoiceEngine === 'openai') {
        const voiceId = document.getElementById('openai-voice')?.value;
        const speed = document.getElementById('openai-speed')?.value;
        if (voiceId) settings.voice_id = voiceId;
        if (speed) settings.speed = parseFloat(speed);
    }
    
    return settings;
}

// Show progress section
function showProgressSection() {
    // Hide converter section
    document.getElementById('converter').style.display = 'none';
    
    // Show progress section
    const progressSection = document.getElementById('progress-section');
    progressSection.style.display = 'block';
    progressSection.scrollIntoView({ behavior: 'smooth' });
    
    // Reset progress
    updateProgressCircle(0);
    document.getElementById('progress-percentage').textContent = '0%';
    document.getElementById('progress-status').textContent = 'Initializing...';
    document.getElementById('current-page').textContent = '0';
    document.getElementById('total-pages').textContent = '0';
    document.getElementById('progress-log').innerHTML = '';
}

// Update progress
function updateProgress(data) {
    const { status, progress, total_pages, current_page, message } = data;
    
    // Update progress circle
    if (progress !== null && progress !== undefined) {
        updateProgressCircle(progress);
        document.getElementById('progress-percentage').textContent = `${Math.round(progress)}%`;
    }
    
    // Update status
    document.getElementById('progress-status').textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Update page numbers
    if (total_pages) {
        document.getElementById('total-pages').textContent = total_pages;
    }
    if (current_page) {
        document.getElementById('current-page').textContent = current_page;
    }
    
    // Add log entry
    if (message) {
        addLogEntry(message);
    }
    
    // Handle completion
    if (status === 'completed') {
        setTimeout(() => {
            showResultsSection();
        }, 1000);
    }
    
    // Handle failure
    if (status === 'failed') {
        showError(`Conversion failed: ${message}`);
    }
}

// Update progress circle
function updateProgressCircle(progress) {
    const circle = document.querySelector('.progress-ring-progress');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    const offset = circumference - (progress / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

// Add log entry
function addLogEntry(message) {
    const log = document.getElementById('progress-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `
        <div class="log-timestamp">${timestamp}</div>
        <div>${escapeHtml(message)}</div>
    `;
    
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// Show results section
async function showResultsSection() {
    try {
        // Get conversion details
        const response = await fetch(`/api/conversion/${currentConversionId}`);
        const conversion = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to get conversion details');
        }
        
        // Hide progress section
        document.getElementById('progress-section').style.display = 'none';
        
        // Show results section
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        // Render audiobook player
        renderAudiobookPlayer(conversion);
        
    } catch (error) {
        showError(`Failed to load results: ${error.message}`);
    }
}

// Render audiobook player
function renderAudiobookPlayer(conversion) {
    const container = document.getElementById('audiobook-player');
    
    if (!conversion.audio_files || conversion.audio_files.length === 0) {
        container.innerHTML = '<p>No audio files generated</p>';
        return;
    }
    
    container.innerHTML = `
        <h3>📚 ${escapeHtml(conversion.book_title || 'Your Audiobook')}</h3>
        <p>✅ ${conversion.audio_files.length} chapters ready for listening</p>
        <div class="chapter-list">
            ${conversion.audio_files.map((audio, index) => `
                <div class="chapter-item">
                    <div class="chapter-number">${audio.page}</div>
                    <div class="chapter-info">
                        <div class="chapter-title">Page ${audio.page}</div>
                        <div class="chapter-duration">Audio file ready</div>
                    </div>
                    <div class="chapter-actions">
                        <button class="chapter-btn" onclick="playChapter(${audio.page})" title="Play">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        <button class="chapter-btn" onclick="downloadChapter(${audio.page})" title="Download">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Play chapter
function playChapter(page) {
    // This would implement audio playback
    showError('Audio playback feature coming soon!');
}

// Download chapter
function downloadChapter(page) {
    if (!currentConversionId) {
        showError('No conversion ID available');
        return;
    }
    
    window.open(`/api/download/${currentConversionId}/${page}`, '_blank');
}

// Download all chapters
function downloadAll() {
    showError('Download all feature coming soon!');
}

// Start new conversion
function startNew() {
    // Reset everything
    selectedBook = null;
    selectedVoiceEngine = null;
    currentConversionId = null;
    
    // Hide results section
    document.getElementById('results-section').style.display = 'none';
    
    // Show converter section
    document.getElementById('converter').style.display = 'block';
    
    // Reset steps
    showStep('search-step');
    
    // Clear form
    document.getElementById('book-search').value = '';
    hideSearchResults();
    
    // Scroll to converter
    scrollToConverter();
}

// Show error message
function showError(message) {
    // Simple alert for now - could be enhanced with toast notifications
    alert(message);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}
