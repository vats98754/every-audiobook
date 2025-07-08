# AudioGen - Modern Audiobook Conversion Platform

Transform any text into premium audiobooks with human-like AI voices. A sleek, professional web application inspired by Y Combinator startups.

## Features

- **User Authentication**: Secure email/password registration and login
- **Book Search**: Search millions of books via Open Library and Internet Archive  
- **Book Preview**: View detailed book information, covers, and subjects before adding
- **Personal Collection**: Save books to your library and convert them when ready
- **Multiple Voice Engines**: Google Text-to-Speech, pyttsx3, and OpenAI TTS support
- **Real-time Progress**: Live conversion tracking with WebSocket updates
- **Personal Library**: Each user has their own audiobook collection with management tools
- **Modern UI**: Clean, responsive design with preview modals and success notifications
- **Download & Play**: Stream audiobooks page-by-page or download for offline use

## Quick Start

### Prerequisites

- Python 3.8 or higher
- Virtual environment (recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd every-audiobook
   ```

2. **Set up virtual environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   python app_simple.py
   ```
   
   Or use the startup script:
   ```bash
   ./start.sh
   ```

5. **Open your browser**
   Navigate to `http://localhost:5000`

### Verification

The application will automatically:
- Create the SQLite database (`audiobooks.db`)
- Initialize all required tables (Users, Audiobooks)
- Set up upload and output directories
- Test database connectivity and schema

You should see:
```
🔗 Using local SQLite database: audiobooks.db
✅ Database tables created successfully
✅ Database schema verified: ['users', 'audiobooks']
✅ Database initialized successfully
🚀 Starting AudioGen server...
* Running on http://127.0.0.1:5000
```

## 📖 How to Use

### 1. Create Account
- Visit the homepage and click "Get Started"
- Register with your email and password
- Sign in to access your dashboard

### 2. Search for Books
- Use the search bar to find books by title, author, or topic
- Select your preferred language
- Choose from search results powered by Open Library
- **Preview books** to see detailed information, cover images, and subjects
- **Add books to your collection** to save them for later conversion

### 3. Manage Your Collection
- **Browse your library** in the dashboard to see saved and converted books
- **Preview saved books** and start conversion when ready
- **Configure voice settings** before starting conversion
- **Track conversion progress** in real-time

### 4. Convert & Manage
- Start conversion and watch real-time progress
- Access your personal audiobook library
- Play audiobooks page-by-page or download files

## Architecture

### Backend (Flask)
- **Authentication**: Flask-Login with secure password hashing
- **Database**: SQLAlchemy with SQLite (easily upgradeable to PostgreSQL)
- **Real-time Updates**: Socket.IO for conversion progress
- **Book Search**: Open Library and Internet Archive APIs
- **Audio Generation**: Multiple TTS engine support

### Frontend
- **Modern UI**: Clean, responsive design with Inter font
- **Real-time**: Socket.IO client for live updates  
- **Dashboard**: Personal library management interface
- **Audio Player**: Built-in page-by-page audio player

### Database Schema
- **Users**: Authentication and profile data
- **Audiobooks**: Conversion metadata, progress, and settings


## 🛠️ Technical Stack

- **Backend**: Flask, SQLAlchemy, Flask-Login, Flask-SocketIO
- **Frontend**: Vanilla JavaScript, Socket.IO, Modern CSS
- **TTS Engines**: gTTS, pyttsx3, OpenAI TTS
- **APIs**: Open Library, Internet Archive
- **Database**: SQLite (development), PostgreSQL (production)

## 📁 Project Structure

```
every-audiobook/
├── app_simple.py          # Main Flask application
├── database.py            # Database models and helpers
├── requirements.txt       # Python dependencies
├── start.sh              # Startup script
├── templates/
│   ├── index.html         # Landing page
│   ├── dashboard.html     # User dashboard
│   └── auth/
│       ├── login.html     # Login page
│       └── register.html  # Registration page
├── static/
│   ├── css/style.css      # Main stylesheet
│   ├── js/
│   │   ├── app.js         # Main application JS
│   │   └── dashboard.js   # Dashboard functionality
│   └── favicon.svg        # Site icon
├── instance/              # SQLite database location
├── uploads/               # Temporary PDF storage
└── output/               # Generated audio files
```

## ⚙️ Configuration

### Environment Variables
```bash
export SECRET_KEY="your-secret-key-here"
export DATABASE_URL="sqlite:///audiobooks.db"  # or PostgreSQL URL
export OPENAI_API_KEY="your-openai-key"  # Optional, for OpenAI TTS
```

### Voice Engine Configuration
- **Google TTS**: Automatic, no setup required
- **pyttsx3**: System TTS, works offline
- **OpenAI TTS**: Requires API key, premium quality

## 🔧 Development

### Running in Development Mode
```bash
python app_simple.py
```
The app runs with debug mode enabled on `http://localhost:5000`

### Database Initialization
The database is automatically created and initialized on first run. To reset:
```bash
rm audiobooks.db
python app_simple.py
```

### Environment Variables
```bash
export SECRET_KEY="your-secret-key-here"
export DATABASE_URL="sqlite:///audiobooks.db"  # or PostgreSQL URL
export DB_PATH="audiobooks.db"  # Alternative to DATABASE_URL for local SQLite
export OPENAI_API_KEY="your-openai-key"  # Optional, for OpenAI TTS
```

## 🚀 Deployment

### Production Checklist
1. Set strong `SECRET_KEY` environment variable
2. Use PostgreSQL database for production
3. Configure reverse proxy (nginx recommended)
4. Set up SSL certificates
5. Use production WSGI server (gunicorn)

### Example Production Command
```bash
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
```

## Security Features

- Password hashing with bcrypt
- CSRF protection with Flask-WTF
- Session management with Flask-Login
- User data isolation in database
- Secure file upload handling

## Roadmap

- [ ] Google OAuth integration
- [ ] Bulk audiobook downloads (ZIP)
- [ ] Voice cloning and custom voices
- [ ] Advanced search filters
- [ ] Audio quality settings
- [ ] Mobile app companion
- [ ] API for third-party integrations

## Features

### Book Preview and Collection Management
- **Search Results Enhancement**: Each search result now shows preview and "Add to Collection" buttons
- **Book Preview Modal**: Click "Preview" to see detailed book information, cover image, and subjects
- **Add to Collection**: Save books to your personal library without converting them immediately
- **Convert from Collection**: Start conversion for saved books with custom voice settings
- **Authentication Handling**: Graceful prompts for non-logged-in users trying to save books

### UI/UX Improvements
- **Modern Search Results**: Enhanced layout with action buttons and improved spacing
- **Success Notifications**: Toast-style notifications for successful actions
- **Preview Modal**: Large, responsive modal with book details and cover images
- **Authentication Prompts**: User-friendly signup/login prompts for collection features.

## Acknowledgments

- Open Library for free book search API
- Internet Archive for book hosting
- Google for Text-to-Speech services
- Y Combinator for design inspiration

