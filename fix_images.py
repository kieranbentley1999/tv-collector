import os

def fix_images():
    base_path = r'C:\Users\kiera\.gemini\antigravity\scratch\world_cup_tcg\assets\characters'
    if not os.path.exists(base_path):
        print(f"Error: Path not found {base_path}")
        return

    files = os.listdir(base_path)
    for filename in files:
        old_path = os.path.join(base_path, filename)
        new_filename = filename.lower()
        new_path = os.path.join(base_path, new_filename)
        
        if old_path != new_path:
            try:
                os.rename(old_path, new_path)
                print(f"Renamed: {filename} -> {new_filename}")
            except Exception as e:
                print(f"Failed to rename {filename}: {e}")

    # Also fix the coin icon
    coin_path = r'C:\Users\kiera\.gemini\antigravity\scratch\world_cup_tcg\assets\coin.png'
    if os.path.exists(coin_path):
        # Already lowercase, but good to check
        pass

if __name__ == "__main__":
    fix_images()
