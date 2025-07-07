# AudioGen - Transform Any Text Into Premium Audiobooks

<div align="center">

![AudioGen Logo](static/favicon.svg)

**A sleek, modern web application that converts PDFs and books into high-quality audiobooks using AI voices.**

[Demo](#demo) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [API](#api)

</div>

## 🎯 Overview

AudioGen is a cutting-edge web application designed with the same attention to detail and user experience as Y Combinator startups. Convert any PDF, book, or document into a premium audiobook experience with multiple AI voice options.

### ✨ Key Features

- **🎤 Premium AI Voices**: Choose from Google TTS, system voices, and OpenAI's latest voice models
- **📚 Vast Library Access**: Search and download from millions of books via Library Genesis
- **⚡ Lightning Fast**: Optimized conversion engine processes books in minutes
- **🎨 Beautiful Interface**: Clean, modern design with real-time progress tracking
- **🌐 Multi-language Support**: Support for 10+ languages and accents
- **📱 Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **🔄 Real-time Updates**: WebSocket-powered live progress tracking

## 🚀 Quick Start

### Prerequisites

- Python 3.9 or higher
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd every-audiobook
   ```

2. **Create a virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Open your browser**
   Navigate to `http://localhost:5000`

## 🎯 How It Works

### 1. 🔍 Search for Books
- Enter any book title, author, or topic
- Search across millions of PDFs in Library Genesis
- Select your preferred language

### 2. 🎤 Choose Your Voice
- **Google TTS**: Cloud-based, high-quality voices
- **System TTS**: Local system voices (Windows/macOS)
- **OpenAI TTS**: Premium AI voices (requires API key)

### 3. 🎵 Convert & Listen
- Real-time conversion progress
- Chapter-by-chapter audio generation
- Instant playback and download options

## 🏗️ Architecture

```
AudioGen/
├── app.py                 # Flask application & API routes
├── templates/
│   └── index.html        # Main frontend template
├── static/
│   ├── css/
│   │   └── style.css     # Modern styling
│   ├── js/
│   │   └── app.js        # Frontend JavaScript
│   └── favicon.svg       # App icon
├── uploads/              # Temporary PDF storage
├── output/               # Generated audio files
└── requirements.txt      # Python dependencies
```

### Technology Stack

- **Backend**: Flask + Flask-SocketIO
- **Frontend**: Vanilla JavaScript + Modern CSS
- **Audio Processing**: gTTS, pyttsx3, OpenAI TTS
- **PDF Processing**: PyPDF2
- **Real-time Updates**: WebSockets
- **Book Search**: Library Genesis API

## 🔧 Configuration

### Voice Engines

#### Google Text-to-Speech (gTTS)
- **Pros**: High quality, cloud-based, multiple languages
- **Cons**: Requires internet connection
- **Setup**: Works out of the box

#### System TTS (pyttsx3)
- **Pros**: Offline, fast, uses system voices
- **Cons**: Quality depends on system
- **Setup**: Automatic detection of system voices

#### OpenAI TTS
- **Pros**: Premium quality, human-like voices
- **Cons**: Requires API key and credits
- **Setup**: Add OpenAI API key to environment variables
  ```bash
  export OPENAI_API_KEY="your-api-key-here"
  ```

### Environment Variables

```bash
# Optional: OpenAI API Key for premium voices
OPENAI_API_KEY=your_openai_api_key

# Optional: Custom upload limits
MAX_CONTENT_LENGTH=104857600  # 100MB

# Optional: Custom port
PORT=5000
```

## 📊 API Documentation

### Search Books
```http
POST /api/search-libgen
Content-Type: application/json

{
  "title": "The Great Gatsby",
  "language": "English"
}
```

### Start Conversion
```http
POST /api/convert
Content-Type: application/json

{
  "title": "The Great Gatsby",
  "language": "English",
  "voice_engine": "gtts",
  "voice_settings": {
    "language": "en",
    "slow": false
  }
}
```

### Get Available Voices
```http
GET /api/available-voices
```

### Download Audio Chapter
```http
GET /api/download/{conversion_id}/{page_number}
```

## 🎨 Design Philosophy

AudioGen follows modern design principles inspired by successful Y Combinator startups:

- **Minimalist Interface**: Clean, distraction-free design
- **Progressive Disclosure**: Information revealed as needed
- **Immediate Feedback**: Real-time progress and status updates
- **Mobile-First**: Responsive design that works everywhere
- **Accessibility**: High contrast, keyboard navigation, screen reader support

## 🔮 Roadmap

- [ ] **Batch Processing**: Convert multiple books simultaneously
- [ ] **Voice Cloning**: Train custom voices from samples
- [ ] **Advanced Audio**: Background music, sound effects
- [ ] **Social Features**: Share audiobooks, create playlists
- [ ] **Mobile Apps**: Native iOS and Android applications
- [ ] **API Access**: Developer API for third-party integrations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Library Genesis for providing access to books
- Google, OpenAI, and system TTS providers for voice synthesis
- The open-source community for amazing libraries

---

<div align="center">

**Made with ❤️ for book lovers everywhere**

[⭐ Star this repo](../../stargazers) • [🐛 Report a bug](../../issues) • [💡 Request a feature](../../issues)

</div>

**Description**

This is a GUI-based application built from Tkinter and uses the gTTS and pygame (mixer) libraries in conjunction with the libgen-api library to find almost any book and convert it to an audiobook that you can listen to. 
The GUI itself has the following features:
- pause/play, 
- stop (stops the entire book), 
- next/previous page, 
- volume up/down (this increases/decreases the volume of the audio itself, not of the system on which the audio is being played), 
- an exit button to start listening to another audiobook, 
- a speed up/down button (this is in construction, because I couldn't find a solution online for speeding up an audio file, even with formulae on the sampling rate, in real-time).


**Run Instructions**

Just run the audiobook_gui.py file to start the GUI. The convert_to_iso.py file is a general python dictionary file that I plan to upload to PyPI because it solves
a problem I haven't seen solved elsewhere - it takes a language (e.g. Spanish) and converts it to its ISO-639 equivalent (in four different forms: ISO-639-1,
ISO-639-2T, ISO-639-2B, and ISO-639-3). I scraped an excel sheet from an official source (the code is commented at the top of the aforementioned file) in order
to create dictionaries that store this information. Ultimately, the convert(type, lang) function was used for the text-to-speech constructor (from audiobook_gui.py, line 56, in line 80, for the gTTS constructor).

As for the searchAndSpeak.py file, it is a demo of the core of all the GUI code that allows you to type in the title and language of a book and convert it into
an audiobook of that language. It doesn't have all the additional features that comes with the GUI.


**Motive**

I created this to be able to help the average audiobook consumer, who wants to listen to books because reading them strains their eyes or doing so saves them valuable time, and mainly because **all the paid options for audiobooks (like Audible) are too expensive for what they offer, and their collections are certainly not as big as Libgenisis'.**
In any case, I do want to develop this GUI further to be able to have multiple books you can add in a list that allows you to pick and choose immediately which book you want to listen to, but I just didn't have enough time due to the time limit on the Hackathon. I plan to do implement these changes after the Hackathon finishes.
