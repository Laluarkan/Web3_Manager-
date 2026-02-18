import csv
import os
import time
import random
import requests
import json
import urllib.parse
from datetime import datetime
from bs4 import BeautifulSoup

from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Max
from game.models import Team, Match

# --- HELPER: BING IMAGE SEARCH (Khusus Logo) ---
def get_bing_logo(team_name):
    """
    Mencari logo klub di Bing Images.
    Query: 'Arsenal football club logo transparent'
    """
    # User agent agar tidak dianggap bot
    headers = {
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    # Tambahkan keyword spesifik agar dapat logo bagus (PNG/Transparent)
    search_query = f"{team_name} football club logo transparent"
    url = f"https://www.bing.com/images/search?q={urllib.parse.quote(search_query)}&first=1"

    try:
        print(f"   🔍 Cari Logo: {team_name}...", end=" ")
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Bing menyimpan data gambar di atribut 'm' pada tag 'a.iusc'
        img_tags = soup.find_all("a", {"class": "iusc"})
        
        if img_tags:
            m_attr = img_tags[0].get("m")
            img_data = json.loads(m_attr)
            img_url = img_data.get("murl") # URL Gambar Asli
            print("✅ Dapat!")
            return img_url
        else:
            print("❌ Tidak ketemu.")
            return None

    except Exception as e:
        print(f"⚠️ Error search: {e}")
        return None

def get_avatar_logo(team_name):
    # Fallback jika logo tidak ketemu: Pakai inisial kotak
    safe_name = urllib.parse.quote(team_name)
    return f"https://ui-avatars.com/api/?name={safe_name}&background=random&color=fff&size=256&bold=true&length=2"

# --- MAIN COMMAND ---
class Command(BaseCommand):
    help = 'Import Jadwal + Auto Cari Logo Tim'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Nama file CSV Fixtures')

    def handle(self, *args, **kwargs):
        file_name = kwargs['csv_file']
        file_path = os.path.join(settings.BASE_DIR, file_name)

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'File {file_path} tidak ditemukan!'))
            return

        # 1. DAFTAR LIGA YANG DIIZINKAN
        LEAGUE_MAP = {
            'E0': 'Premier League', 
            'SP1': 'La Liga', 
            'I1': 'Serie A',
            'D1': 'Bundesliga', 
            'F1': 'Ligue 1',
        }

        print(f"📂 Membaca Jadwal dari {file_name}...")
        
        # Counter ID Unik
        max_id = Team.objects.aggregate(Max('api_team_id'))['api_team_id__max'] or 2000
        current_id_counter = max_id + 1

        with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            reader.fieldnames = [name.strip() for name in reader.fieldnames]

            count = 0
            
            for row in reader:
                try:
                    div = row.get('Div')
                    if div not in LEAGUE_MAP: continue 

                    date_str = row.get('Date')
                    home = row.get('HomeTeam')
                    away = row.get('AwayTeam')

                    if not (date_str and home and away): continue

                    # Parse Tanggal
                    try:
                        match_date = datetime.strptime(date_str, "%d/%m/%Y").date()
                    except ValueError:
                        try:
                            match_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                        except:
                            continue

                    league_name = LEAGUE_MAP[div]

                    # --- FUNGSI UPDATE TIM & LOGO ---
                    def get_or_create_team_with_logo(t_name):
                        nonlocal current_id_counter
                        
                        # 1. Cek / Buat Tim
                        team_obj = Team.objects.filter(name=t_name).first()
                        if not team_obj:
                            team_obj = Team.objects.create(
                                name=t_name,
                                league=league_name,
                                csv_team_name=t_name,
                                api_team_id=current_id_counter
                            )
                            current_id_counter += 1
                        
                        # 2. Cek Logo (Jika kosong, cari di Bing)
                        if not team_obj.logo_url:
                            logo_url = get_bing_logo(t_name)
                            
                            if logo_url:
                                team_obj.logo_url = logo_url
                                # Jeda agar tidak diblokir Bing
                                time.sleep(random.uniform(1.0, 2.0))
                            else:
                                team_obj.logo_url = get_avatar_logo(t_name)
                            
                            team_obj.save()
                        
                        return team_obj

                    # Proses Home & Away
                    home_team = get_or_create_team_with_logo(home)
                    away_team = get_or_create_team_with_logo(away)

                    # --- SIMPAN MATCH ---
                    match, created = Match.objects.get_or_create(
                        date=match_date,
                        home_team_name=home,
                        away_team_name=away,
                        defaults={
                            'div': div,
                            'is_finished': False,
                            'home_team_id': home_team,
                            'away_team_id': away_team
                        }
                    )

                    if created:
                        count += 1
                        # print(f"   [+] Jadwal: {home} vs {away}")

                except Exception as e:
                    print(f"❌ Error baris {row.get('HomeTeam', 'Unknown')}: {e}")

        self.stdout.write(self.style.SUCCESS(f"✅ Selesai! Ditambahkan: {count} jadwal baru."))