// Global variables
let socket;
let selectedBook = null;
let selectedVoiceEngine = null;
let availableVoices = null;
let currentConversionId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus(); // Check auth status first
    initializeSocket();
    loadAvailableVoices();
    setupEventListeners();
});

// Initialize WebSocket connection
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
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: title, language })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Search failed');
        }
        
        showSearchLoading(false);
        renderSearchResults(data.books);
        
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
function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">📚</div>
                <div class="no-results-title">No books found</div>
                <div class="no-results-subtitle">Try a different search term or check your spelling</div>
            </div>
        `;
    } else {
        container.innerHTML = results.map((book, index) => `
            <div class="book-card" data-book-index="${index}">
                <div class="book-cover">
                    ${book.cover_url ? `
                        <img src="${book.cover_url}" alt="${escapeHtml(book.title)}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="book-cover-placeholder" style="display: none;">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 19V5h14v14H5z"/>
                                <path d="M17 8.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zM8 17h8v-1H8v1zm0-2h8v-1H8v1zm0-2h4v-1H8v1z"/>
                            </svg>
                        </div>
                    ` : `
                        <div class="book-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 19V5h14v14H5z"/>
                                <path d="M17 8.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5.22.5.5.5.5-.22.5-.5zM8 17h8v-1H8v1zm0-2h8v-1H8v1zm0-2h4v-1H8v1z"/>
                            </svg>
                        </div>
                    `}
                </div>
                <div class="book-info">
                    <div class="book-header">
                        <h3 class="book-title">${escapeHtml(book.title)}</h3>
                        ${book.rating ? `
                            <div class="book-rating">
                                <div class="rating-stars">
                                    ${generateStars(book.rating)}
                                </div>
                                <span class="rating-text">${book.rating} (${book.rating_count || 0})</span>
                            </div>
                        ` : ''}
                    </div>
                    <p class="book-author">by ${escapeHtml(book.author)}</p>
                    
                    ${book.first_sentence ? `
                        <p class="book-excerpt">${escapeHtml(book.first_sentence.substring(0, 150))}${book.first_sentence.length > 150 ? '...' : ''}</p>
                    ` : ''}
                    
                    <div class="book-meta">
                        <div class="meta-row">
                            ${book.year ? `<span class="meta-item">📅 ${book.year}</span>` : ''}
                            ${book.pages ? `<span class="meta-item">📄 ${book.pages} pages</span>` : ''}
                            ${book.estimated_hours ? `<span class="meta-item">⏱️ ~${book.estimated_hours} hours</span>` : ''}
                        </div>
                        <div class="meta-row">
                            ${book.publisher ? `<span class="meta-item">🏢 ${escapeHtml(book.publisher)}</span>` : ''}
                            ${book.languages && book.languages.length > 0 ? `<span class="meta-item">🌐 ${book.languages.join(', ')}</span>` : ''}
                        </div>
                    </div>
                    
                    ${book.subjects && book.subjects.length > 0 ? `
                        <div class="book-subjects">
                            ${book.subjects.slice(0, 3).map(subject => `
                                <span class="subject-tag">${escapeHtml(subject)}</span>
                            `).join('')}
                            ${book.subjects.length > 3 ? `<span class="subject-more">+${book.subjects.length - 3} more</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="book-actions">
                    <button class="btn btn-primary" onclick="previewBook(${index})" title="View detailed preview">
                        <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                        Preview
                    </button>
                    <button class="btn btn-success" onclick="addToCollection(${index})" title="Add to your library">
                        <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                        </svg>
                        Add to Library
                    </button>
                    <button class="btn btn-secondary" onclick="quickConvert(${index})" title="Convert immediately">
                        <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                        Convert Now
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    container.style.display = 'block';
    
    // Store results for later use
    window.searchResults = results;
}

// Generate star rating display
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        stars += '⭐';
    }
    
    // Half star
    if (hasHalfStar) {
        stars += '⭐'; // Using full star for simplicity
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        stars += '☆';
    }
    
    return stars;
}

