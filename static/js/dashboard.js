// Dashboard JavaScript
let socket;
let selectedBook = null;
let currentAudiobook = null;
let currentPage = 1;
let totalPages = 1;

// Check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/api/audiobooks');
        if (response.status === 302 || response.redirected) {
            window.location.href = '/login';
            return false;
        }
        return true;
    } catch (error) {
        if (error.message.includes('Unexpected token')) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
            initializeSocket();
            loadAudiobooks();
            loadStats();
        }
    });
});

function initializeSocket() {
    socket = io();
    
    socket.on('conversion_progress', function(data) {
        updateConversionProgress(data);
    });
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName + '-section').classList.add('active');
    
    // Update sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Find the correct sidebar link and make it active
    const targetLink = document.querySelector(`[href="#${sectionName}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
    }
    
    // Reload data if needed
    if (sectionName === 'library') {
        loadAudiobooks();
        loadStats();
    }
}

// Filter audiobooks by status
function filterAudiobooks(status) {
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter audiobook cards
    const cards = document.querySelectorAll('.audiobook-card');
    cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

async function searchBooks() {
    const query = document.getElementById('book-search').value;
    const language = document.getElementById('language-select').value;
    
    if (!query.trim()) {
        alert('Please enter a search term');
        return;
    }
    
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, language })
        });
        
        // Check if we got redirected to login page
        if (response.status === 302 || response.redirected) {
            alert('Please log in to search for books');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            displaySearchResults(result.books);
        } else {
            alert('Search failed: ' + result.message);
        }
    } catch (error) {
        // Handle JSON parsing errors (likely HTML response)
        if (error.message.includes('Unexpected token')) {
            alert('Session expired. Please log in again.');
            window.location.href = '/login';
        } else {
            alert('Search error: ' + error.message);
        }
    }
}

function displaySearchResults(books) {
    const resultsDiv = document.getElementById('search-results');
    const booksListDiv = document.getElementById('books-list');
    
    if (books.length === 0) {
        booksListDiv.innerHTML = '<p class="no-results">No books found. Try a different search term.</p>';
    } else {
        booksListDiv.innerHTML = books.map(book => `
            <div class="book-item" onclick="selectBook('${JSON.stringify(book).replace(/'/g, "\\'")}')">
                <h4 class="book-title">${book.title}</h4>
                <p class="book-author">by ${book.author}</p>
                <p class="book-year">${book.year}</p>
                <div class="book-subjects">
                    ${book.subjects.slice(0, 3).map(subject => `<span class="subject-tag">${subject}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }
    
    resultsDiv.style.display = 'block';
}

function selectBook(bookData) {
    selectedBook = JSON.parse(bookData);
    
    // Highlight selected book
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show voice selection step
    document.getElementById('voice-step').style.display = 'block';
    
    // Scroll to voice step
    document.getElementById('voice-step').scrollIntoView({ behavior: 'smooth' });
}

async function startConversion() {
    if (!selectedBook) {
        alert('Please select a book first');
        return;
    }
    
    const voiceEngine = 'gtts'; // Default to Google TTS
    const voiceSettings = {
        language: document.getElementById('gtts-language').value,
        slow: document.getElementById('gtts-slow').checked
    };
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                book: selectedBook,
                voice_engine: voiceEngine,
                voice_settings: voiceSettings
            })
        });
        
        // Check if we got redirected to login page
        if (response.status === 302 || response.redirected) {
            alert('Please log in to start conversion');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Join the conversion room for real-time updates
            socket.emit('join_conversion', { conversion_id: result.conversion_id });
            
            // Show progress
            document.getElementById('conversion-progress').style.display = 'block';
            document.getElementById('conversion-progress').scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Conversion failed: ' + result.message);
        }
    } catch (error) {
        // Handle JSON parsing errors (likely HTML response)
        if (error.message.includes('Unexpected token')) {
            alert('Session expired. Please log in again.');
            window.location.href = '/login';
        } else {
            alert('Conversion error: ' + error.message);
        }
    }
}

function updateConversionProgress(data) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressDetails = document.getElementById('progress-details');
    
    progressFill.style.width = data.progress + '%';
    progressText.textContent = data.message;
    
    if (data.current_page && data.total_pages) {
        progressDetails.textContent = `Page ${data.current_page} of ${data.total_pages}`;
    }
    
    if (data.status === 'completed') {
        progressText.textContent = 'Conversion completed! Refreshing library...';
        setTimeout(() => {
            loadAudiobooks();
            showSection('library');
        }, 2000);
    } else if (data.status === 'error') {
        progressText.textContent = 'Error: ' + data.message;
        progressFill.style.backgroundColor = '#ef4444';
    }
}

// Load user's audiobooks
async function loadAudiobooks() {
    try {
        const response = await fetch('/api/audiobooks');
        
        if (response.status === 302 || response.redirected) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (data.audiobooks) {
            renderAudiobooks(data.audiobooks);
        }
        
    } catch (error) {
        console.error('Error loading audiobooks:', error);
        if (error.message.includes('Unexpected token')) {
            window.location.href = '/login';
        }
    }
}

// Load dashboard stats
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.user_stats) {
            updateStatsDisplay(data.user_stats);
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Update stats display
function updateStatsDisplay(stats) {
    document.getElementById('total-audiobooks').textContent = stats.total_audiobooks || 0;
    document.getElementById('completed-audiobooks').textContent = stats.completed || 0;
    document.getElementById('processing-audiobooks').textContent = stats.processing || 0;
}

// Render audiobooks in the grid
function renderAudiobooks(audiobooks) {
    const grid = document.getElementById('audiobooks-grid');
    
    if (audiobooks.length === 0) {
        grid.innerHTML = `
            <div class="no-audiobooks">
                <h3>No audiobooks yet</h3>
                <p>Create your first audiobook to get started!</p>
                <button class="btn btn-primary" onclick="showSection('create')">Create New Audiobook</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = audiobooks.map(audiobook => `
        <div class="audiobook-card" data-status="${audiobook.status}">
            <div class="audiobook-header">
                <h3 class="audiobook-title">${escapeHtml(audiobook.title)}</h3>
                <span class="status-badge status-${audiobook.status}">${audiobook.status.charAt(0).toUpperCase() + audiobook.status.slice(1)}</span>
            </div>
            <p class="audiobook-author">by ${escapeHtml(audiobook.author)}</p>
            <div class="audiobook-meta">
                <span class="meta-item">
                    <svg class="meta-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    ${audiobook.created_at ? new Date(audiobook.created_at).toLocaleDateString() : 'Unknown date'}
                </span>
                ${audiobook.total_pages ? `
                    <span class="meta-item">
                        <svg class="meta-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
                        </svg>
                        ${audiobook.total_pages} pages
                    </span>
                ` : ''}
            </div>
            <div class="audiobook-actions">
                ${audiobook.status === 'completed' ? `
                    <button class="btn btn-primary" onclick="playAudiobook('${audiobook.id}')" title="Play audiobook">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                        </svg>
                        Play
                    </button>
                ` : audiobook.status === 'processing' ? `
                    <button class="btn btn-secondary" disabled>
                        <svg class="animate-spin" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H8a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H12a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                        </svg>
                        Processing...
                    </button>
                ` : audiobook.status === 'failed' ? `
                    <button class="btn btn-secondary" onclick="retryConversion('${audiobook.id}')" title="Retry conversion">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H8a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H12a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                        </svg>
                        Retry
                    </button>
                ` : `
                    <button class="btn btn-primary" onclick="startConversionForExisting('${audiobook.id}')" title="Start conversion">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                        </svg>
                        Convert
                    </button>
                `}
                <button class="btn btn-secondary" onclick="deleteAudiobook('${audiobook.id}')" title="Delete audiobook">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L7.586 12l-1.293 1.293a1 1 0 101.414 1.414L9 13.414l1.293 1.293a1 1 0 001.414-1.414L10.414 12l1.293-1.293z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
            ${audiobook.status === 'processing' ? `
                <div class="audiobook-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">Processing...</div>
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // Append audio player for each audiobook
    audiobooks.forEach(audiobook => {
        const card = grid.querySelector(`.audiobook-card[data-status="${audiobook.status}"]`);
        if (card) {
            card.appendChild(renderAudioPlayer(audiobook));
        }
    });
}

// --- AUDIO PLAYER UI ---
// Add this function to render a minimalistic player for each audiobook
function renderAudioPlayer(audiobook) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'audio-player';
    let currentPage = 1;
    const totalPages = audiobook.total_pages || 1;
    playerDiv.innerHTML = `
        <button class="prev-btn">&#9664;</button>
        <audio controls id="audio-${audiobook.id}" src="/stream/${audiobook.id}/1"></audio>
        <button class="next-btn">&#9654;</button>
        <span class="page-indicator">Page <span class="current-page">1</span> / ${totalPages}</span>
    `;
    const audio = playerDiv.querySelector('audio');
    const prevBtn = playerDiv.querySelector('.prev-btn');
    const nextBtn = playerDiv.querySelector('.next-btn');
    const pageIndicator = playerDiv.querySelector('.current-page');
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            audio.src = `/stream/${audiobook.id}/${currentPage}`;
            audio.play();
            pageIndicator.textContent = currentPage;
        }
    };
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            audio.src = `/stream/${audiobook.id}/${currentPage}`;
            audio.play();
            pageIndicator.textContent = currentPage;
        }
    };
    return playerDiv;
}

