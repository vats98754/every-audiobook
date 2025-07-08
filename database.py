"""
Simplified Database Architecture for Audiobook App
=================================================

This module provides a clean, minimal database layer with automatic initialization
and easy switching between local/production databases.

Features:
- Auto-initialization of database tables
- Minimal schema with only essential fields
- Easy local/production database switching
- Built-in helper functions for common operations
- Transaction management and error handling
"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import uuid
import json
import os
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize SQLAlchemy
db = SQLAlchemy()

class User(UserMixin, db.Model):
    """User model with minimal required fields"""
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if provided password matches hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary for JSON responses"""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'audiobook_count': len(self.audiobooks)
        }
    
    def __repr__(self):
        return f'<User {self.email}>'


class Audiobook(db.Model):
    """Audiobook model with minimal essential fields"""
    __tablename__ = 'audiobooks'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(300), nullable=False)
    author = db.Column(db.String(200), default='Unknown')
    
    # Source information
    source_type = db.Column(db.String(20), nullable=False, default='upload')  # 'search' or 'upload'
    source_url = db.Column(db.String(500))  # Open Library URL if from search
    
    # Voice settings (stored as JSON string)
    voice_engine = db.Column(db.String(20), nullable=False, default='gtts')
    voice_settings = db.Column(db.Text, default='{}')
    
    # Status and progress
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    progress = db.Column(db.Integer, default=0)  # Percentage (0-100)
    total_pages = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Relationship
    user = db.relationship('User', backref=db.backref('audiobooks', lazy=True, cascade='all, delete-orphan'))
    
    def get_voice_settings(self):
        """Get voice settings as dictionary"""
        try:
            return json.loads(self.voice_settings) if self.voice_settings else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_voice_settings(self, settings_dict):
        """Set voice settings from dictionary"""
        self.voice_settings = json.dumps(settings_dict or {})
    
    def update_progress(self, progress, status=None):
        """Update progress and optionally status"""
        self.progress = max(0, min(100, progress))  # Clamp between 0-100
        if status:
            self.status = status
        if progress >= 100 and status == 'completed':
            self.completed_at = datetime.utcnow()
    
    @property
    def voice_settings_dict(self):
        """Get voice settings as dictionary (backward compatibility)"""
        return self.get_voice_settings()
    
    @voice_settings_dict.setter
    def voice_settings_dict(self, value):
        """Set voice settings from dictionary (backward compatibility)"""
        self.set_voice_settings(value)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        # Handle potential None values safely
        return {
            'id': str(self.id) if self.id else '',
            'title': str(self.title) if self.title else 'Unknown Title',
            'author': str(self.author) if self.author else 'Unknown Author',
            'source_type': str(self.source_type) if hasattr(self, 'source_type') and self.source_type else 'upload',
            'source_url': str(self.source_url) if self.source_url else '',
            'voice_engine': str(self.voice_engine) if self.voice_engine else 'gtts',
            'voice_settings': self.get_voice_settings(),
            'status': str(self.status) if self.status else 'pending',
            'progress': int(self.progress) if self.progress is not None else 0,
            'total_pages': int(self.total_pages) if self.total_pages is not None else 0,
            'error_message': str(self.error_message) if self.error_message else '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'user_id': str(self.user_id) if self.user_id else ''
        }
    
    def __repr__(self):
        return f'<Audiobook {self.title} ({self.status})>'


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_database(app):
    """
    Initialize database with automatic table creation and configuration.
    
    Args:
        app: Flask application instance
    
    Returns:
        bool: True if successful, False otherwise
    """
    # Configure database URI based on environment
    configure_database_uri(app)
    
    # Initialize SQLAlchemy with app
    db.init_app(app)
    
    # Create tables within app context
    with app.app_context():
        try:
            # Create all tables
            db.create_all()
            print("✅ Database tables created successfully")
            
            # Verify tables exist
            verify_database_schema()
            
            # Test database connection
            db.session.execute(db.text('SELECT 1'))
            db.session.commit()
            
            print("✅ Database initialized successfully")
            return True
            
        except Exception as e:
            print(f"❌ Database initialization failed: {e}")
            return False


def configure_database_uri(app):
    """
    Configure database URI based on environment variables and defaults.
    Supports easy switching between local SQLite and production databases.
    """
    # Get database URL from environment (for production)
    database_url = os.getenv('DATABASE_URL')
    
    if database_url:
        # Production database (PostgreSQL, MySQL, etc.)
        if database_url.startswith('postgres://'):
            # Fix for new PostgreSQL URLs
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        print(f"🔗 Using production database")
    else:
        # Local SQLite database
        db_path = os.getenv('DB_PATH', 'audiobooks.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
        print(f"🔗 Using local SQLite database: {db_path}")
    
    # Common configurations
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,  # Verify connections before use
        'pool_recycle': 300,    # Recycle connections every 5 minutes
    }