// Preview book details
async function previewBook(index) {
    const book = window.searchResults[index];
    if (!book) {
        showError('Book not found');
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
            // Update modal with detailed information
            updatePreviewModal(modal, book, data.book);
        } else {
            // Show basic info if detailed fetch fails
            updatePreviewModal(modal, book, null);
        }
        
    } catch (error) {
        console.error('Preview error:', error);
        showError('Failed to load book preview');
    }
}

// Add book to collection
async function addToCollection(index) {
    const book = window.searchResults[index];
    if (!book) {
        showError('Book not found');
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
            showSuccess(data.message);
            
            // Update button to show book was added
            const button = document.querySelector(`[data-book-index="${index}"] .result-actions button:last-child`);
            if (button) {
                button.innerHTML = `
                    <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon-small">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Added!
                `;
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                button.disabled = true;
            }
        } else {
            // Handle authentication error
            if (response.status === 401 || response.status === 302) {
                showSignupPrompt(book);
            } else {
                showError(data.message || 'Failed to add book to collection');
            }
        }
        
    } catch (error) {
        console.error('Add to collection error:', error);
        
        // Likely an authentication error, show signup prompt
        showSignupPrompt(book);
    }
}

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
                            </svg>
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
                    <h3 class="section-title">🏷️ Subjects & Categories</h3>
                    <div class="subjects-grid">
                        ${(book.subjects || basicBook.subjects).map(subject => `
                            <span class="subject-tag-large">${escapeHtml(subject)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="preview-section">
                <h3 class="section-title">🎧 Audio Conversion Options</h3>
                <div class="conversion-options">
                    <div class="option-card">
                        <div class="option-icon">⚡</div>
                        <div class="option-info">
                            <h4>Quick Convert</h4>
                            <p>Convert immediately with default voice settings (Google TTS, English)</p>
                        </div>
                        <button class="btn btn-primary" onclick="quickConvertFromPreview('${basicBook.title}', '${basicBook.author}', '${basicBook.key}', '${basicBook.download_url}')">
                            Convert Now
                        </button>
                    </div>
                    <div class="option-card">
                        <div class="option-icon">📚</div>
                        <div class="option-info">
                            <h4>Add to Library</h4>
                            <p>Save to your collection and customize voice settings later</p>
                        </div>
                        <button class="btn btn-success" onclick="addToCollectionFromPreview('${basicBook.title}', '${basicBook.author}', '${basicBook.key}', '${basicBook.download_url}')">
                            Add to Library
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="preview-actions">
                <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                    Close Preview
                </button>
            </div>
        </div>
    `;
}

// Quick convert from preview modal
async function quickConvertFromPreview(title, author, key, downloadUrl) {
    const book = {
        title: title,
        author: author,
        key: key,
        download_url: downloadUrl
    };
    
    try {
        // First add to collection
        const addResponse = await fetch('/api/book/add-to-collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book: book })
        });
        
        if (addResponse.status === 401 || addResponse.status === 302) {
            document.querySelector('.preview-modal').remove();
            showSignupPrompt(book);
            return;
        }
        
        const addData = await addResponse.json();
        
        if (!addData.success && !addData.audiobook_id) {
            showError(addData.message || 'Failed to add book');
            return;
        }
        
        // Start conversion immediately
        const audiobookId = addData.audiobook_id;
        const conversionResponse = await fetch('/api/book/convert-from-collection', {
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
        
        const conversionData = await conversionResponse.json();
        
        if (conversionData.success) {
            showSuccess('Conversion started! Check your dashboard for progress.');
            document.querySelector('.preview-modal').remove();
        } else {
            showError(conversionData.message || 'Failed to start conversion');
        }
        
    } catch (error) {
        console.error('Quick convert from preview error:', error);
        document.querySelector('.preview-modal').remove();
        showSignupPrompt(book);
    }
}

// Add to collection from preview modal
async function addToCollectionFromPreview(title, author, key, downloadUrl) {
    const book = {
        title: title,
        author: author,
        key: key,
        download_url: downloadUrl
    };
    
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
            showSuccess(data.message);
            // Close the modal
            document.querySelector('.preview-modal').remove();
        } else {
            if (response.status === 401 || response.status === 302) {
                // Close preview modal and show signup prompt
                document.querySelector('.preview-modal').remove();
                showSignupPrompt(book);
            } else {
                showError(data.message || 'Failed to add book to collection');
            }
        }
        
    } catch (error) {
        console.error('Add to collection error:', error);
        // Close preview modal and show signup prompt
        document.querySelector('.preview-modal').remove();
        showSignupPrompt(book);
    }
}