// --- NOW PLAYING TAB ---
// Add a Now Playing tab to the dashboard
function showNowPlaying(audiobook, page, audioUrl) {
    const nowPlayingTab = document.getElementById('now-playing-tab');
    if (!nowPlayingTab) return;
    nowPlayingTab.innerHTML = `
        <div class="now-playing-header">
            <h3>Now Playing</h3>
            <span class="now-playing-title">${escapeHtml(audiobook.title)}</span>
            <span class="now-playing-author">by ${escapeHtml(audiobook.author)}</span>
        </div>
        <div class="now-playing-controls">
            <button id="now-playing-prev" class="btn btn-secondary">&#9664;</button>
            <audio id="now-playing-audio" controls src="${audioUrl}"></audio>
            <button id="now-playing-next" class="btn btn-secondary">&#9654;</button>
        </div>
        <div class="now-playing-page">Page <span id="now-playing-current-page">${page}</span> / ${audiobook.total_pages || 1}</div>
    `;
    // Setup prev/next
    const audioElement = document.getElementById('now-playing-audio');
    document.getElementById('now-playing-prev').onclick = () => {
        if (page > 1) {
            showNowPlaying(audiobook, page - 1, `/api/audiobook/${audiobook.id}/stream/${page - 1}`);
            setTimeout(() => document.getElementById('now-playing-audio').play(), 100);
        }
    };
    document.getElementById('now-playing-next').onclick = () => {
        if (page < (audiobook.total_pages || 1)) {
            showNowPlaying(audiobook, page + 1, `/api/audiobook/${audiobook.id}/stream/${page + 1}`);
            setTimeout(() => document.getElementById('now-playing-audio').play(), 100);
        }
    };
    // Auto-advance
    audioElement.onended = () => {
        if (page < (audiobook.total_pages || 1)) {
            showNowPlaying(audiobook, page + 1, `/api/audiobook/${audiobook.id}/stream/${page + 1}`);
            setTimeout(() => document.getElementById('now-playing-audio').play(), 100);
        }
    };
}

