from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DB_FILE = 'users.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(db):
    with open(DB_FILE, 'w') as f:
        json.dump(db, f, indent=4)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/assets/<path:path>')
@app.route('/assets/characters/<path:path>')
@app.route('/<path:path>')
def static_proxy(path):
    # Check if the file exists at the exact path
    if os.path.exists(path) and not os.path.isdir(path):
        return send_from_directory('.', path)
    
    # Fallback: ignore folders and look for just the filename in the root
    filename = os.path.basename(path)
    if os.path.exists(filename) and not os.path.isdir(filename):
        return send_from_directory('.', filename)
    
    # Return index.html for any unknown routes (SPA style)
    return send_from_directory('.', 'index.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_db()
    if username in db:
        return jsonify({"success": False, "message": "User already exists"}), 400
    
    db[username] = {
        "password": password,
        "inventory": [],
        "coins": 5000
    }
    save_db(db)
    return jsonify({"success": True, "message": "Account created!"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = load_db()
    user = db.get(username)
    
    if user and user['password'] == password:
        return jsonify({
            "success": True, 
            "username": username,
            "inventory": user['inventory'],
            "coins": user['coins']
        })
    
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/api/login_auto', methods=['POST'])
def login_auto():
    data = request.json
    username = data.get('username')
    
    db = load_db()
    user = db.get(username)
    
    if user:
        return jsonify({
            "success": True, 
            "username": username,
            "inventory": user['inventory'],
            "coins": user['coins']
        })
    
    return jsonify({"success": False, "message": "Session expired"}), 401

@app.route('/api/save', methods=['POST'])
def save_data():
    data = request.json
    username = data.get('username')
    inventory = data.get('inventory')
    coins = data.get('coins')
    
    db = load_db()
    if username in db:
        db[username]['inventory'] = inventory
        db[username]['coins'] = coins
        save_db(db)
        return jsonify({"success": True})
    
    return jsonify({"success": False, "message": "User not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print("---------------------------------------")
    print("TV COLLECTOR: VAULT SERVER RUNNING")
    print(f"Port: {port}")
    print("---------------------------------------")
    app.run(host='0.0.0.0', port=port)
