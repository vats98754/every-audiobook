from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, flash, abort
from flask_socketio import SocketIO, emit, join_room
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import os
import uuid
import threading
from datetime import datetime
import json
from pathlib import Path
import PyPDF2
import requests
import urllib.request
import tempfile
import shutil

# Import our simplified database
from database import (
    db, User, Audiobook, init_database, get_user_audiobooks, 
    create_audiobook, update_audiobook_progress, create_user, 
    authenticate_user, delete_audiobook, get_database_stats
)

# Import voice engines
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# Flask app configuration
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Initialize database with auto-configuration
if not init_database(app):
    print("❌ Failed to initialize database. Exiting.")
    exit(1)

# Initialize other extensions
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
active_conversions = {}
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'

# Create directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

class OpenLibraryAPI:
    """Simplified Open Library API interface"""
    
    @staticmethod
    def search_books(query, language='en', limit=15):
        try:
            url = "https://openlibrary.org/search.json"
            params = {
                'q': query.strip().replace(' ', '+'),
                'limit': limit,
                'fields': 'key,title,author_name,first_publish_year,ia,subject,isbn,publisher,publish_date,number_of_pages_median,language,cover_i,ratings_average,ratings_count,first_sentence'
            }
            
            # Add proper headers to avoid being blocked
            headers = {
                'User-Agent': 'AudioGen/1.0 (https://github.com/audiobook-app)',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Check if response is actually JSON
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type.lower():
                print(f"Warning: Unexpected content type: {content_type}")
                print(f"Response preview: {response.text[:200]}")
                return []
            
            data = response.json()
            
            books = []
            for doc in data.get('docs', []):
                ia_id = doc.get('ia')
                if not ia_id:
                    continue
                    
                ia_id = ia_id[0] if isinstance(ia_id, list) else ia_id
                
                # Get cover image URL
                cover_id = doc.get('cover_i')
                cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else None
                
                # Get first sentence preview
                first_sentence = doc.get('first_sentence')
                if isinstance(first_sentence, list) and first_sentence:
                    first_sentence = first_sentence[0]
                
                # Format publisher info
                publishers = doc.get('publisher', [])
                publisher = publishers[0] if isinstance(publishers, list) and publishers else 'Unknown Publisher'
                
                # Format publish dates
                publish_dates = doc.get('publish_date', [])
                recent_publish = publish_dates[-1] if isinstance(publish_dates, list) and publish_dates else None
                
                # Calculate estimated reading time (250 WPM average)
                pages = doc.get('number_of_pages_median', 0)
                estimated_hours = round((pages * 250) / 15000, 1) if pages else None  # 250 words/page, 250 WPM reading
                
                book = {
                    'title': doc.get('title', 'Unknown Title'),
                    'author': ', '.join(doc.get('author_name', [])) if doc.get('author_name') else 'Unknown Author',
                    'year': doc.get('first_publish_year', ''),
                    'key': doc.get('key', ''),
                    'ia_id': ia_id,
                    'download_url': f"https://archive.org/download/{ia_id}/{ia_id}.pdf",
                    'subjects': doc.get('subject', [])[:5] if doc.get('subject') else [],
                    'isbn': doc.get('isbn', [])[:1] if doc.get('isbn') else [],
                    'publisher': publisher,
                    'recent_publish_date': recent_publish,
                    'pages': pages,
                    'estimated_hours': estimated_hours,
                    'cover_url': cover_url,
                    'rating': round(doc.get('ratings_average', 0), 1) if doc.get('ratings_average') else None,
                    'rating_count': doc.get('ratings_count', 0),
                    'first_sentence': first_sentence,
                    'languages': doc.get('language', [])[:3] if doc.get('language') else ['English']
                }
                books.append(book)
            
            return books
            
        except requests.exceptions.RequestException as e:
            print(f"Network error during search: {e}")
            return []
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response content: {response.text[:500] if 'response' in locals() else 'No response'}")
            return []
        except Exception as e:
            print(f"Search error: {e}")
            return []

    @staticmethod
    def get_book_details(book_key):
        """Get detailed book information from Open Library by book key"""
        try:
            # First try to get detailed book info
            detail_url = f"https://openlibrary.org{book_key}.json"
            headers = {
                'User-Agent': 'AudioGen/1.0 (https://github.com/audiobook-app)',
                'Accept': 'application/json'
            }
            
            response = requests.get(detail_url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                book_data = response.json()
                
                # Get additional info from works API if this is a work
                works_data = {}
                if '/works/' in book_key:
                    works_url = f"https://openlibrary.org{book_key}.json"
                    works_response = requests.get(works_url, headers=headers, timeout=10)
                    if works_response.status_code == 200:
                        works_data = works_response.json()
                
                # Extract comprehensive information
                description = None
                if works_data.get('description'):
                    desc = works_data['description']
                    if isinstance(desc, dict):
                        description = desc.get('value', '')
                    elif isinstance(desc, str):
                        description = desc
                
                # Get cover information
                covers = book_data.get('covers', works_data.get('covers', []))
                cover_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg" if covers else None
                
                # Extract subjects and genres
                subjects = book_data.get('subjects', works_data.get('subjects', []))
                
                return {
                    'title': book_data.get('title', works_data.get('title', 'Unknown Title')),
                    'description': description,
                    'subjects': subjects[:10] if subjects else [],
                    'cover_url': cover_url,
                    'first_publish_date': book_data.get('first_publish_date', ''),
                    'key': book_data.get('key', book_key),
                    'revision': book_data.get('revision', 1),
                    'created': book_data.get('created', {}).get('value', ''),
                    'last_modified': book_data.get('last_modified', {}).get('value', '')
                }
            
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"Network error during book details fetch: {e}")
            return None
        except Exception as e:
            print(f"Error fetching book details: {e}")
            return None

class AudiobookConverter:
    def __init__(self, audiobook_id, socketio_instance):
        self.audiobook_id = audiobook_id
        self.socketio = socketio_instance
        self.audiobook = Audiobook.query.get(audiobook_id)
        self.log_prefix = f"[AudiobookConverter:{audiobook_id}]"
    
    def emit_progress(self, status, progress=None, message=""):
        print(f"{self.log_prefix} {status}: {message}")  # Add logging
        update = {
            'status': status,
            'progress': progress,
            'message': message,
            'audiobook_id': self.audiobook_id
        }
        self.socketio.emit('conversion_progress', update, room=self.audiobook_id)
        
        # Update database
        if status == 'completed':
            update_audiobook_progress(self.audiobook_id, status='completed', progress=100)
        elif status == 'failed':
            update_audiobook_progress(self.audiobook_id, status='failed', error_message=message)
        elif progress is not None:
            update_audiobook_progress(self.audiobook_id, progress=progress)
        
    def download_pdf(self, url):
        try:
            self.emit_progress("downloading", 10, f"Downloading PDF from {url}")
            filename = f"{self.audiobook_id}.pdf"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            with open(filepath, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        file.write(chunk)
            self.emit_progress("downloaded", 30, f"Download complete: {filepath}")
            return filepath
        except Exception as e:
            print(f"{self.log_prefix} Download failed: {e}")
            raise Exception(f"Download failed: {str(e)}")
    
    def extract_text(self, pdf_path):
        try:
            self.emit_progress("extracting", 40, f"Extracting text from {pdf_path}")
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                update_audiobook_progress(self.audiobook_id, total_pages=total_pages)
                text_pages = []
                for i, page in enumerate(pdf_reader.pages):
                    try:
                        text = page.extract_text()
                        if text and text.strip():
                            text_pages.append({
                                'page_number': i + 1,
                                'text': text.strip()
                            })
                    except Exception as e:
                        print(f"{self.log_prefix} Failed to extract page {i+1}: {e}")
                        continue
                    progress = 40 + (i / total_pages) * 20
                    self.emit_progress("extracting", progress, f"Extracted page {i + 1} of {total_pages}")
                self.emit_progress("extracted", 60, f"Text extraction complete! {len(text_pages)} pages processed.")
                if not text_pages:
                    raise Exception("No text extracted from PDF. Conversion aborted.")
                return text_pages
        except Exception as e:
            print(f"{self.log_prefix} Text extraction failed: {e}")
            raise Exception(f"Text extraction failed: {str(e)}")
    
    def convert_to_audio(self, text_pages, voice_engine, voice_settings):
        try:
            self.emit_progress("converting", 65, "Starting audio conversion...")
            audio_files = []
            total_pages = len(text_pages)
            for i, page_data in enumerate(text_pages):
                page_num = i + 1
                audio_path = os.path.join(OUTPUT_FOLDER, f"{self.audiobook_id}_page_{page_num}.mp3")
                self.generate_audio(page_data['text'], voice_engine, voice_settings, page_num, audio_path)
                if not os.path.exists(audio_path):
                    print(f"{self.log_prefix} Audio file not created: {audio_path}")
                    raise Exception(f"Audio file not created for page {page_num}")
                audio_files.append(audio_path)
                self.emit_progress("converting", int(65 + 30*(i+1)/total_pages), f"Converted page {page_num}/{total_pages}")
            self.emit_progress("completed", 100, "Conversion complete!")
            return audio_files
        except Exception as e:
            print(f"{self.log_prefix} Audio conversion failed: {e}")
            self.emit_progress("failed", 0, str(e))
            raise

    def split_page_into_chunks(self, text, max_chunk_size=500):
        """Split text into smaller chunks at sentence boundaries for better audio streaming"""
        if len(text) <= max_chunk_size:
            return [text]
        
        # Split at sentence boundaries first
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # If adding this sentence would exceed max size, start new chunk
            if len(current_chunk) + len(sentence) > max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        # Add the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def generate_audio(self, text, voice_engine, voice_settings, page_number, audio_path):
        try:
            if not text.strip():
                print(f"{self.log_prefix} Empty text for page {page_number}, skipping audio generation.")
                return
            if voice_engine == 'gtts':
                from gtts import gTTS
                tts = gTTS(text, lang=voice_settings.get('language', 'en'))
                tts.save(audio_path)
                print(f"{self.log_prefix} Saved audio: {audio_path}")
            # ...add pyttsx3/OpenAI support as needed...
        except Exception as e:
            print(f"{self.log_prefix} Failed to generate audio for page {page_number}: {e}")
            raise

# Routes
@app.route('/')
def index():
    """Home page - redirect to dashboard if logged in"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('auth/login.html')

@app.route('/register')
def register():
    return render_template('auth/register.html')

@app.route('/dashboard')
@login_required
def dashboard():
    audiobooks = get_user_audiobooks(current_user.id)
    return render_template('dashboard.html', audiobooks=audiobooks)

@app.route('/api/register', methods=['POST'])
def api_register():
    try:
        data = request.get_json()
        
        # Use the new create_user helper function
        user = create_user(data['email'], data['password'], data['name'])
        
        if user:
            return jsonify({'success': True, 'message': 'Registration successful'})
        else:
            return jsonify({'success': False, 'message': 'Email already registered'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/login', methods=['POST'])
def api_login():
    try:
        data = request.get_json()
        
        # Use the new authenticate_user helper function
        user = authenticate_user(data['email'], data['password'])
        
        if user:
            login_user(user, remember=data.get('remember', False))
            return jsonify({'success': True, 'redirect': url_for('dashboard')})
        else:
            return jsonify({'success': False, 'message': 'Invalid email or password'})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/logout')
@login_required
def api_logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/search', methods=['POST'])
def search_books():
    """Public search endpoint for demonstration purposes"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'})
        
        query = data.get('query', '').strip()
        language = data.get('language', 'en')
        
        if not query:
            return jsonify({'success': False, 'message': 'Query cannot be empty'})
        
        print(f"Searching for: '{query}' in language: {language}")
        books = OpenLibraryAPI.search_books(query, language)
        
        return jsonify({
            'success': True, 
            'books': books,
            'total': len(books),
            'query': query
        })
        
    except Exception as e:
        print(f"Search endpoint error: {e}")
        return jsonify({'success': False, 'message': f'Search failed: {str(e)}'})

@app.route('/api/convert', methods=['POST'])
@login_required
def start_conversion():
    try:
        data = request.get_json()
        book = data['book']
        voice_engine = data['voice_engine']
        voice_settings = data['voice_settings']
        
        # Create audiobook record
        audiobook = create_audiobook(
            user_id=current_user.id,
            title=book['title'],
            author=book['author'],
            voice_engine=voice_engine,
            voice_settings=voice_settings,
            source_type='search',  # Since we're using Open Library search
            source_url=book.get('download_url')
        )
        
        # Start conversion in background
        def run_conversion():
            from app_simple import app  # Ensure app is imported here if needed
            with app.app_context():
                converter = AudiobookConverter(audiobook.id, socketio)
                try:
                    converter.emit_progress('processing', 0, 'Starting conversion...')
                    # Download PDF
                    pdf_path = converter.download_pdf(book['download_url'])
                    
                    # Extract text
                    text_pages = converter.extract_text(pdf_path)
                    
                    # Convert to audio
                    audio_files = converter.convert_to_audio(text_pages, voice_engine, voice_settings)
                    
                    # Clean up
                    if os.path.exists(pdf_path):
                        os.remove(pdf_path)
                        
                except Exception as e:
                    converter.emit_progress("failed", 0, str(e))
        
        threading.Thread(target=run_conversion).start()
        
        return jsonify({
            'success': True,
            'conversion_id': audiobook.id,
            'message': 'Conversion started'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/audiobooks')
@login_required
def get_audiobooks():
    audiobooks = get_user_audiobooks(current_user.id)
    return jsonify({'audiobooks': [book.to_dict() for book in audiobooks]})

@app.route('/api/audiobook/<audiobook_id>/download/<int:page>')
@login_required
def download_audio_page(audiobook_id, page):
    try:
        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if not audiobook:
            return jsonify({'error': 'Audiobook not found'}), 404
        
        file_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{page:03d}.mp3")
        if not os.path.exists(file_path):
            return jsonify({'error': 'Audio file not found'}), 404
        
        return send_file(file_path, as_attachment=True)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobook/<audiobook_id>/stream/<int:page>')
@login_required
def stream_audio_page(audiobook_id, page):
    try:
        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if not audiobook:
            return jsonify({'error': 'Audiobook not found'}), 404
        
        # Try to find the single page file first (for backward compatibility)
        file_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{page:03d}.mp3")
        if os.path.exists(file_path):
            return send_file(file_path, mimetype='audio/mpeg', as_attachment=False)
        
        # If single file doesn't exist, look for chunked files and return the first chunk
        chunk_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{page:03d}_chunk_00.mp3")
        if os.path.exists(chunk_path):
            return send_file(chunk_path, mimetype='audio/mpeg', as_attachment=False)
        
        return jsonify({'error': 'Audio file not found'}), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobook/<audiobook_id>/stream/<int:page>/chunk/<int:chunk>')
@login_required
def stream_audio_chunk(audiobook_id, page, chunk):
    """Stream a specific chunk of a page for more granular control"""
    try:
        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if not audiobook:
            return jsonify({'error': 'Audiobook not found'}), 404
        
        file_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{page:03d}_chunk_{chunk:02d}.mp3")
        if not os.path.exists(file_path):
            return jsonify({'error': 'Audio chunk not found'}), 404
        
        return send_file(file_path, mimetype='audio/mpeg', as_attachment=False)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audiobook/<audiobook_id>/pages')
@login_required
def get_audiobook_pages(audiobook_id):
    try:
        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if not audiobook:
            return jsonify({'error': 'Audiobook not found'}), 404
        
        # Get all audio files for this audiobook
        pages = []
        for i in range(1, audiobook.total_pages + 1):
            # Check for single page file first
            file_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{i:03d}.mp3")
            
            if os.path.exists(file_path):
                pages.append({
                    'page': i,
                    'available': True,
                    'stream_url': f'/api/audiobook/{audiobook_id}/stream/{i}',
                    'chunks': None  # Single file, no chunks
                })
            else:
                # Check for chunked files
                chunks = []
                chunk_index = 0
                while True:
                    chunk_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{i:03d}_chunk_{chunk_index:02d}.mp3")
                    if os.path.exists(chunk_path):
                        chunks.append({
                            'chunk': chunk_index,
                            'stream_url': f'/api/audiobook/{audiobook_id}/stream/{i}/chunk/{chunk_index}'
                        })
                        chunk_index += 1
                    else:
                        break
                
                if chunks:
                    pages.append({
                        'page': i,
                        'available': True,
                        'stream_url': f'/api/audiobook/{audiobook_id}/stream/{i}',  # Default to first chunk
                        'chunks': chunks
                    })
                else:
                    pages.append({
                        'page': i,
                        'available': False,
                        'stream_url': None,
                        'chunks': None
                    })
        
        return jsonify({
            'success': True,
            'audiobook': {
                'id': audiobook.id,
                'title': audiobook.title,
                'author': audiobook.author,
                'total_pages': audiobook.total_pages,
                'status': audiobook.status
            },
            'pages': pages
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('join_conversion')
def handle_join_conversion(data):
    join_room(data['conversion_id'])
    emit('joined', {'conversion_id': data['conversion_id']})

# ============================================================================
# ADMIN AND UTILITY ROUTES
# ============================================================================

@app.route('/api/stats')
@login_required
def get_stats():
    """Get user and global statistics"""
    try:
        # Get user's audiobook stats
        user_audiobooks = get_user_audiobooks(current_user.id)
        user_stats = {
            'total_audiobooks': len(user_audiobooks),
            'completed': len([a for a in user_audiobooks if a.status == 'completed']),
            'processing': len([a for a in user_audiobooks if a.status == 'processing']),
            'failed': len([a for a in user_audiobooks if a.status == 'failed'])
        }
        
        # Get global stats
        global_stats = get_database_stats()
        
        return jsonify({
            'success': True,
            'user_stats': user_stats,
            'global_stats': global_stats
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/audiobooks/<audiobook_id>', methods=['DELETE'])
@login_required
def api_delete_audiobook(audiobook_id):
    """Delete an audiobook (user can only delete their own)"""
    try:
        if delete_audiobook(audiobook_id, current_user.id):
            return jsonify({'success': True, 'message': 'Audiobook deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Audiobook not found or unauthorized'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/audiobooks/<audiobook_id>')
@login_required
def api_get_audiobook(audiobook_id):
    """Get details of a specific audiobook"""
    try:
        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if audiobook:
            return jsonify({'success': True, 'audiobook': audiobook.to_dict()})
        else:
            return jsonify({'success': False, 'message': 'Audiobook not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/available-voices')
def available_voices():
    """Get list of available voice engines and their settings"""
    try:
        engines = []
        
        if GTTS_AVAILABLE:
            engines.append({
                'id': 'gtts',
                'name': 'Google Text-to-Speech',
                'description': 'High-quality Google voices with multiple languages',
                'languages': ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
                'settings': {
                    'language': {'type': 'select', 'default': 'en'},
                    'slow': {'type': 'boolean', 'default': False}
                }
            })
        
        if PYTTSX3_AVAILABLE:
            engines.append({
                'id': 'pyttsx3',
                'name': 'System Text-to-Speech',
                'description': 'Use your system\'s built-in voice synthesis',
                'languages': ['en'],
                'settings': {
                    'rate': {'type': 'range', 'min': 100, 'max': 300, 'default': 200},
                    'volume': {'type': 'range', 'min': 0.0, 'max': 1.0, 'default': 0.9},
                    'voice_id': {'type': 'select', 'default': 0}
                }
            })
        
        if OPENAI_AVAILABLE:
            engines.append({
                'id': 'openai',
                'name': 'OpenAI TTS',
                'description': 'Premium AI voices from OpenAI',
                'languages': ['en'],
                'settings': {
                    'voice': {'type': 'select', 'options': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], 'default': 'alloy'},
                    'model': {'type': 'select', 'options': ['tts-1', 'tts-1-hd'], 'default': 'tts-1'}
                }
            })
        
        return jsonify({
            'success': True,
            'engines': engines,
            'default_engine': 'gtts' if GTTS_AVAILABLE else engines[0]['id'] if engines else None
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/book/preview', methods=['POST'])
def preview_book():
    """Get detailed book preview from Open Library"""
    try:
        data = request.get_json()
        if not data or 'key' not in data:
            return jsonify({'success': False, 'message': 'Book key required'})
        
        book_key = data['key']
        preview_data = OpenLibraryAPI.get_book_details(book_key)
        
        if preview_data:
            return jsonify({'success': True, 'book': preview_data})
        else:
            return jsonify({'success': False, 'message': 'Book details not found'})
            
    except Exception as e:
        print(f"Preview endpoint error: {e}")
        return jsonify({'success': False, 'message': f'Preview failed: {str(e)}'})

@app.route('/api/book/add-to-collection', methods=['POST'])
@login_required
def add_book_to_collection():
    """Add a book to user's collection without converting it yet"""
    try:
        data = request.get_json()
        if not data or 'book' not in data:
            return jsonify({'success': False, 'message': 'Book data required'})
        
        book = data['book']
        
        # Check if book already exists in user's collection
        existing = Audiobook.query.filter_by(
            user_id=current_user.id,
            title=book['title'],
            author=book['author']
        ).first()
        
        if existing:
            return jsonify({
                'success': False, 
                'message': 'This book is already in your collection',
                'audiobook_id': existing.id
            })
        
        # Create audiobook record without starting conversion
        audiobook = create_audiobook(
            user_id=current_user.id,
            title=book['title'],
            author=book['author'],
            voice_engine='gtts',  # Default engine
            voice_settings={'language': 'en'},
            source_type='search',
            source_url=book.get('download_url', ''),
            status='saved'  # New status for saved but not converted books
        )
        
        return jsonify({
            'success': True,
            'message': 'Book added to your collection',
            'audiobook_id': audiobook.id,
            'audiobook': audiobook.to_dict()
        })
        
    except Exception as e:
        print(f"Add to collection error: {e}")
        return jsonify({'success': False, 'message': f'Failed to add book: {str(e)}'})

@app.route('/api/book/convert-from-collection', methods=['POST'])
@login_required
def convert_from_collection():
    """Start conversion for a book already in collection"""
    try:
        data = request.get_json()
        audiobook_id = data.get('audiobook_id')
        voice_engine = data.get('voice_engine', 'gtts')
        voice_settings = data.get('voice_settings', {'language': 'en'})

        audiobook = Audiobook.query.filter_by(id=audiobook_id, user_id=current_user.id).first()
        if not audiobook:
            return jsonify({'success': False, 'message': 'Audiobook not found'}), 404

        # Start conversion in background thread with app context
        def run_conversion():
            from app_simple import app
            with app.app_context():
                converter = AudiobookConverter(audiobook.id, socketio)
                try:
                    converter.emit_progress('processing', 0, 'Starting conversion...')
                    # Download PDF
                    pdf_path = converter.download_pdf(audiobook.source_url)
                    # Extract text
                    text_pages = converter.extract_text(pdf_path)
                    # Convert to audio
                    audio_files = converter.convert_to_audio(text_pages, voice_engine, voice_settings)
                    # Clean up
                    if os.path.exists(pdf_path):
                        os.remove(pdf_path)
                except Exception as e:
                    converter.emit_progress('failed', 0, str(e))

        threading.Thread(target=run_conversion).start()
        return jsonify({'success': True, 'message': 'Conversion started'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/auth-status')
def auth_status():
    """Check if user is authenticated"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'name': current_user.name,
                'email': current_user.email
            }
        })
    else:
        return jsonify({'authenticated': False})

# --- STREAMING ENDPOINT ---
@app.route('/stream/<audiobook_id>/<int:page_number>')
def stream_audio(audiobook_id, page_number):
    """Stream the audio file for a specific page of an audiobook."""
    audio_path = os.path.join(OUTPUT_FOLDER, f"{audiobook_id}_page_{page_number}.mp3")
    if not os.path.exists(audio_path):
        return abort(404, description="Audio not found")
    return send_file(audio_path, mimetype='audio/mpeg')

if __name__ == '__main__':
    print("🚀 Starting AudioGen server...")
    socketio.run(app, debug=True, port=5000)