// Patch playAudiobook to update Now Playing tab
async function playAudiobook(audiobookId) {
    try {
        showNotification('Loading audiobook...', 'info');
        const audiobookInfo = await loadAudiobookInfo(audiobookId);
        if (!audiobookInfo) {
            showNotification('Failed to load audiobook information', 'error');
            return;
        }
        window.audioPlayerState.currentAudiobook = audiobookInfo.audiobook;
        window.audioPlayerState.totalPages = audiobookInfo.pages.length;
        window.audioPlayerState.pages = audiobookInfo.pages;
        window.audioPlayerState.currentPage = 1;
        // Show Now Playing tab
        showNowPlaying(audiobookInfo.audiobook, 1, audiobookInfo.pages[0].stream_url);
        // ...existing code for modal player...
        const modal = document.getElementById('audio-player-modal');
        const audioElement = document.getElementById('audio-element');
        window.audioPlayerState.audioElement = audioElement;
        document.getElementById('player-title').textContent = audiobookInfo.audiobook.title;
        await loadAudioPage(1);
        modal.style.display = 'flex';
        setupAudioPlayerKeyboardShortcuts();
        preloadNextPage();
        showNotification('Audiobook loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading audiobook info:', error);
        showNotification('Failed to load audiobook', 'error');
    }
}

