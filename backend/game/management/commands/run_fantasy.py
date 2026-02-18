import random
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.models import Sum
from game.models import UserCard, FantasyLeaderboard, GameProfile

class Command(BaseCommand):
    help = 'Hitung Poin Fantasy Mingguan & Bagi Hadiah Premium'

    def handle(self, *args, **kwargs):
        self.stdout.write("⚽ Memulai Perhitungan Fantasy Week 1...")

        # 1. Reset Leaderboard Minggu Ini
        week_number = 1
        FantasyLeaderboard.objects.filter(week_number=week_number).delete()

        users = User.objects.all()
        rank_list = []

        for user in users:
            # Ambil Starting XI User (Pemain yang is_playing=True)
            lineup = UserCard.objects.filter(user=user, is_playing=True)
            
            # Skip jika pemain kurang dari 11 (Tim tidak valid)
            if lineup.count() < 11:
                self.stdout.write(self.style.WARNING(f"   Skipped {user.username}: Pemain kurang ({lineup.count()}/11)"))
                continue

            # --- LOGIKA HITUNG POIN ---
            # Di dunia nyata, ini diambil dari API (Goals, Assist, Clean Sheet).
            # Di sini kita simulasi: Poin = Rating Kartu + Performa Random (-5 s/d +10)
            
            total_score = 0
            for card in lineup:
                # Faktor keberuntungan performa (Form)
                form = random.randint(-2, 5) 
                
                # Bonus jika pemain RARE atau LEGEND
                rarity_bonus = 5 if card.rarity == 'LEGEND' else 2 if card.rarity == 'RARE' else 0
                
                match_point = card.player.overall + form + rarity_bonus
                total_score += match_point

            # Simpan ke Leaderboard
            FantasyLeaderboard.objects.create(
                user=user,
                week_number=week_number,
                total_points=total_score
            )
            
            rank_list.append({'user': user, 'points': total_score})
            # self.stdout.write(f"   User {user.username}: {total_score} Poin")

        # 2. TENTUKAN PEMENANG (TOP 3)
        # Urutkan dari poin tertinggi
        rank_list.sort(key=lambda x: x['points'], reverse=True)
        
        self.stdout.write("\n🏆 --- PEMENANG MINGGU INI --- 🏆")

        top_3 = rank_list[:3] # Ambil 3 Teratas
        
        for i, data in enumerate(top_3):
            winner = data['user']
            points = data['points']
            rank = i + 1
            
            # Beri Hadiah Tiket Premium
            profile, _ = GameProfile.objects.get_or_create(user=winner)
            
            if rank == 1:
                prize = 3 # Juara 1 dapat 3 Tiket Premium
            elif rank == 2:
                prize = 2 # Juara 2 dapat 2 Tiket Premium
            else:
                prize = 1 # Juara 3 dapat 1 Tiket Premium
                
            profile.premium_tickets += prize
            profile.save()
            
            self.stdout.write(self.style.SUCCESS(f"   #{rank} {winner.username} ({points} pts) -> Dapat {prize} 🎟️ Premium"))

        self.stdout.write(self.style.SUCCESS(f"\n✅ Selesai! Leaderboard diperbarui."))