from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import re
from datetime import datetime

# Try to import PDF and DOCX libraries, but don't fail if they're missing
try:
    import PyPDF2
    HAS_PDF = True
except:
    HAS_PDF = False

try:
    import docx
    HAS_DOCX = True
except:
    HAS_DOCX = False

app = Flask(__name__)
CORS(app)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///typing_test.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'doc'}

from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy(app)

with app.app_context():
    db.create_all()
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

class TypingTest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    difficulty = db.Column(db.String(20), default='medium')
    word_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    results = db.relationship('TestResult', backref='test', lazy=True)

class TestResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('typing_test.id'))
    wpm = db.Column(db.Float)
    accuracy = db.Column(db.Float)
    duration = db.Column(db.Integer)
    correct_chars = db.Column(db.Integer)
    wrong_chars = db.Column(db.Integer)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(filepath, filename):
    ext = filename.rsplit('.', 1)[1].lower()
    
    if ext == 'txt':
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    
    elif ext == 'pdf' and HAS_PDF:
        text = ""
        with open(filepath, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page in pdf_reader.pages:
                text += page.extract_text()
        return text
    
    elif ext in ['docx', 'doc'] and HAS_DOCX:
        doc = docx.Document(filepath)
        return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
    
    return ""

def clean_text(text):
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,!?\'"-]', '', text)
    return text.strip()

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        return '', 200
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        raw_text = extract_text_from_file(filepath, filename)
        if not raw_text:
            return jsonify({'error': 'Could not extract text'}), 400
        
        clean_content = clean_text(raw_text)
        word_count = len(clean_content.split())
        difficulty = 'easy' if word_count < 100 else 'medium' if word_count < 300 else 'hard'
        
        test = TypingTest(
            title=f"Test from {filename}",
            content=clean_content,
            difficulty=difficulty,
            word_count=word_count
        )
        db.session.add(test)
        db.session.commit()
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'test_id': test.id,
            'title': test.title,
            'word_count': test.word_count,
            'difficulty': test.difficulty,
            'message': 'File uploaded successfully!'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tests', methods=['GET', 'OPTIONS'])
def get_all_tests():
    if request.method == 'OPTIONS':
        return '', 200
    tests = TypingTest.query.order_by(TypingTest.created_at.desc()).all()
    return jsonify([{
        'id': t.id,
        'title': t.title,
        'word_count': t.word_count,
        'difficulty': t.difficulty,
        'created_at': t.created_at.strftime('%Y-%m-%d %H:%M'),
        'preview': t.content[:100] + '...'
    } for t in tests])

@app.route('/api/test/<int:test_id>', methods=['GET', 'OPTIONS'])
def get_test(test_id):
    if request.method == 'OPTIONS':
        return '', 200
    test = TypingTest.query.get_or_404(test_id)
    return jsonify({
        'id': test.id,
        'title': test.title,
        'content': test.content,
        'word_count': test.word_count,
        'difficulty': test.difficulty
    })

@app.route('/api/test/<int:test_id>/result', methods=['POST', 'OPTIONS'])
def save_result(test_id):
    if request.method == 'OPTIONS':
        return '', 200
    data = request.json
    result = TestResult(
        test_id=test_id,
        wpm=data.get('wpm', 0),
        accuracy=data.get('accuracy', 0),
        duration=data.get('duration', 0),
        correct_chars=data.get('correct_chars', 0),
        wrong_chars=data.get('wrong_chars', 0)
    )
    db.session.add(result)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/test/<int:test_id>/results', methods=['GET', 'OPTIONS'])
def get_results(test_id):
    if request.method == 'OPTIONS':
        return '', 200
    results = TestResult.query.filter_by(test_id=test_id).order_by(TestResult.completed_at.desc()).all()
    return jsonify([{
        'wpm': round(r.wpm, 2),
        'accuracy': round(r.accuracy, 2),
        'duration': r.duration,
        'completed_at': r.completed_at.strftime('%Y-%m-%d %H:%M')
    } for r in results])

@app.route('/api/test/<int:test_id>', methods=['DELETE', 'OPTIONS'])
def delete_test(test_id):
    if request.method == 'OPTIONS':
        return '', 200
    test = TypingTest.query.get_or_404(test_id)
    db.session.delete(test)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/')
def home():
    return jsonify({'message': 'Typing Master API is running!'})

print("🚀 Starting Typing Master Server...")
print("📍 Server will run on: http://localhost:5000")

if __name__ == '__main__':
    app.run(debug=True, port=5000)