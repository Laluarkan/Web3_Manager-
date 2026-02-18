import os
import django
import pandas as pd
import requests
import json
import time
import random
import urllib.parse
from bs4 import BeautifulSoup

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings') 
django.setup()

from game.models import Team, Player
from django.db.models import Max

# --- HELPER 1: BING IMAGE SCRAPER (Anti-Blokir Indo) ---
def get_bing_image(query):
    """
    Mencari gambar di Bing Images. 
    Bing lebih ramah ISP Indonesia daripada DuckDuckGo.
    """
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    headers = {'User-Agent': user_agent}
    
    # Tambahkan "face png" agar dapat gambar wajah transparan (usahakan)
    search_query = f"{query} football player face png"
    url = f"https://www.bing.com/images/search?q={urllib.parse.quote(search_query)}&first=1"

    try:
        print(f"   🔍 Bing Search: {query}...", end=" ")
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Bing menyimpan URL gambar asli di dalam atribut 'm' pada class 'iusc'
        # Formatnya JSON string
        img_tags = soup.find_all("a", {"class": "iusc"})
        
        if img_tags:
            # Ambil hasil pertama
            m_attr = img_tags[0].get("m")
            img_data = json.loads(m_attr)
            img_url = img_data.get("murl") # murl = Media URL (Gambar Asli)
            
            print("✅ Dapat!")
            return img_url
        else:
            print("❌ Tidak ketemu (Fallback Avatar).")
            return None

    except Exception as e:
        print(f"⚠️ Error: {e}")
        return None

# --- HELPER 2: AVATAR FALLBACK ---
def get_avatar_image(player_name):
    safe_name = urllib.parse.quote(player_name)
    return f"https://ui-avatars.com/api/?name={safe_name}&background=random&color=fff&size=256&bold=true"

# --- HELPER 3: KONVERSI & RATING ---
def safe_int(value):
    try:
        if pd.isna(value) or value == '': return 0
        return int(float(value)) 
    except: return 0

def calculate_overall(row):
    pos = str(getattr(row, 'Position', 'DF')).upper().strip()
    pac = safe_int(getattr(row, 'Pace', 0))
    sho = safe_int(getattr(row, 'Shooting', 0))
    pas = safe_int(getattr(row, 'Passing', 0))
    dri = safe_int(getattr(row, 'Dribbling', 0))
    def_stat = safe_int(getattr(row, 'Defending', 0))
    phy = safe_int(getattr(row, 'Physicality', 0))

    if pos == 'GK':
        ovr = (def_stat * 0.40) + (phy * 0.40) + (pas * 0.20)
        if ovr == 0: ovr = 75 
    elif pos in ['ST', 'LW', 'RW', 'CF']:
        ovr = (sho * 0.45) + (pac * 0.30) + (dri * 0.25)
    elif pos in ['CAM', 'CM', 'CDM', 'LM', 'RM']:
        ovr = (pas * 0.40) + (dri * 0.30) + (def_stat * 0.15) + (sho * 0.15)
    else: 
        ovr = (def_stat * 0.50) + (phy * 0.35) + (pac * 0.15)
    
    return min(99, int(round(ovr)))

def get_category(pos_raw):
    pos = str(pos_raw).upper().strip()
    if pos == 'GK': return 'GK'
    if pos in ['ST', 'LW', 'RW', 'CF']: return 'FW'
    if pos in ['CAM', 'CM', 'CDM', 'LM', 'RM']: return 'MF'
    return 'DF' 

# --- FUNGSI UTAMA ---
def run_import():
    file_path = 'statistik_2025.csv'
    if not os.path.exists(file_path):
        print("❌ File CSV tidak ditemukan!")
        return

    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip()

    # Filter Liga
    allowed_leagues = [
        'LALIGA EA SPORTS', 'Premier League', 'Liga F', 
        'Bundesliga', 'Serie A Enilive', 'Ligue 1 Uber Eats'
    ]
    if 'League' in df.columns:
        df = df[df['League'].isin(allowed_leagues)]

    print(f"🚀 Memproses {len(df)} pemain...")

    # ID Counter
    max_id = Team.objects.aggregate(Max('api_team_id'))['api_team_id__max'] or 1000
    team_counter = max_id + 1

    for row in df.itertuples(index=True):
        try:
            player_name = getattr(row, 'Name', 'Unknown')
            team_name = getattr(row, 'Team', 'Free Agent')

            # 1. Overall & Team
            overall_rating = calculate_overall(row)
            team_obj = Team.objects.filter(name=team_name).first()
            if not team_obj:
                team_obj = Team.objects.create(
                    name=team_name,
                    league=getattr(row, 'League', 'Unknown'),
                    api_team_id=team_counter,
                    csv_team_name=team_name
                )
                team_counter += 1

            # 2. IMAGE LOGIC (BING -> Fallback AVATAR)
            # Cek dulu di database, kalau sudah ada foto valid (bukan placeholder/avatar), skip search biar cepat
            existing = Player.objects.filter(name=player_name, team=team_obj).first()
            
            final_image_url = None
            
            if existing and existing.image_url and "ui-avatars" not in existing.image_url and "placeholder" not in existing.image_url:
                final_image_url = existing.image_url
                # print(f"   ⏩ {player_name} pakai foto lama.")
            else:
                # Cari Baru di Bing
                bing_url = get_bing_image(f"{player_name} {team_name}")
                if bing_url:
                    final_image_url = bing_url
                    # JEDA WAKTU (PENTING AGAR TIDAK DIBLOKIR BING)
                    time.sleep(random.uniform(0.5, 1.5))
                else:
                    final_image_url = get_avatar_image(player_name)

            # 3. Simpan
            real_id = getattr(row, 'ID', row.Index + 10000)
            Player.objects.update_or_create(
                real_api_id=real_id, 
                defaults={
                    'name': player_name,
                    'team': team_obj,
                    'position': get_category(getattr(row, 'Position', 'DF')),
                    'overall': overall_rating,
                    'image_url': final_image_url
                }
            )

        except Exception as e:
            print(f"❌ Error baris {row.Index}: {e}")
            continue

    print(f"✅ Import Selesai!")

if __name__ == "__main__":
    run_import()