def verify_database_schema():
    """Verify that all required tables exist"""
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()
    
    required_tables = ['users', 'audiobooks']
    missing_tables = [table for table in required_tables if table not in tables]
    
    if missing_tables:
        raise Exception(f"Missing required tables: {missing_tables}")
    
    print(f"✅ Database schema verified: {tables}")


# ============================================================================
# DATABASE HELPER FUNCTIONS
# ============================================================================

def create_user(email, password, name):
    """
    Create a new user with email and password.
    
    Args:
        email: User's email address
        password: Plain text password (will be hashed)
        name: User's display name
    
    Returns:
        User object if successful, None if email already exists
    """
    try:
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return None
        
        # Create new user
        user = User(email=email, name=name)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        print(f"✅ Created user: {email}")
        return user
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to create user {email}: {e}")
        return None


def authenticate_user(email, password):
    """
    Authenticate user with email and password.
    
    Args:
        email: User's email address
        password: Plain text password
    
    Returns:
        User object if authentication successful, None otherwise
    """
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        return user
    return None


def get_user_audiobooks(user_id, status=None):
    """
    Get all audiobooks for a user, optionally filtered by status.
    
    Args:
        user_id: User ID
        status: Optional status filter ('pending', 'processing', 'completed', 'failed')
    
    Returns:
        List of Audiobook objects
    """
    query = Audiobook.query.filter_by(user_id=user_id)
    
    if status:
        query = query.filter_by(status=status)
    
    return query.order_by(Audiobook.created_at.desc()).all()


def create_audiobook(user_id, title, author=None, voice_engine='gtts', voice_settings=None, 
                    source_type='upload', source_url=None, status='pending'):
    """
    Create a new audiobook entry.
    
    Args:
        user_id: ID of the user creating the audiobook
        title: Title of the audiobook
        author: Author name (optional)
        voice_engine: Voice engine to use
        voice_settings: Dictionary of voice settings (optional)
        source_type: 'search' or 'upload'
        source_url: URL if from search (optional)
        status: Initial status (pending, saved, processing, completed, failed)
    
    Returns:
        Audiobook object if successful, None otherwise
    """
    try:
        audiobook = Audiobook(
            user_id=user_id,
            title=title,
            author=author or 'Unknown',
            voice_engine=voice_engine,
            source_type=source_type,
            source_url=source_url,
            status=status
        )
        
        if voice_settings:
            audiobook.set_voice_settings(voice_settings)
        else:
            audiobook.voice_settings = json.dumps({})
        
        db.session.add(audiobook)
        db.session.commit()
        
        print(f"✅ Created audiobook: {title} for user {user_id}")
        return audiobook
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to create audiobook {title}: {e}")
        return None


def update_audiobook_progress(audiobook_id, status=None, progress=None, total_pages=None, error_message=None):
    """
    Update audiobook progress and status.
    
    Args:
        audiobook_id: Audiobook ID
        status: New status (optional)
        progress: Progress percentage (0-100) (optional)
        total_pages: Total number of pages (optional)
        error_message: Error message if status is 'failed' (optional)
    
    Returns:
        Audiobook object if successful, None otherwise
    """
    try:
        audiobook = Audiobook.query.get(audiobook_id)
        if not audiobook:
            return None
        
        if status:
            audiobook.status = status
            if status == 'processing' and not audiobook.started_at:
                audiobook.started_at = datetime.utcnow()
            elif status == 'completed':
                audiobook.completed_at = datetime.utcnow()
                audiobook.progress = 100
        
        if progress is not None:
            audiobook.progress = max(0, min(100, progress))  # Clamp between 0-100
        
        if total_pages is not None:
            audiobook.total_pages = total_pages
        
        if error_message:
            audiobook.error_message = error_message
        
        db.session.commit()
        return audiobook
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to update audiobook progress {audiobook_id}: {e}")
        return None


def delete_audiobook(audiobook_id, user_id=None):
    """
    Delete an audiobook (with optional user verification).
    
    Args:
        audiobook_id: Audiobook ID
        user_id: Optional user ID for authorization check
    
    Returns:
        True if successful, False otherwise
    """
    try:
        query = Audiobook.query.filter_by(id=audiobook_id)
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        audiobook = query.first()
        if not audiobook:
            return False
        
        db.session.delete(audiobook)
        db.session.commit()
        
        print(f"✅ Deleted audiobook: {audiobook.title}")
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to delete audiobook {audiobook_id}: {e}")
        return False


def get_database_stats():
    """
    Get basic database statistics.
    
    Returns:
        Dictionary with user and audiobook counts
    """
    try:
        user_count = User.query.count()
        audiobook_count = Audiobook.query.count()
        completed_count = Audiobook.query.filter_by(status='completed').count()
        
        return {
            'users': user_count,
            'audiobooks': audiobook_count,
            'completed': completed_count,
            'success_rate': f"{(completed_count/audiobook_count*100):.1f}%" if audiobook_count > 0 else "0%"
        }
    except Exception as e:
        print(f"❌ Failed to get database stats: {e}")
        return {'users': 0, 'audiobooks': 0, 'completed': 0, 'success_rate': '0%'}
