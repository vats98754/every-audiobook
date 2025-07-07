from flask import Flask, render_template, request, jsonify, send_file, session
from flask_socketio import SocketIO, emit, join_room
import os
import uuid
import threading
from datetime import datetime
import json
from pathlib import Path
import PyPDF2
from libgen_api import LibgenSearch
import urllib.request
from convert_to_iso import convert
import tempfile
import shutil
from werkzeug.utils import secure_filename
from difflib import SequenceMatcher

# Ranking and similarity functions
def similarity(a, b):
    """Calculate similarity between two strings"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def rank_search_results(search_term, results):
    """Rank search results by relevance"""
    ranked_results = []
    
    for book in results:
        title = book.get('Title', '').strip()
        author = book.get('Author', '').strip()
        year = book.get('Year', '')
        pages = book.get('Pages', '0')
        
        # Calculate relevance score
        title_similarity = similarity(search_term, title)
        
        # Bonus points for exact matches in title
        if search_term.lower() in title.lower():
            title_similarity += 0.3
            
        # Bonus for author match if search term contains author info
        author_similarity = 0
        if author and len(search_term.split()) > 1:
            author_similarity = similarity(search_term, author) * 0.2
            
        # Prefer newer books (small bonus)
        year_bonus = 0
        try:
            if year and str(year).isdigit():
                year_int = int(year)
                if year_int >= 2000:
                    year_bonus = 0.1
                elif year_int >= 1990:
                    year_bonus = 0.05
        except:
            pass
            
        # Prefer books with reasonable page counts
        page_bonus = 0
        try:
            if pages and str(pages).isdigit():
                page_count = int(pages)
                if 50 <= page_count <= 1000:  # Reasonable book length
                    page_bonus = 0.1
        except:
            pass
            
        total_score = title_similarity + author_similarity + year_bonus + page_bonus
        
        ranked_results.append({
            'book': book,
            'score': total_score
        })
    
    # Sort by score descending
    ranked_results.sort(key=lambda x: x['score'], reverse=True)
    return [result['book'] for result in ranked_results]

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

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables for tracking conversions
active_conversions = {}
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'

# Create necessary directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

class AudiobookConverter:
    def __init__(self, conversion_id, socketio_instance):
        self.conversion_id = conversion_id
        self.socketio = socketio_instance
        self.status = "initializing"
        self.progress = 0
        self.total_pages = 0
        self.current_page = 0
        
    def emit_progress(self, status, progress=None, message=""):
        """Emit progress updates to the frontend"""
        update = {
            'status': status,
            'progress': progress or self.progress,
            'total_pages': self.total_pages,
            'current_page': self.current_page,
            'message': message
        }
        self.socketio.emit('conversion_progress', update, room=self.conversion_id)
        
    def download_from_libgen(self, title, language):
        """Download book from Library Genesis"""
        try:
            self.emit_progress("searching", 10, f"Searching for '{title}' in {language}...")
            
            s = LibgenSearch()
            title_filters = {"Language": language, "Extension": "pdf"}
            titles = s.search_title_filtered(title, title_filters, exact_match=False)
            
            if not titles:
                raise Exception("Book not found in Library Genesis")
                
            self.emit_progress("downloading", 20, "Found book! Starting download...")
            
            item_to_download = titles[0]
            download_links = s.resolve_download_links(item_to_download)
            
            # Try different download mirrors
            pdf_link = None
            for mirror in ['Cloudflare', 'IPFS.io', 'Infura']:
                if mirror in download_links:
                    pdf_link = download_links[mirror]
                    break
                    
            if not pdf_link:
                raise Exception("No download links available")
                
            # Download the file
            filename = f"{self.conversion_id}.pdf"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            
            response = urllib.request.urlopen(pdf_link)
            with open(filepath, 'wb') as file:
                file.write(response.read())
                
            self.emit_progress("downloaded", 30, "Download complete!")
            return filepath, item_to_download.get('Title', title)
            
        except Exception as e:
            raise Exception(f"Download failed: {str(e)}")
    
    def extract_text_from_pdf(self, pdf_path):
        """Extract text from PDF file"""
        try:
            self.emit_progress("extracting", 40, "Extracting text from PDF...")
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                self.total_pages = len(pdf_reader.pages)
                
                text_pages = []
                for i, page in enumerate(pdf_reader.pages):
                    self.current_page = i + 1
                    self.progress = 40 + (i / self.total_pages) * 20  # 40-60%
                    
                    text = page.extract_text()
                    if text.strip():  # Only add pages with content
                        text_pages.append({
                            'page_number': i + 1,
                            'text': text.strip()
                        })
                    
                    self.emit_progress("extracting", self.progress, 
                                     f"Extracted page {i + 1} of {self.total_pages}")
                
                self.emit_progress("extracted", 60, f"Text extraction complete! {len(text_pages)} pages processed.")
                return text_pages
                
        except Exception as e:
            raise Exception(f"Text extraction failed: {str(e)}")
    
    def convert_to_audio(self, text_pages, voice_engine, voice_settings):
        """Convert text to audio using selected voice engine"""
        try:
            self.emit_progress("converting", 65, "Starting audio conversion...")
            
            audio_files = []
            total_pages = len(text_pages)
            
            for i, page_data in enumerate(text_pages):
                self.current_page = page_data['page_number']
                self.progress = 65 + (i / total_pages) * 30  # 65-95%
                
                page_text = f"Page {page_data['page_number']}. {page_data['text']}"
                
                # Generate audio for this page
                audio_file = self.generate_audio(page_text, voice_engine, voice_settings, i)
                if audio_file:
                    audio_files.append({
                        'page': page_data['page_number'],
                        'file': audio_file,
                        'duration': 0  # You can add duration calculation here
                    })
                
                self.emit_progress("converting", self.progress, 
                                 f"Converted page {self.current_page} of {total_pages}")
            
            self.emit_progress("finalizing", 95, "Finalizing audiobook...")
            return audio_files
            
        except Exception as e:
            raise Exception(f"Audio conversion failed: {str(e)}")
    
    def generate_audio(self, text, voice_engine, voice_settings, page_index):
        """Generate audio file for a single page"""
        try:
            output_file = os.path.join(OUTPUT_FOLDER, f"{self.conversion_id}_page_{page_index:03d}.mp3")
            
            if voice_engine == "gtts" and GTTS_AVAILABLE:
                tts = gTTS(
                    text=text,
                    lang=voice_settings.get('language', 'en'),
                    slow=voice_settings.get('slow', False)
                )
                tts.save(output_file)
                
            elif voice_engine == "pyttsx3" and PYTTSX3_AVAILABLE:
                engine = pyttsx3.init()
                
                # Set voice properties
                voices = engine.getProperty('voices')
                if voice_settings.get('voice_id') and len(voices) > int(voice_settings['voice_id']):
                    engine.setProperty('voice', voices[int(voice_settings['voice_id'])].id)
                
                engine.setProperty('rate', voice_settings.get('rate', 200))
                engine.setProperty('volume', voice_settings.get('volume', 0.9))
                
                engine.save_to_file(text, output_file)
                engine.runAndWait()
                
            elif voice_engine == "openai" and OPENAI_AVAILABLE:
                # OpenAI TTS implementation would go here
                # This requires API key setup
                pass
            
            return output_file if os.path.exists(output_file) else None
            
        except Exception as e:
            print(f"Error generating audio: {str(e)}")
            return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/available-voices')
def get_available_voices():
    """Get available voice engines and their options"""
    voices = {
        "engines": [],
        "gtts_languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ru", "name": "Russian"},
            {"code": "ja", "name": "Japanese"},
            {"code": "ko", "name": "Korean"},
            {"code": "zh", "name": "Chinese"}
        ]
    }
    
    if GTTS_AVAILABLE:
        voices["engines"].append({
            "id": "gtts",
            "name": "Google Text-to-Speech",
            "description": "High-quality cloud-based TTS",
            "options": ["language", "slow"]
        })
    
    if PYTTSX3_AVAILABLE:
        try:
            import pyttsx3
            engine = pyttsx3.init()
            system_voices = engine.getProperty('voices')
            voice_list = []
            for i, voice in enumerate(system_voices):
                voice_list.append({
                    "id": str(i),
                    "name": voice.name,
                    "language": getattr(voice, 'languages', ['en'])[0] if hasattr(voice, 'languages') else 'en'
                })
            
            voices["engines"].append({
                "id": "pyttsx3",
                "name": "System Text-to-Speech",
                "description": "Local system voices",
                "voices": voice_list,
                "options": ["voice_id", "rate", "volume"]
            })
        except:
            pass
    
    if OPENAI_AVAILABLE:
        voices["engines"].append({
            "id": "openai",
            "name": "OpenAI TTS",
            "description": "Premium AI voices (requires API key)",
            "voices": [
                {"id": "alloy", "name": "Alloy"},
                {"id": "echo", "name": "Echo"},
                {"id": "fable", "name": "Fable"},
                {"id": "onyx", "name": "Onyx"},
                {"id": "nova", "name": "Nova"},
                {"id": "shimmer", "name": "Shimmer"}
            ],
            "options": ["voice_id", "speed"]
        })
    
    return jsonify(voices)

@app.route('/api/search-libgen', methods=['POST'])
def search_libgen():
    """Search for books in Library Genesis"""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        language = data.get('language', 'English')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        s = LibgenSearch()
        title_filters = {"Language": language, "Extension": "pdf"}
        
        # Try exact match first for better results
        results = s.search_title_filtered(title, title_filters, exact_match=True)
        search_type = "exact"
        
        # If no exact matches, try broader search
        if not results:
            results = s.search_title_filtered(title, title_filters, exact_match=False)
            search_type = "broad"
        
        if not results:
            return jsonify({
                "results": [], 
                "message": "No books found. Try a different search term or language.",
                "searchType": "none"
            })
        
        # Rank and format results for frontend
        ranked_results = rank_search_results(title, results)
        formatted_results = []
        for i, book in enumerate(ranked_results[:15]):  # Show top 15 results
            formatted_results.append({
                'title': book.get('Title', 'Unknown'),
                'author': book.get('Author', 'Unknown'),
                'year': book.get('Year', 'Unknown'),
                'pages': book.get('Pages', 'Unknown'),
                'size': book.get('Size', 'Unknown'),
                'extension': book.get('Extension', 'pdf'),
                'language': book.get('Language', 'Unknown'),
                'id': book.get('ID', ''),
                'rank': i + 1,
                'publisher': book.get('Publisher', 'Unknown'),
                'isbn': book.get('Identifier', 'Unknown')
            })
        
        return jsonify({
            "results": formatted_results,
            "total": len(results),
            "showing": len(formatted_results),
            "searchType": search_type,
            "message": f"Found {len(results)} books, showing top {len(formatted_results)} by relevance"
        })
        
    except Exception as e:
        return jsonify({"error": f"Search failed: {str(e)}"}), 500

@app.route('/api/convert', methods=['POST'])
def start_conversion():
    """Start audiobook conversion process"""
    try:
        data = request.get_json()
        conversion_id = str(uuid.uuid4())
        
        # Store conversion parameters
        active_conversions[conversion_id] = {
            'id': conversion_id,
            'title': data.get('title'),
            'language': data.get('language', 'English'),
            'voice_engine': data.get('voice_engine', 'gtts'),
            'voice_settings': data.get('voice_settings', {}),
            'status': 'queued',
            'created_at': datetime.now().isoformat(),
            'progress': 0
        }
        
        # Start conversion in background thread
        thread = threading.Thread(
            target=run_conversion,
            args=(conversion_id, data)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            "conversion_id": conversion_id,
            "status": "started"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def run_conversion(conversion_id, data):
    """Run the conversion process in a background thread"""
    converter = AudiobookConverter(conversion_id, socketio)
    
    try:
        # Update status
        active_conversions[conversion_id]['status'] = 'running'
        
        # Step 1: Download from LibGen
        pdf_path, book_title = converter.download_from_libgen(
            data['title'], 
            data['language']
        )
        
        # Step 2: Extract text
        text_pages = converter.extract_text_from_pdf(pdf_path)
        
        # Step 3: Convert to audio
        audio_files = converter.convert_to_audio(
            text_pages,
            data['voice_engine'],
            data['voice_settings']
        )
        
        # Step 4: Complete
        active_conversions[conversion_id].update({
            'status': 'completed',
            'progress': 100,
            'book_title': book_title,
            'total_pages': len(text_pages),
            'audio_files': audio_files,
            'completed_at': datetime.now().isoformat()
        })
        
        converter.emit_progress("completed", 100, 
                              f"Audiobook conversion complete! {len(audio_files)} audio files generated.")
        
    except Exception as e:
        active_conversions[conversion_id].update({
            'status': 'failed',
            'error': str(e),
            'failed_at': datetime.now().isoformat()
        })
        
        converter.emit_progress("failed", None, f"Conversion failed: {str(e)}")

@app.route('/api/conversion/<conversion_id>')
def get_conversion_status(conversion_id):
    """Get status of a conversion"""
    if conversion_id in active_conversions:
        return jsonify(active_conversions[conversion_id])
    else:
        return jsonify({"error": "Conversion not found"}), 404

@app.route('/api/download/<conversion_id>/<int:page>')
def download_audio_page(conversion_id, page):
    """Download a specific audio page"""
    if conversion_id not in active_conversions:
        return jsonify({"error": "Conversion not found"}), 404
    
    conversion = active_conversions[conversion_id]
    if conversion['status'] != 'completed':
        return jsonify({"error": "Conversion not completed"}), 400
    
    # Find the audio file for the requested page
    audio_files = conversion.get('audio_files', [])
    for audio_file in audio_files:
        if audio_file['page'] == page:
            if os.path.exists(audio_file['file']):
                return send_file(audio_file['file'], as_attachment=True)
    
    return jsonify({"error": "Audio file not found"}), 404

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

@socketio.on('join_conversion')
def handle_join_conversion(data):
    """Join a conversion room for real-time updates"""
    conversion_id = data.get('conversion_id')
    if conversion_id:
        join_room(conversion_id)
        emit('joined', {'conversion_id': conversion_id})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