async function startConversionForExisting(audiobookId) {
    try {
        const response = await fetch('/api/book/convert-from-collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                audiobook_id: audiobookId,
                voice_engine: 'gtts',
                voice_settings: { language: 'en' }
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Conversion started!', 'success');
            loadAudiobooks(); // Refresh the list
        } else {
            showNotification(data.message || 'Failed to start conversion', 'error');
        }
        
    } catch (error) {
        console.error('Start conversion error:', error);
        showNotification('Failed to start conversion', 'error');
    }
}

// Retry conversion
async function retryConversion(audiobookId) {
    await startConversionForExisting(audiobookId);
}

// Delete audiobook
async function deleteAudiobook(audiobookId) {
    if (!confirm('Are you sure you want to delete this audiobook?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/audiobook/${audiobookId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Audiobook deleted successfully', 'success');
            loadAudiobooks(); // Refresh the list
            loadStats(); // Update stats
        } else {
            showNotification('Failed to delete audiobook', 'error');
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete audiobook', 'error');
    }
}

// Search books in dashboard
async function searchBooksInDashboard() {
    const query = document.getElementById('dashboard-book-search').value.trim();
    const language = document.getElementById('dashboard-language-select').value;
    
    if (!query) {
        showNotification('Please enter a search term', 'error');
        return;
    }
    
    const loadingDiv = document.getElementById('search-loading-dashboard');
    const resultsDiv = document.getElementById('search-results-dashboard');
    
    loadingDiv.style.display = 'flex';
    resultsDiv.style.display = 'none';
    
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, language })
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderDashboardSearchResults(data.books);
        } else {
            showNotification('Search failed: ' + data.message, 'error');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Search failed', 'error');
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Render search results in dashboard
function renderDashboardSearchResults(books) {
    const resultsDiv = document.getElementById('search-results-dashboard');
    
    if (books.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No books found. Try a different search term.</p>';
    } else {
        resultsDiv.innerHTML = `
            <h4>Search Results (${books.length} books found):</h4>
            <div class="dashboard-search-grid">
                ${books.map((book, index) => `
                    <div class="dashboard-book-card">
                        <div class="dashboard-book-info">
                            <h5 class="dashboard-book-title">${escapeHtml(book.title)}</h5>
                            <p class="dashboard-book-author">by ${escapeHtml(book.author)}</p>
                            ${book.year ? `<p class="dashboard-book-year">${book.year}</p>` : ''}
                            ${book.subjects && book.subjects.length > 0 ? `
                                <div class="dashboard-book-subjects">
                                    ${book.subjects.slice(0, 2).map(subject => `
                                        <span class="subject-tag-small">${escapeHtml(subject)}</span>
                                    `).join('')}
                                    ${book.subjects.length > 2 ? `<span class="subject-more-small">+${book.subjects.length - 2} more</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <div class="dashboard-book-actions">
                            <button class="btn btn-primary btn-small" onclick="previewBookFromDashboard(${index})" title="Preview book">
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                                </svg>
                                Preview
                            </button>
                            <button class="btn btn-success btn-small" onclick="addToCollectionFromDashboard(${index})" title="Add to library">
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                                </svg>
                                Add to Library
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Store search results for use in preview/add functions
        window.dashboardSearchResults = books;
    }
    
    resultsDiv.style.display = 'block';
}

// Preview book from dashboard search
async function previewBookFromDashboard(index) {
    const book = window.dashboardSearchResults[index];
    if (!book) {
        showNotification('Book not found', 'error');
        return;
    }
    
    try {
        // Show loading state
        const modal = createPreviewModal(book, true);
        document.body.appendChild(modal);
        
        // Fetch detailed book information
        const response = await fetch('/api/book/preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key: book.key })
        });
        
        const data = await response.json();
        
        if (data.success && data.book) {
            updatePreviewModal(modal, book, data.book);
        } else {
            updatePreviewModal(modal, book, null);
        }
        
    } catch (error) {
        console.error('Preview error:', error);
        showNotification('Failed to load book preview', 'error');
    }
}

// Add to collection from dashboard search  
async function addToCollectionFromDashboard(index) {
    const book = window.dashboardSearchResults[index];
    if (!book) {
        showNotification('Book not found', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/book/add-to-collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book: book })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Book added to your library!', 'success');
            loadAudiobooks();
            loadStats();
        } else {
            showNotification(data.message || 'Failed to add book to collection', 'error');
        }
        
    } catch (error) {
        console.error('Add to collection error:', error);
        showNotification('Failed to add book to collection', 'error');
    }
}

