from app import app, db

print("🗄️ Setting up database...")

with app.app_context():
    print("📋 Creating all tables...")
    db.create_all()
    print("✅ Tables created successfully!")
    print("📊 Tables available:")
    print("   - typing_test (stores your uploaded notes)")
    print("   - test_result (stores your typing results)")
    
print("🎉 Database setup complete!")
print("💡 You can now run: python app.py")