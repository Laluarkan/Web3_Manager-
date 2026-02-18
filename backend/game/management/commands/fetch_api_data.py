import requests
import time
from django.core.management.base import BaseCommand
from game.models import Team, Player
from django.conf import settings

class Command(BaseCommand):
    help = 'Menarik data pemain dari 5 Liga Top Eropa'

    def handle(self, *args, **kwargs):
        # --- KONFIGURASI ---
        api_key = "951f40108f2b070e57e211a849742f09" # Ganti dengan Key RapidAPI Anda
        season = 2025 
        
        # Dictionary ID Liga Top Eropa
        # Format: {ID_API: 'Nama Liga'}
        LEAGUES = {
            39: 'Premier League',  # Inggris
            140: 'La Liga',        # Spanyol
            78: 'Bundesliga',      # Jerman
            135: 'Serie A',        # Italia
            61: 'Ligue 1'          # Prancis
        }

        base_url = "https://api-football-v1.p.rapidapi.com/v3"
        headers = {
            'x-rapidapi-key': api_key,
            'x-rapidapi-host': "api-football-v1.p.rapidapi.com"
        }

        self.stdout.write(self.style.WARNING(f"Memulai proses import untuk {len(LEAGUES)} Liga..."))

        total_players_added = 0
        
        # LOOP 1: Iterasi per Liga
        for league_id, league_name in LEAGUES.items():
            self.stdout.write(self.style.SUCCESS(f"\n--- Memproses {league_name} ---"))
            
            # Ambil Daftar Tim di Liga tersebut
            url_teams = f"{base_url}/teams"
            params_teams = {"league": league_id, "season": season}
            
            try:
                resp = requests.get(url_teams, headers=headers, params=params_teams)
                
                # Cek jika kuota habis / Error
                if resp.status_code != 200:
                    self.stdout.write(self.style.ERROR(f"Gagal mengambil tim {league_name}. Status: {resp.status_code}"))
                    if resp.status_code == 429: # Too Many Requests
                        self.stdout.write(self.style.ERROR("KUOTA API HABIS! Berhenti sekarang."))
                        return
                    continue
                
                teams_data = resp.json().get('response', [])
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error koneksi: {e}"))
                continue

            self.stdout.write(f"Ditemukan {len(teams_data)} tim di {league_name}.")

            # LOOP 2: Iterasi per Tim dalam Liga
            for item in teams_data:
                team_info = item['team']
                
                # 1. Simpan/Update Tim
                team_obj, created = Team.objects.update_or_create(
                    api_team_id=team_info['id'],
                    defaults={
                        'name': team_info['name'],
                        'league': league_name,
                        'league_id': league_id,
                        'logo_url': team_info['logo']
                    }
                )

                # 2. Ambil Squad (Pemain) Tim Tersebut
                # API Endpoint: /players/squads (Lebih hemat request daripada /players)
                url_squad = f"{base_url}/players/squads"
                params_squad = {"team": team_info['id']}
                
                # Jeda 1 detik agar aman
                time.sleep(1) 
                
                resp_squad = requests.get(url_squad, headers=headers, params=params_squad)
                
                if resp_squad.status_code == 200:
                    squad_data = resp_squad.json().get('response', [])
                    if squad_data:
                        players = squad_data[0]['players']
                        
                        for p in players:
                            # Mapping Posisi
                            pos_map = {'Goalkeeper': 'GK', 'Defender': 'DF', 'Midfielder': 'MF', 'Attacker': 'FW'}
                            position_code = pos_map.get(p['position'], 'MF')

                            # Simpan Pemain
                            Player.objects.update_or_create(
                                real_api_id=p['id'],
                                defaults={
                                    'name': p['name'],
                                    'team': team_obj,
                                    'position': position_code,
                                    'image_url': p['photo']
                                }
                            )
                            total_players_added += 1
                        
                        self.stdout.write(f"   + {team_info['name']}: {len(players)} pemain.")
                else:
                    self.stdout.write(self.style.ERROR(f"   Gagal ambil squad {team_info['name']}"))

        self.stdout.write(self.style.SUCCESS(f"\nSELESAI! Total {total_players_added} pemain berhasil diimpor."))