// Preview Modal Functions (copied from app.js for dashboard use)

// Create preview modal
function createPreviewModal(book, loading = false) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>Book Preview</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                ${loading ? `
                    <div class="preview-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading book details...</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add modal styles
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    return modal;
}

// Update preview modal with book details
function updatePreviewModal(modal, basicBook, detailedBook) {
    const modalBody = modal.querySelector('.modal-body');
    const book = detailedBook || basicBook;
    
    modalBody.innerHTML = `
        <div class="preview-content">
            <div class="preview-header">
                <div class="preview-cover">
                    ${book.cover_url || basicBook.cover_url ? `
                        <img src="${book.cover_url || basicBook.cover_url}" alt="${escapeHtml(book.title || basicBook.title)}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="preview-cover-placeholder" style="display: none;">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </div>
                    ` : `
                        <div class="preview-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                        </div>
                    `}
                </div>
                <div class="preview-info">
                    <h2 class="preview-title">${escapeHtml(book.title || basicBook.title)}</h2>
                    <p class="preview-author">by ${escapeHtml(book.author || basicBook.author)}</p>
                    
                    ${basicBook.rating ? `
                        <div class="preview-rating">
                            <div class="rating-stars-large">
                                ${generateStars(basicBook.rating)}
                            </div>
                            <span class="rating-details">${basicBook.rating}/5 (${basicBook.rating_count || 0} ratings)</span>
                        </div>
                    ` : ''}
                    
                    <div class="preview-meta-grid">
                        ${basicBook.year ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📅 Published</span>
                                <span class="meta-value">${basicBook.year}</span>
                            </div>
                        ` : ''}
                        ${basicBook.pages ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📄 Pages</span>
                                <span class="meta-value">${basicBook.pages}</span>
                            </div>
                        ` : ''}
                        ${basicBook.estimated_hours ? `
                            <div class="meta-item-large">
                                <span class="meta-label">⏱️ Est. Audio Length</span>
                                <span class="meta-value">${basicBook.estimated_hours} hours</span>
                            </div>
                        ` : ''}
                        ${basicBook.publisher ? `
                            <div class="meta-item-large">
                                <span class="meta-label">🏢 Publisher</span>
                                <span class="meta-value">${escapeHtml(basicBook.publisher)}</span>
                            </div>
                        ` : ''}
                        ${basicBook.languages && basicBook.languages.length > 0 ? `
                            <div class="meta-item-large">
                                <span class="meta-label">🌐 Languages</span>
                                <span class="meta-value">${basicBook.languages.join(', ')}</span>
                            </div>
                        ` : ''}
                        ${basicBook.isbn && basicBook.isbn.length > 0 ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📖 ISBN</span>
                                <span class="meta-value">${basicBook.isbn[0]}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${book.description ? `
                <div class="preview-section">
                    <h3 class="section-title">📖 Description</h3>
                    <div class="book-description">
                        <p>${escapeHtml(book.description.substring(0, 500))}${book.description.length > 500 ? '...' : ''}</p>
                    </div>
                </div>
            ` : basicBook.first_sentence ? `
                <div class="preview-section">
                    <h3 class="section-title">📖 Preview</h3>
                    <div class="book-description">
                        <p><em>"${escapeHtml(basicBook.first_sentence)}"</em></p>
                    </div>
                </div>
            ` : ''}
            
            ${(book.subjects || basicBook.subjects) && (book.subjects || basicBook.subjects).length > 0 ? `
                <div class="preview-section">
                    <h3 class="section-title">🏷️ Topics & Subjects</h3>
                    <div class="subjects-grid">
                        ${(book.subjects || basicBook.subjects).slice(0, 8).map(subject => 
                            `<span class="subject-tag">${escapeHtml(subject)}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="preview-actions">
                <button class="btn btn-primary" onclick="quickConvertFromPreview(this)" data-book='${JSON.stringify(basicBook)}'>
                    <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                    Quick Convert
                </button>
                <button class="btn btn-secondary" onclick="addToCollectionFromPreview(this)" data-book='${JSON.stringify(basicBook)}'>
                    <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                    </svg>
                    Add to Collection
                </button>
            </div>
        </div>
    `;
}

// Helper functions for preview modal
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateStars(rating) {
    if (!rating) return '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<span class="star star-full">★</span>';
    }
    
    // Half star
    if (hasHalfStar) {
        starsHtml += '<span class="star star-half">★</span>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<span class="star star-empty">☆</span>';
    }
    
    return starsHtml;
}

// Quick convert from preview (dashboard version)
async function quickConvertFromPreview(button) {
    const bookData = JSON.parse(button.dataset.book);
    
    try {
        // Close the preview modal
        const modal = button.closest('.preview-modal');
        if (modal) modal.remove();
        
        showNotification('Starting conversion...', 'success');
        
        // Start conversion with default settings
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: bookData.title,
                book: bookData,
                tts_engine: 'google',
                voice_id: 'en-US-Standard-A',
                language: 'English'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Conversion started! Check your library for progress.', 'success');
            // Refresh the library if we're on the library tab
            if (document.querySelector('#library-section.active')) {
                loadAudiobooks();
            }
        } else {
            showNotification(data.message || 'Failed to start conversion', 'error');
        }
        
    } catch (error) {
        console.error('Quick convert from preview error:', error);
        showNotification('Failed to start conversion', 'error');
    }
}

// Add to collection from preview (dashboard version)
async function addToCollectionFromPreview(button) {
    const bookData = JSON.parse(button.dataset.book);
    
    try {
        const response = await fetch('/api/book/add-to-collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book: bookData })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Book added to your collection!', 'success');
            // Update the button to show it's been added
            button.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                Added to Collection
            `;
            button.disabled = true;
            button.classList.remove('btn-secondary');
            button.classList.add('btn-success');
        } else {
            showNotification(data.message || 'Failed to add book to collection', 'error');
        }
        
    } catch (error) {
        console.error('Add to collection error:', error);
        showNotification('Failed to add book to collection', 'error');
    }
}

