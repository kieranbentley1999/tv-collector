from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase import create_client, Client
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

import json

# Supabase Configuration (Using Environment Variables for Security)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()

class LocalDatabase:
    def __init__(self, filename='users.json'):
        self.filename = filename
        if not os.path.exists(self.filename):
            with open(self.filename, 'w') as f:
                json.dump({}, f)

    def _read(self):
        try:
            with open(self.filename, 'r') as f:
                return json.load(f)
        except:
            return {}

    def _write(self, data):
        with open(self.filename, 'w') as f:
            json.dump(data, f, indent=4)

    def table(self, name):
        return self

    def select(self, *args):
        return self

    def eq(self, field, value):
        self._filter_field = field
        self._filter_value = value
        return self

    def insert(self, user_data):
        data = self._read()
        # Ensure we don't modify the original dict if possible
        user_to_save = user_data.copy()
        username = user_to_save.pop('username')
        data[username] = user_to_save
        self._write(data)
        return self

    def update(self, update_data):
        self._update_data = update_data
        return self

    def execute(self):
        data = self._read()
        if hasattr(self, '_update_data'):
            if hasattr(self, '_filter_field') and self._filter_field == 'username':
                username = self._filter_value
                if username in data:
                    data[username].update(self._update_data)
                    self._write(data)
                delattr(self, '_filter_field')
                delattr(self, '_filter_value')
            delattr(self, '_update_data')
            return type('obj', (object,), {'data': []})

        if hasattr(self, '_filter_field'):
            result = []
            for username, user_data in data.items():
                if self._filter_field == 'username' and username == self._filter_value:
                    user_info = user_data.copy()
                    user_info['username'] = username
                    result.append(user_info)
            delattr(self, '_filter_field')
            delattr(self, '_filter_value')
            return type('obj', (object,), {'data': result})
        
        # Admin select all
        result = []
        for username, user_data in data.items():
            user_info = user_data.copy()
            user_info['username'] = username
            result.append(user_info)
        return type('obj', (object,), {'data': result})

# Database Selector
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Connected to Supabase")
        db = supabase
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}. Switching to Local Mode.")
        db = LocalDatabase()
else:
    print("Supabase credentials not found. Switching to Local Mode.")
    db = LocalDatabase()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/assets/<path:path>')
@app.route('/assets/characters/<path:path>')
@app.route('/<path:path>')
def static_proxy(path):
    if os.path.exists(path) and not os.path.isdir(path):
        return send_from_directory('.', path)
    filename = os.path.basename(path)
    if os.path.exists(filename) and not os.path.isdir(filename):
        return send_from_directory('.', filename)
    if '.' in path:
        return "File not found", 404
    return send_from_directory('.', 'index.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user_check = db.table("users").select("*").eq("username", username).execute()
    if user_check.data:
        return jsonify({"success": False, "message": "User already exists"}), 400
    
    new_user = {
        "username": username,
        "password": password,
        "inventory": [],
        "coins": 5000,
        "last_claim": 0
    }
    db.table("users").insert(new_user).execute()
    return jsonify({"success": True, "message": "Account created!"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user_query = db.table("users").select("*").eq("username", username).execute()
    if not user_query.data:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401
    
    user = user_query.data[0]
    if user['password'] == password:
        return jsonify({
            "success": True, 
            "username": username,
            "inventory": user['inventory'],
            "coins": user['coins'],
            "last_claim": user.get('last_claim', 0)
        })
    
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/api/login_auto', methods=['POST'])
def login_auto():
    data = request.json
    username = data.get('username')
    
    user_query = db.table("users").select("*").eq("username", username).execute()
    if user_query.data:
        user = user_query.data[0]
        return jsonify({
            "success": True, 
            "username": username,
            "inventory": user['inventory'],
            "coins": user['coins'],
            "last_claim": user.get('last_claim', 0)
        })
    
    return jsonify({"success": False, "message": "Session expired"}), 401

@app.route('/api/save', methods=['POST'])
def save_data():
    data = request.json
    username = data.get('username')
    inventory = data.get('inventory')
    coins = data.get('coins')
    last_claim = data.get('last_claim')
    
    update_data = {
        "inventory": inventory,
        "coins": coins
    }
    if last_claim is not None:
        update_data["last_claim"] = last_claim
        
    db.table("users").update(update_data).eq("username", username).execute()
    return jsonify({"success": True})

@app.route('/api/admin/users', methods=['POST'])
def admin_users():
    data = request.json
    admin_user = data.get('admin_username')
    
    if admin_user != 'kierannb':
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    
    users_query = db.table("users").select("*").execute()
    users_list = []
    for user in users_query.data:
        users_list.append({
            "username": user['username'],
            "coins": user.get('coins', 0),
            "inventory_count": len(user.get('inventory', [])),
            "last_claim": user.get('last_claim', 0)
        })
    
    return jsonify({"success": True, "users": users_list})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

