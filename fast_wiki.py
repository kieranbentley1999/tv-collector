import re
import json
import urllib.request
import urllib.parse
import time

with open("database.js", "r", encoding="utf-8") as f:
    js_data = f.read()

match = re.search(r"const PLAYERS = (\[.*?\]);", js_data, re.DOTALL)
json_str = match.group(1)
json_str = re.sub(r",\s*\]", "]", json_str)
players = json.loads(json_str)

print("Starting to fetch Wikipedia images...")

count = 0
for player in players:
    if player.get("img") and player["img"] != "null":
        continue
        
    name = player["name"]
    # 1. Search for player
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(name + ' football')}&utf8=&format=json&srlimit=1"
    req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
    
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if data['query']['search']:
                title = data['query']['search'][0]['title']
                
                # 2. Get image
                thumb_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=400"
                req2 = urllib.request.Request(thumb_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req2, timeout=3) as resp2:
                    data2 = json.loads(resp2.read().decode())
                    pages = data2['query']['pages']
                    for pid in pages:
                        if 'thumbnail' in pages[pid]:
                            player["img"] = pages[pid]['thumbnail']['source']
                            count += 1
                            if count % 10 == 0:
                                print(f"Found {count} images...", flush=True)
                            break
    except Exception as e:
        pass

    time.sleep(0.1) # Small delay to avoid Wikipedia rate limits

print(f"Finished fetching {count} Wikipedia images.")

js_content = "const PLAYERS = [\n"
for p in players:
    img_val = f'"{p["img"]}"' if p.get("img") and p["img"] != "null" else 'null'
    js_content += f'    {{ "id": {p["id"]}, "name": "{p["name"]}", "country": "{p["country"]}", "pos": "{p["pos"]}", "ovr": {p["ovr"]}, "img": {img_val} }},\n'
js_content += "];"

with open("database.js", "w", encoding="utf-8") as f:
    f.write(js_content)
