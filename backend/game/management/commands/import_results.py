import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from game.models import Match, UserPrediction, GameProfile

class Command(BaseCommand):
    help = 'Update Hasil Pertandingan & Bagi Hadiah Tiket'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Nama file CSV Hasil (misal: E0.csv)')

    def handle(self, *args, **kwargs):
        file_name = kwargs['csv_file']
        file_path = os.path.join(settings.BASE_DIR, file_name)

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'File {file_path} tidak ditemukan!'))
            return

        print(f"🏆 Memproses Hasil dari {file_name}...")

        with open(file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            updated_count = 0

            for row in reader:
                try:
                    date_str = row.get('Date')
                    home = row.get('HomeTeam')
                    away = row.get('AwayTeam')
                    fthg = row.get('FTHG') # Goal Home
                    ftag = row.get('FTAG') # Goal Away
                    ftr = row.get('FTR')   # H/D/A

                    # Pastikan ini baris hasil (ada skornya)
                    if not (fthg and ftag and ftr): continue

                    # Parse Tanggal
                    try:
                        match_date = datetime.strptime(date_str, "%d/%m/%Y").date()
                    except:
                        continue

                    # 1. Cari Match di Database
                    try:
                        match = Match.objects.get(
                            date=match_date, 
                            home_team_name=home, 
                            away_team_name=away
                        )
                    except Match.DoesNotExist:
                        # Jika match tidak ketemu (mungkin lupa import fixture), 
                        # kita skip atau create baru (tapi user ga bisa tebak krn udh lewat)
                        continue 

                    # 2. Cek apakah perlu diupdate (jika belum finish)
                    if not match.is_finished:
                        match.fthg = int(fthg)
                        match.ftag = int(ftag)
                        match.ftr = ftr
                        match.is_finished = True
                        match.save()
                        
                        updated_count += 1
                        
                        # 3. BAGI HADIAH TIKET!
                        self.distribute_prizes(match)

                except Exception as e:
                    print(f"⚠️ Error baris: {e}")

        self.stdout.write(self.style.SUCCESS(f"✅ Selesai! {updated_count} pertandingan diperbarui & hadiah dibagikan."))

    def distribute_prizes(self, match):
        """Cek semua prediksi user untuk match ini"""
        # Cari prediksi yang BELUM diklaim
        predictions = UserPrediction.objects.filter(match=match, reward_claimed=False)
        
        winners = 0
        for pred in predictions:
            # Cek Jawaban (H/D/A)
            if pred.predicted_result == match.ftr:
                pred.is_correct = True
                pred.reward_claimed = True # Tandai sudah diklaim otomatis
                pred.save()

                # Tambah Tiket ke Profile
                profile, _ = GameProfile.objects.get_or_create(user=pred.user)
                profile.normal_tickets += 1
                profile.save()
                winners += 1
            else:
                # Salah tebak, tetap tandai processed
                pred.is_correct = False
                pred.reward_claimed = True
                pred.save()
        
        if winners > 0:
            print(f"   🎉 Match {match.home_team_name} vs {match.away_team_name}: {winners} user menang tiket!")