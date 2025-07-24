// Global variables
let searchResults = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search on Enter key
    const searchInput = document.getElementById('book-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchBooks();
            }
        });
    }
    
    // Close modal when clicking outside
    document.addEventListener('click', function(event) {
        const modal = document.getElementById('book-modal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

// Search for books using Open Library API
async function searchBooks() {
    const title = document.getElementById('book-search').value.trim();
    const language = document.getElementById('language-select').value;
    
    if (!title) {
        showNotification('Please enter a book title to search', 'error');
        return;
    }
    
    showSearchLoading(true);
    hideSearchResults();
    
    try {
        // Use Open Library Search API
        const query = encodeURIComponent(title);
        const url = `https://openlibrary.org/search.json?q=${query}&limit=20&fields=key,title,author_name,first_publish_year,number_of_pages_median,ratings_average,ratings_count,cover_i,subject,first_sentence,publisher,language,isbn&sort=rating`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Search request failed');
        }
        
        const data = await response.json();
        
        // Process the results
        const books = data.docs.map(book => ({
            key: book.key,
            title: book.title || 'Unknown Title',
            author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
            year: book.first_publish_year || null,
            pages: book.number_of_pages_median || null,
            rating: book.ratings_average ? Math.round(book.ratings_average * 10) / 10 : null,
            rating_count: book.ratings_count || 0,
            cover_id: book.cover_i || null,
            cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
            subjects: book.subject ? book.subject.slice(0, 5) : [],
            first_sentence: book.first_sentence ? (Array.isArray(book.first_sentence) ? book.first_sentence[0] : book.first_sentence) : null,
            publisher: book.publisher ? book.publisher[0] : null,
            languages: book.language || [],
            isbn: book.isbn || [],
            estimated_hours: book.number_of_pages_median ? Math.round((book.number_of_pages_median * 1.5) / 60 * 10) / 10 : null
        }));
        
        // Filter by language if specified and not English
        let filteredBooks = books;
        if (language !== 'en') {
            filteredBooks = books.filter(book => 
                book.languages.some(lang => lang.toLowerCase().includes(language.toLowerCase()))
            );
            
            // If no results for specific language, show all results
            if (filteredBooks.length === 0) {
                filteredBooks = books;
                showNotification(`No books found in selected language. Showing all results.`, 'info');
            }
        }
        
        showSearchLoading(false);
        renderSearchResults(filteredBooks);
        
    } catch (error) {
        showSearchLoading(false);
        showNotification(`Search failed: ${error.message}`, 'error');
        console.error('Search error:', error);
    }
}

// Show/hide search loading
function showSearchLoading(show) {
    const loading = document.getElementById('search-loading');
    const results = document.getElementById('search-results');
    
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
    
    if (!show && results) {
        results.style.display = 'flex';
    }
}

// Hide search results
function hideSearchResults() {
    const results = document.getElementById('search-results');
    if (results) {
        results.style.display = 'none';
        results.innerHTML = '';
    }
}

// Render search results
function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (!container) return;
    
    searchResults = results; // Store for later use
    
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
                                <span class="rating-text">${book.rating}/5 (${book.rating_count})</span>
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
                            ${book.estimated_hours ? `<span class="meta-item">⏱️ ~${book.estimated_hours}h audio</span>` : ''}
                            ${book.publisher ? `<span class="meta-item">🏢 ${escapeHtml(book.publisher)}</span>` : ''}
                        </div>
                        ${book.subjects && book.subjects.length > 0 ? `
                            <div class="book-subjects">
                                <span class="meta-item">🏷️</span>
                                ${book.subjects.slice(0, 3).map(subject => `
                                    <span class="subject-tag">${escapeHtml(subject)}</span>
                                `).join('')}
                                ${book.subjects.length > 3 ? `<span class="subject-more">+${book.subjects.length - 3} more</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="book-actions">
                    <button class="btn btn-primary" onclick="previewBook(${index})">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                        Preview
                    </button>
                    <button class="btn btn-secondary" onclick="showInstallPrompt('${escapeHtml(book.title)}')">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                        Get AudioGen
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    container.style.display = 'flex';
}

// Generate star rating display
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        stars += '★';
    }
    
    // Half star
    if (hasHalfStar) {
        stars += '☆';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        stars += '☆';
    }
    
    return stars;
}

// Preview book details
async function previewBook(index) {
    const book = searchResults[index];
    if (!book) return;
    
    try {
        // Get additional book details from Open Library
        const bookKey = book.key.replace('/works/', '');
        const detailsUrl = `https://openlibrary.org/works/${bookKey}.json`;
        
        let bookDetails = null;
        try {
            const response = await fetch(detailsUrl);
            if (response.ok) {
                bookDetails = await response.json();
            }
        } catch (error) {
            console.log('Could not fetch additional details:', error);
        }
        
        showBookModal(book, bookDetails);
        
    } catch (error) {
        console.error('Preview error:', error);
        showBookModal(book, null);
    }
}

