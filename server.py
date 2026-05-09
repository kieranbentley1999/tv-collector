from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase import create_client, Client
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Supabase Configuration (Using Environment Variables for Security)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Supabase credentials not found! Please set SUPABASE_URL and SUPABASE_KEY environment variables.")
else:
    print(f"Connecting to Supabase project: {SUPABASE_URL[:20]}...")
    print(f"Key starts with: {SUPABASE_KEY[:10]}...")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    
    user_check = supabase.table("users").select("*").eq("username", username).execute()
    if user_check.data:
        return jsonify({"success": False, "message": "User already exists"}), 400
    
    new_user = {
        "username": username,
        "password": password,
        "inventory": [],
        "coins": 5000,
        "last_claim": 0
    }
    supabase.table("users").insert(new_user).execute()
    return jsonify({"success": True, "message": "Account created!"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user_query = supabase.table("users").select("*").eq("username", username).execute()
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
    
    user_query = supabase.table("users").select("*").eq("username", username).execute()
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
        
    supabase.table("users").update(update_data).eq("username", username).execute()
    return jsonify({"success": True})

@app.route('/api/admin/users', methods=['POST'])
def admin_users():
    data = request.json
    admin_user = data.get('admin_username')
    
    if admin_user != 'kierannb':
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    
    users_query = supabase.table("users").select("*").execute()
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