// Audio Player State Management
window.audioPlayerState = {
    currentAudiobook: null,
    currentPage: 1,
    totalPages: 0,
    audioElement: null,
    isPlaying: false,
    pages: [],
    preloadedPages: new Map(), // Cache for preloaded audio
    currentlyLoading: new Set() // Track which pages are currently being loaded
};

// Audio Player Functions
async function playAudiobook(audiobookId) {
    try {
        showNotification('Loading audiobook...', 'info');
        
        // Load audiobook info and pages
        const audiobookInfo = await loadAudiobookInfo(audiobookId);
        if (!audiobookInfo) {
            showNotification('Failed to load audiobook information', 'error');
            return;
        }
        
        // Initialize player state
        window.audioPlayerState.currentAudiobook = audiobookInfo.audiobook;
        window.audioPlayerState.totalPages = audiobookInfo.pages.length;
        window.audioPlayerState.pages = audiobookInfo.pages;
        window.audioPlayerState.currentPage = 1;
        
        // Show Now Playing tab
        showNowPlaying(audiobookInfo.audiobook, 1, audiobookInfo.pages[0].stream_url);
        
        // Show the audio player modal
        const modal = document.getElementById('audio-player-modal');
        const audioElement = document.getElementById('audio-element');
        window.audioPlayerState.audioElement = audioElement;
        
        // Update modal title
        document.getElementById('player-title').textContent = audiobookInfo.audiobook.title;
        
        // Load the first page
        await loadAudioPage(1);
        
        // Show modal
        modal.style.display = 'flex';
        
        // Setup keyboard shortcuts
        setupAudioPlayerKeyboardShortcuts();
        
        // Preload next page for smooth playback
        preloadNextPage();
        
        showNotification('Audiobook loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error loading audiobook info:', error);
        showNotification('Failed to load audiobook', 'error');
    }
}

