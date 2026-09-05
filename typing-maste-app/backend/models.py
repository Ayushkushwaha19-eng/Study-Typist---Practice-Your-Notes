from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

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