// Show signup prompt when trying to convert without account
function showSignupPrompt(book) {
    const prompt = document.createElement('div');
    prompt.className = 'signup-prompt-modal';
    prompt.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Ready to Create Your Audiobook?</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <p>You've selected: <strong>${escapeHtml(book.title)}</strong> by ${escapeHtml(book.author)}</p>
                <p>Create a free account to convert this book to an audiobook with premium AI voices.</p>
            </div>
            <div class="modal-actions">
                <a href="/register" class="btn btn-primary">Create Free Account</a>
                <a href="/login" class="btn btn-secondary">Sign In</a>
            </div>
        </div>
    `;
    
    // Add modal styles
    prompt.style.cssText = `
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
    
    document.body.appendChild(prompt);
}

// Check authentication status and update navigation
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            // User is logged in, update navigation
            updateNavForLoggedInUser(data.user);
            updateBrandLink('/dashboard');
        }
    } catch (error) {
        console.log('Auth check failed:', error);
        // Continue as non-authenticated user
    }
}

// Update navigation for logged-in users
function updateNavForLoggedInUser(user) {
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) {
        authButtons.innerHTML = `
            <span class="user-greeting">Hello, ${escapeHtml(user.name)}!</span>
            <a href="/dashboard" class="btn btn-primary">Dashboard</a>
            <a href="/api/logout" class="btn btn-secondary">Sign Out</a>
        `;
    }
}

// Update brand link based on authentication
function updateBrandLink(href) {
    const brandLink = document.getElementById('nav-brand-link');
    if (brandLink) {
        brandLink.href = href;
    }
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
                book: selectedBook,
                voice_engine: selectedVoiceEngine,
                voice_settings: voiceSettings
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Conversion failed to start');
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

// Show success message
function showSuccess(message) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <svg class="notification-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <span class="notification-text">${escapeHtml(message)}</span>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
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

// Quick convert function
async function quickConvert(index) {
    const book = window.searchResults[index];
    if (!book) {
        showError('Book not found');
        return;
    }
    
    try {
        // First add to collection
        const addResponse = await fetch('/api/book/add-to-collection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book: book })
        });
        
        if (addResponse.status === 401 || addResponse.status === 302) {
            showSignupPrompt(book);
            return;
        }
        
        const addData = await addResponse.json();
        
        if (!addData.success) {
            if (addData.audiobook_id) {
                // Book already exists, start conversion
                startConversionForBook(addData.audiobook_id);
            } else {
                showError(addData.message || 'Failed to add book');
            }
            return;
        }
        
        // Start conversion immediately
        startConversionForBook(addData.audiobook_id);
        
    } catch (error) {
        console.error('Quick convert error:', error);
        showSignupPrompt(book);
    }
}

// Start conversion for a specific book
async function startConversionForBook(audiobookId) {
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
            showSuccess('Conversion started! Check your dashboard for progress.');
        } else {
            showError(data.message || 'Failed to start conversion');
        }
        
    } catch (error) {
        console.error('Start conversion error:', error);
        showError('Failed to start conversion');
    }
}