async function loadAudiobookInfo(audiobookId) {
    try {
        const response = await fetch(`/api/audiobook/${audiobookId}/pages`);
        const data = await response.json();
        
        if (data.success) {
            return data;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error loading audiobook info:', error);
        return null;
    }
}

async function loadAudioPage(pageNumber) {
    try {
        const state = window.audioPlayerState;
        const page = state.pages.find(p => p.page === pageNumber);
        
        if (!page || !page.available) {
            showNotification(`Page ${pageNumber} is not available`, 'warning');
            return false;
        }
        
        // Check if page is already preloaded
        if (state.preloadedPages.has(pageNumber)) {
            const audioUrl = state.preloadedPages.get(pageNumber);
            state.audioElement.src = audioUrl;
            updatePageInfo();
            return true;
        }
        
        // Mark as currently loading
        state.currentlyLoading.add(pageNumber);
        
        // Load the audio file
        const audioUrl = page.stream_url;
        state.audioElement.src = audioUrl;
        
        // Cache the URL for future use
        state.preloadedPages.set(pageNumber, audioUrl);
        
        // Update page info
        updatePageInfo();
        
        // Remove from loading set
        state.currentlyLoading.delete(pageNumber);
        
        return true;
        
    } catch (error) {
        console.error('Error loading audio page:', error);
        const state = window.audioPlayerState;
        state.currentlyLoading.delete(pageNumber);
        return false;
    }
}

function updatePageInfo() {
    const state = window.audioPlayerState;
    const pageInfo = document.getElementById('current-page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.disabled = state.currentPage <= 1;
        prevBtn.style.opacity = state.currentPage <= 1 ? '0.5' : '1';
    }
    
    if (nextBtn) {
        nextBtn.disabled = state.currentPage >= state.totalPages;
        nextBtn.style.opacity = state.currentPage >= state.totalPages ? '0.5' : '1';
    }
}

async function previousPage() {
    const state = window.audioPlayerState;
    if (state.currentPage > 1) {
        state.currentPage--;
        await loadAudioPage(state.currentPage);
        // Preload previous page for smoother backwards navigation
        preloadPage(state.currentPage - 1);
    }
}

async function nextPage() {
    const state = window.audioPlayerState;
    if (state.currentPage < state.totalPages) {
        state.currentPage++;
        await loadAudioPage(state.currentPage);
        // Preload next page for smoother forwards navigation
        preloadNextPage();
    }
}

// Smart preloading system
async function preloadNextPage() {
    const state = window.audioPlayerState;
    const nextPageNumber = state.currentPage + 1;
    if (nextPageNumber <= state.totalPages) {
        preloadPage(nextPageNumber);
    }
}

async function preloadPage(pageNumber) {
    const state = window.audioPlayerState;
    
    // Don't preload if already cached or currently loading
    if (state.preloadedPages.has(pageNumber) || state.currentlyLoading.has(pageNumber)) {
        return;
    }
    
    const page = state.pages.find(p => p.page === pageNumber);
    if (!page || !page.available) {
        return;
    }
    
    try {
        // Mark as loading
        state.currentlyLoading.add(pageNumber);
        
        // Create a temporary audio element for preloading
        const tempAudio = new Audio();
        tempAudio.preload = 'auto';
        tempAudio.src = page.stream_url;
        
        // Cache the URL
        state.preloadedPages.set(pageNumber, page.stream_url);
        
        // Clean up loading state
        state.currentlyLoading.delete(pageNumber);
        
    } catch (error) {
        console.error(`Error preloading page ${pageNumber}:`, error);
        state.currentlyLoading.delete(pageNumber);
    }
}

function closeAudioPlayer() {
    const modal = document.getElementById('audio-player-modal');
    const audioElement = window.audioPlayerState.audioElement;
    
    // Pause and reset audio
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
    }
    
    // Hide modal
    modal.style.display = 'none';
    
    // Clear keyboard shortcuts
    clearAudioPlayerKeyboardShortcuts();
    
    // Clear state and cache (but keep some cached pages for performance)
    const state = window.audioPlayerState;
    state.currentAudiobook = null;
    state.currentPage = 1;
    state.totalPages = 0;
    state.audioElement = null;
    state.isPlaying = false;
    state.pages = [];
    state.currentlyLoading.clear();
    
    // Keep only last 3 cached pages to save memory
    if (state.preloadedPages.size > 3) {
        const entries = Array.from(state.preloadedPages.entries());
        const keepEntries = entries.slice(-3);
        state.preloadedPages.clear();
        keepEntries.forEach(([key, value]) => state.preloadedPages.set(key, value));
    }
}

