from django.core.management.base import BaseCommand
from game.models import Team

class Command(BaseCommand):
    help = 'Update Logo Tim (Hardcoded URLs)'

    def handle(self, *args, **kwargs):
        # Dictionary Logo (Bisa Anda tambah sendiri nanti)
        LOGOS = {
            # Inggris
            'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
            'Wolves': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg',
            'Liverpool': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
            'Man City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
            'Man United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
            'Chelsea': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
            
            # Spanyol
            'Real Madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
            'Barcelona': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
            'Levante': 'https://upload.wikimedia.org/wikipedia/en/7/7b/Levante_UD.svg',
            'Villarreal': 'https://upload.wikimedia.org/wikipedia/en/7/70/Villarreal_CF_logo.svg',

            # Italia
            'Milan': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
            'Inter': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
            'Juventus': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg',
            'Como': 'https://upload.wikimedia.org/wikipedia/en/e/e8/Como_1907_logo.svg',
        }

        count = 0
        for name, url in LOGOS.items():
            # Update tim jika ditemukan namanya (case insensitive)
            teams = Team.objects.filter(name__iexact=name)
            for team in teams:
                team.logo_url = url
                team.save()
                count += 1
                print(f"✅ Logo updated: {team.name}")

        self.stdout.write(self.style.SUCCESS(f"Selesai! {count} logo diperbarui."))