// Show book preview modal
function showBookModal(book, details) {
    const modal = document.getElementById('book-modal');
    const modalBody = document.getElementById('modal-body');
    
    // Combine basic book info with detailed info
    const description = details?.description ? 
        (typeof details.description === 'string' ? details.description : details.description.value) : null;
    
    modalBody.innerHTML = `
        <div class="preview-content">
            <div class="preview-header">
                <div class="preview-cover">
                    ${book.cover_url ? `
                        <img src="${book.cover_url}" alt="${escapeHtml(book.title)}" 
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
                    <h2 class="preview-title">${escapeHtml(book.title)}</h2>
                    <p class="preview-author">by ${escapeHtml(book.author)}</p>
                    
                    ${book.rating ? `
                        <div class="preview-rating">
                            <div class="rating-stars-large">
                                ${generateStars(book.rating)}
                            </div>
                            <span class="rating-details">${book.rating}/5 (${book.rating_count} ratings)</span>
                        </div>
                    ` : ''}
                    
                    <div class="preview-meta-grid">
                        ${book.year ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📅 Published</span>
                                <span class="meta-value">${book.year}</span>
                            </div>
                        ` : ''}
                        ${book.pages ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📄 Pages</span>
                                <span class="meta-value">${book.pages}</span>
                            </div>
                        ` : ''}
                        ${book.estimated_hours ? `
                            <div class="meta-item-large">
                                <span class="meta-label">⏱️ Est. Audio Length</span>
                                <span class="meta-value">${book.estimated_hours} hours</span>
                            </div>
                        ` : ''}
                        ${book.publisher ? `
                            <div class="meta-item-large">
                                <span class="meta-label">🏢 Publisher</span>
                                <span class="meta-value">${escapeHtml(book.publisher)}</span>
                            </div>
                        ` : ''}
                        ${book.languages && book.languages.length > 0 ? `
                            <div class="meta-item-large">
                                <span class="meta-label">🌐 Languages</span>
                                <span class="meta-value">${book.languages.join(', ')}</span>
                            </div>
                        ` : ''}
                        ${book.isbn && book.isbn.length > 0 ? `
                            <div class="meta-item-large">
                                <span class="meta-label">📖 ISBN</span>
                                <span class="meta-value">${book.isbn[0]}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${description ? `
                <div class="preview-section">
                    <h3 class="section-title">📖 Description</h3>
                    <div class="book-description">
                        <p>${escapeHtml(description.substring(0, 500))}${description.length > 500 ? '...' : ''}</p>
                    </div>
                </div>
            ` : book.first_sentence ? `
                <div class="preview-section">
                    <h3 class="section-title">📖 Preview</h3>
                    <div class="book-description">
                        <p><em>"${escapeHtml(book.first_sentence)}"</em></p>
                    </div>
                </div>
            ` : ''}
            
            ${book.subjects && book.subjects.length > 0 ? `
                <div class="preview-section">
                    <h3 class="section-title">🏷️ Subjects & Categories</h3>
                    <div class="subjects-grid">
                        ${book.subjects.map(subject => `
                            <span class="subject-tag-large">${escapeHtml(subject)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="preview-section">
                <h3 class="section-title">🎧 Create Audiobook</h3>
                <div class="download-info">
                    <p><strong>To convert this book to an audiobook:</strong></p>
                    <p>1. Install AudioGen locally (see installation guide below)</p>
                    <p>2. Search for this book in the application</p>
                    <p>3. Choose your preferred AI voice and convert</p>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                    <a href="#installation" class="btn btn-primary" onclick="closeModal(); scrollToInstallation()">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                        Install AudioGen
                    </a>
                    <a href="https://github.com/vats98754/every-audiobook" class="btn btn-secondary" target="_blank">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
                        </svg>
                        View Source
                    </a>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('book-modal');
    modal.style.display = 'none';
}

// Show install prompt
function showInstallPrompt(bookTitle) {
    showNotification(`To convert "${bookTitle}" to an audiobook, install AudioGen locally first!`, 'info');
    setTimeout(() => {
        scrollToInstallation();
    }, 2000);
}

// Scroll to installation section
function scrollToInstallation() {
    const installSection = document.getElementById('installation');
    if (installSection) {
        installSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Copied to clipboard!', 'success');
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div class="notification-text">${message}</div>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-icon {
        font-size: 1.25rem;
    }
    
    .notification-text {
        font-weight: 500;
    }
`;
document.head.appendChild(style);