// Keyboard shortcuts for audio player
function setupAudioPlayerKeyboardShortcuts() {
    document.addEventListener('keydown', handleAudioPlayerKeyboard);
}

function clearAudioPlayerKeyboardShortcuts() {
    document.removeEventListener('keydown', handleAudioPlayerKeyboard);
}

function handleAudioPlayerKeyboard(event) {
    // Only handle shortcuts when audio player is open
    const modal = document.getElementById('audio-player-modal');
    if (!modal || modal.style.display === 'none') {
        return;
    }
    
    const audioElement = window.audioPlayerState.audioElement;
    if (!audioElement) return;
    
    switch (event.key) {
        case ' ': // Space - Play/Pause
            event.preventDefault();
            if (audioElement.paused) {
                audioElement.play();
            } else {
                audioElement.pause();
            }
            break;
            
        case 'ArrowLeft': // Left arrow - Previous page
            event.preventDefault();
            previousPage();
            break;
            
        case 'ArrowRight': // Right arrow - Next page
            event.preventDefault();
            nextPage();
            break;
            
        case 'ArrowUp': // Up arrow - Volume up
            event.preventDefault();
            audioElement.volume = Math.min(1, audioElement.volume + 0.1);
            break;
            
        case 'ArrowDown': // Down arrow - Volume down
            event.preventDefault();
            audioElement.volume = Math.max(0, audioElement.volume - 0.1);
            break;
            
        case 'Escape': // Escape - Close player
            event.preventDefault();
            closeAudioPlayer();
            break;
    }
}

// Auto-advance to next page when current page ends
document.addEventListener('DOMContentLoaded', function() {
    // Setup audio event listeners when the page loads
    const audioElement = document.getElementById('audio-element');
    if (audioElement) {
        audioElement.addEventListener('ended', function() {
            // Auto-advance to next page when current page ends
            const state = window.audioPlayerState;
            if (state.currentPage < state.totalPages) {
                nextPage();
            } else {
                // End of audiobook
                showNotification('Audiobook completed!', 'success');
            }
        });
        
        audioElement.addEventListener('loadstart', function() {
            // Show loading indicator if needed
        });
        
        audioElement.addEventListener('canplay', function() {
            // Hide loading indicator
            // Preload next page for smooth transitions
            preloadNextPage();
        });
        
        audioElement.addEventListener('error', function(e) {
            console.error('Audio playback error:', e);
            showNotification('Error playing audio. Trying next page...', 'warning');
            // Try to skip to next page on error
            if (window.audioPlayerState.currentPage < window.audioPlayerState.totalPages) {
                setTimeout(() => nextPage(), 1000);
            }
        });
    }
});
