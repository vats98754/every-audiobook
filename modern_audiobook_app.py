import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import threading
import queue
from gtts import gTTS
import PyPDF2
import pathlib
from libgen_api import LibgenSearch
import urllib.request
from convert_to_iso import convert
import pygame
import os
import time
from typing import Optional
import json

class ModernAudiobookApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("AudioBook AI - Convert Any Text to Speech")
        self.root.geometry("1200x800")
        self.root.configure(bg="#000000")
        
        # Voice options with different languages and accents
        self.voice_options = {
            "English (US - Female)": "en",
            "English (UK - Male)": "en-gb", 
            "English (AU - Female)": "en-au",
            "French (Female)": "fr",
            "German (Male)": "de",
            "Spanish (Female)": "es",
            "Italian (Male)": "it",
            "Portuguese (Female)": "pt",
            "Russian (Male)": "ru",
            "Japanese (Female)": "ja",
            "Korean (Male)": "ko",
            "Chinese (Female)": "zh"
        }
        
        # Queue for thread communication
        self.message_queue = queue.Queue()
        
        # Audio control variables
        self.is_playing = False
        self.is_paused = False
        self.current_page = 0
        self.total_pages = 0
        self.pdf_reader = None
        self.selected_voice = "en"
        
        pygame.mixer.init()
        
        self.setup_styles()
        self.create_widgets()
        self.root.after(100, self.check_queue)
        
    def setup_styles(self):
        """Setup modern dark theme styles"""
        style = ttk.Style()
        
        # Configure dark theme
        style.theme_create("dark", parent="alt", settings={
            "TLabel": {
                "configure": {"background": "#000000", "foreground": "#ffffff", "font": ("Helvetica", 10)}
            },
            "TFrame": {
                "configure": {"background": "#000000", "borderwidth": 0}
            },
            "TButton": {
                "configure": {
                    "background": "#ffffff",
                    "foreground": "#000000",
                    "borderwidth": 0,
                    "focuscolor": "none",
                    "font": ("Helvetica", 10, "bold"),
                    "padding": [20, 10]
                },
                "map": {
                    "background": [("active", "#e0e0e0"), ("pressed", "#d0d0d0")],
                    "foreground": [("active", "#000000"), ("pressed", "#000000")]
                }
            },
            "TEntry": {
                "configure": {
                    "fieldbackground": "#1a1a1a",
                    "background": "#1a1a1a",
                    "foreground": "#ffffff",
                    "borderwidth": 1,
                    "insertcolor": "#ffffff",
                    "font": ("Helvetica", 11)
                }
            },
            "TCombobox": {
                "configure": {
                    "fieldbackground": "#1a1a1a",
                    "background": "#1a1a1a",
                    "foreground": "#ffffff",
                    "borderwidth": 1,
                    "font": ("Helvetica", 10)
                }
            },
            "TProgressbar": {
                "configure": {
                    "background": "#ffffff",
                    "troughcolor": "#1a1a1a",
                    "borderwidth": 0,
                    "lightcolor": "#ffffff",
                    "darkcolor": "#ffffff"
                }
            }
        })
        
        style.theme_use("dark")
        
    def create_widgets(self):
        """Create the modern UI components"""
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=30, pady=30)
        
        # Header
        self.create_header(main_frame)
        
        # Content area
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True, pady=(30, 0))
        
        # Left panel - Search and controls
        left_panel = ttk.Frame(content_frame)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 15))
        
        self.create_search_section(left_panel)
        self.create_voice_section(left_panel)
        self.create_controls_section(left_panel)
        
        # Right panel - Preview and status
        right_panel = ttk.Frame(content_frame)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(15, 0))
        
        self.create_preview_section(right_panel)
        self.create_status_section(right_panel)
        
    def create_header(self, parent):
        """Create the header section"""
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Title
        title_label = tk.Label(
            header_frame,
            text="AudioBook AI",
            font=("Helvetica", 28, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        title_label.pack(anchor=tk.W)
        
        # Subtitle
        subtitle_label = tk.Label(
            header_frame,
            text="Transform any book or article into an immersive audio experience",
            font=("Helvetica", 12),
            bg="#000000",
            fg="#888888"
        )
        subtitle_label.pack(anchor=tk.W, pady=(5, 0))
        
    def create_search_section(self, parent):
        """Create the search input section"""
        search_frame = ttk.Frame(parent)
        search_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Section title
        search_title = tk.Label(
            search_frame,
            text="Search Library",
            font=("Helvetica", 16, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        search_title.pack(anchor=tk.W, pady=(0, 15))
        
        # Book title input
        title_label = ttk.Label(search_frame, text="Book or Article Title:")
        title_label.pack(anchor=tk.W, pady=(0, 5))
        
        self.title_entry = ttk.Entry(search_frame, font=("Helvetica", 12))
        self.title_entry.pack(fill=tk.X, pady=(0, 15), ipady=8)
        
        # Language input
        lang_label = ttk.Label(search_frame, text="Content Language:")
        lang_label.pack(anchor=tk.W, pady=(0, 5))
        
        self.lang_entry = ttk.Entry(search_frame, font=("Helvetica", 12))
        self.lang_entry.pack(fill=tk.X, pady=(0, 20), ipady=8)
        self.lang_entry.insert(0, "English")
        
        # Search button
        self.search_button = ttk.Button(
            search_frame,
            text="Search & Download",
            command=self.start_search
        )
        self.search_button.pack(fill=tk.X, pady=(0, 10))
        
    def create_voice_section(self, parent):
        """Create the voice selection section"""
        voice_frame = ttk.Frame(parent)
        voice_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Section title
        voice_title = tk.Label(
            voice_frame,
            text="Voice Selection",
            font=("Helvetica", 16, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        voice_title.pack(anchor=tk.W, pady=(0, 15))
        
        # Voice dropdown
        voice_label = ttk.Label(voice_frame, text="Choose Voice:")
        voice_label.pack(anchor=tk.W, pady=(0, 5))
        
        self.voice_var = tk.StringVar(value="English (US - Female)")
        self.voice_combo = ttk.Combobox(
            voice_frame,
            textvariable=self.voice_var,
            values=list(self.voice_options.keys()),
            state="readonly",
            font=("Helvetica", 11)
        )
        self.voice_combo.pack(fill=tk.X, pady=(0, 15), ipady=5)
        self.voice_combo.bind("<<ComboboxSelected>>", self.on_voice_change)
        
    def create_controls_section(self, parent):
        """Create the playback controls section"""
        controls_frame = ttk.Frame(parent)
        controls_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Section title
        controls_title = tk.Label(
            controls_frame,
            text="Playback Controls",
            font=("Helvetica", 16, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        controls_title.pack(anchor=tk.W, pady=(0, 15))
        
        # Control buttons frame
        buttons_frame = ttk.Frame(controls_frame)
        buttons_frame.pack(fill=tk.X)
        
        self.play_button = ttk.Button(
            buttons_frame,
            text="▶ Play",
            command=self.toggle_playback,
            state="disabled"
        )
        self.play_button.pack(side=tk.LEFT, padx=(0, 10))
        
        self.prev_button = ttk.Button(
            buttons_frame,
            text="⏮ Previous",
            command=self.previous_page,
            state="disabled"
        )
        self.prev_button.pack(side=tk.LEFT, padx=(0, 10))
        
        self.next_button = ttk.Button(
            buttons_frame,
            text="Next ⏭",
            command=self.next_page,
            state="disabled"
        )
        self.next_button.pack(side=tk.LEFT)
        
        # Progress section
        progress_frame = ttk.Frame(controls_frame)
        progress_frame.pack(fill=tk.X, pady=(15, 0))
        
        self.progress_label = ttk.Label(progress_frame, text="Page 0 of 0")
        self.progress_label.pack(anchor=tk.W, pady=(0, 5))
        
        self.progress_bar = ttk.Progressbar(
            progress_frame,
            mode='determinate',
            style="TProgressbar"
        )
        self.progress_bar.pack(fill=tk.X, pady=(0, 10))
        
    def create_preview_section(self, parent):
        """Create the text preview section"""
        preview_frame = ttk.Frame(parent)
        preview_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 20))
        
        # Section title
        preview_title = tk.Label(
            preview_frame,
            text="Content Preview",
            font=("Helvetica", 16, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        preview_title.pack(anchor=tk.W, pady=(0, 15))
        
        # Text preview area
        self.preview_text = scrolledtext.ScrolledText(
            preview_frame,
            bg="#1a1a1a",
            fg="#ffffff",
            insertbackground="#ffffff",
            selectbackground="#333333",
            selectforeground="#ffffff",
            font=("Georgia", 11),
            wrap=tk.WORD,
            padx=15,
            pady=15,
            state="disabled"
        )
        self.preview_text.pack(fill=tk.BOTH, expand=True)
        
    def create_status_section(self, parent):
        """Create the status section"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X)
        
        # Section title
        status_title = tk.Label(
            status_frame,
            text="Status",
            font=("Helvetica", 16, "bold"),
            bg="#000000",
            fg="#ffffff"
        )
        status_title.pack(anchor=tk.W, pady=(0, 15))
        
        # Status text
        self.status_text = scrolledtext.ScrolledText(
            status_frame,
            bg="#1a1a1a",
            fg="#00ff00",
            font=("Courier", 10),
            height=8,
            wrap=tk.WORD,
            padx=10,
            pady=10,
            state="disabled"
        )
        self.status_text.pack(fill=tk.X)
        
        self.update_status("Ready to search and convert books to audio...")
        
    def update_status(self, message):
        """Update the status display"""
        self.status_text.config(state="normal")
        self.status_text.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {message}\n")
        self.status_text.config(state="disabled")
        self.status_text.see(tk.END)
        
    def on_voice_change(self, event=None):
        """Handle voice selection change"""
        selected_voice_name = self.voice_var.get()
        self.selected_voice = self.voice_options[selected_voice_name]
        self.update_status(f"Voice changed to: {selected_voice_name}")
        
    def start_search(self):
        """Start the search process in a separate thread"""
        title = self.title_entry.get().strip()
        lang = self.lang_entry.get().strip()
        
        if not title:
            messagebox.showerror("Error", "Please enter a book title")
            return
            
        if not lang:
            lang = "English"
            
        self.search_button.config(state="disabled", text="Searching...")
        self.update_status(f"Searching for: {title} in {lang}")
        
        # Start search in background thread
        search_thread = threading.Thread(
            target=self.search_and_download,
            args=(title, lang),
            daemon=True
        )
        search_thread.start()
        
    def search_and_download(self, title, lang):
        """Search and download the book"""
        try:
            self.message_queue.put(("status", "Connecting to LibGen..."))
            s = LibgenSearch()
            
            title_filters = {"Language": lang, "Extension": "pdf"}
            self.message_queue.put(("status", f"Searching for '{title}'..."))
            titles = s.search_title_filtered(title, title_filters, exact_match=True)
            
            if not titles:
                self.message_queue.put(("error", "No books found with that title"))
                return
                
            item_to_download = titles[0]
            self.message_queue.put(("status", f"Found: {item_to_download.get('Title', 'Unknown')}"))
            
            download_links = s.resolve_download_links(item_to_download)
            pdf_link = download_links['Cloudflare']
            
            self.message_queue.put(("status", "Downloading PDF..."))
            self.download_file(pdf_link, "PDF_Download")
            
            self.message_queue.put(("status", "Processing PDF..."))
            self.load_pdf()
            
            self.message_queue.put(("success", "Book downloaded and ready for playback!"))
            
        except Exception as e:
            self.message_queue.put(("error", f"Error: {str(e)}"))
            
    def download_file(self, download_url, filename):
        """Download file with progress updates"""
        response = urllib.request.urlopen(download_url)
        total_size = int(response.headers.get('Content-Length', 0))
        
        with open(filename + ".pdf", 'wb') as file:
            downloaded = 0
            while True:
                chunk = response.read(8192)
                if not chunk:
                    break
                file.write(chunk)
                downloaded += len(chunk)
                
                if total_size > 0:
                    progress = (downloaded / total_size) * 100
                    self.message_queue.put(("progress", f"Downloaded {progress:.1f}%"))
                    
    def load_pdf(self):
        """Load and process the PDF"""
        try:
            current_dir = str(pathlib.Path().resolve())
            pdf_path = current_dir + "/PDF_Download.pdf"
            
            with open(pdf_path, 'rb') as pdf_file:
                self.pdf_reader = PyPDF2.PdfReader(pdf_file)
                self.total_pages = len(self.pdf_reader.pages)
                self.current_page = 0
                
                # Preview first page
                if self.total_pages > 0:
                    first_page_text = self.pdf_reader.pages[0].extract_text()
                    self.message_queue.put(("preview", first_page_text[:1000] + "..."))
                    
                self.message_queue.put(("loaded", f"PDF loaded: {self.total_pages} pages"))
                
        except Exception as e:
            self.message_queue.put(("error", f"Error loading PDF: {str(e)}"))
            
    def generate_audio(self, page_num):
        """Generate audio for a specific page"""
        try:
            if not self.pdf_reader or page_num >= self.total_pages:
                return False
                
            page_obj = self.pdf_reader.pages[page_num]
            text = page_obj.extract_text()
            
            if not text.strip():
                self.update_status(f"Page {page_num + 1} is empty, skipping...")
                return False
                
            self.update_status(f"Generating audio for page {page_num + 1}...")
            
            # Convert language name to ISO code if needed
            lang_converted = convert(1, self.lang_entry.get()) if self.lang_entry.get() else self.selected_voice
            if not lang_converted:
                lang_converted = self.selected_voice
                
            full_text = f"Page {page_num + 1}. {text}"
            
            tts = gTTS(text=full_text, lang=lang_converted, slow=False)
            audio_file = f"page_{page_num + 1}.mp3"
            tts.save(audio_file)
            
            return audio_file
            
        except Exception as e:
            self.update_status(f"Error generating audio: {str(e)}")
            return False
            
    def play_page(self, page_num):
        """Play audio for a specific page"""
        audio_file = self.generate_audio(page_num)
        if audio_file:
            try:
                pygame.mixer.music.load(audio_file)
                pygame.mixer.music.play()
                self.is_playing = True
                self.is_paused = False
                self.update_controls()
                
                # Update preview with current page text
                if self.pdf_reader:
                    page_text = self.pdf_reader.pages[page_num].extract_text()
                    self.update_preview(page_text)
                    
            except Exception as e:
                self.update_status(f"Error playing audio: {str(e)}")
                
    def toggle_playback(self):
        """Toggle play/pause"""
        if not self.pdf_reader:
            return
            
        if self.is_playing and not self.is_paused:
            pygame.mixer.music.pause()
            self.is_paused = True
            self.play_button.config(text="▶ Resume")
        elif self.is_paused:
            pygame.mixer.music.unpause()
            self.is_paused = False
            self.play_button.config(text="⏸ Pause")
        else:
            self.play_page(self.current_page)
            
    def previous_page(self):
        """Go to previous page"""
        if self.current_page > 0:
            self.current_page -= 1
            self.play_page(self.current_page)
            self.update_progress()
            
    def next_page(self):
        """Go to next page"""
        if self.current_page < self.total_pages - 1:
            self.current_page += 1
            self.play_page(self.current_page)
            self.update_progress()
            
    def update_controls(self):
        """Update control button states"""
        if self.pdf_reader:
            self.play_button.config(state="normal")
            self.prev_button.config(state="normal" if self.current_page > 0 else "disabled")
            self.next_button.config(state="normal" if self.current_page < self.total_pages - 1 else "disabled")
            
        if self.is_playing and not self.is_paused:
            self.play_button.config(text="⏸ Pause")
        else:
            self.play_button.config(text="▶ Play")
            
    def update_progress(self):
        """Update progress display"""
        if self.total_pages > 0:
            progress = (self.current_page / self.total_pages) * 100
            self.progress_bar.config(value=progress)
            self.progress_label.config(text=f"Page {self.current_page + 1} of {self.total_pages}")
            
    def update_preview(self, text):
        """Update the preview text area"""
        self.preview_text.config(state="normal")
        self.preview_text.delete(1.0, tk.END)
        self.preview_text.insert(1.0, text)
        self.preview_text.config(state="disabled")
        
    def check_queue(self):
        """Check for messages from background threads"""
        try:
            while True:
                msg_type, message = self.message_queue.get_nowait()
                
                if msg_type == "status":
                    self.update_status(message)
                elif msg_type == "error":
                    self.update_status(f"ERROR: {message}")
                    self.search_button.config(state="normal", text="Search & Download")
                    messagebox.showerror("Error", message)
                elif msg_type == "success":
                    self.update_status(message)
                    self.search_button.config(state="normal", text="Search & Download")
                    self.update_controls()
                    self.update_progress()
                elif msg_type == "loaded":
                    self.update_status(message)
                elif msg_type == "preview":
                    self.update_preview(message)
                elif msg_type == "progress":
                    self.update_status(message)
                    
        except queue.Empty:
            pass
            
        self.root.after(100, self.check_queue)
        
    def run(self):
        """Start the application"""
        self.root.mainloop()

if __name__ == "__main__":
    app = ModernAudiobookApp()
    app.run()
