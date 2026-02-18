from django.core.management.base import BaseCommand
from game.models import Match, UserPrediction, GameProfile

class Command(BaseCommand):
    help = 'PAKSA hasil pertandingan untuk testing (Dev Tool)'

    def add_arguments(self, parser):
        parser.add_argument('home_team', type=str, help='Nama Tim Home')
        parser.add_argument('score', type=str, help='Format: HOME_GOAL-AWAY_GOAL (ex: 2-1)')

    def handle(self, *args, **kwargs):
        team_name = kwargs['home_team']
        score_str = kwargs['score']
        
        try:
            h_goal, a_goal = map(int, score_str.split('-'))
            
            # Tentukan FTR (Full Time Result)
            if h_goal > a_goal: ftr = 'H'
            elif h_goal < a_goal: ftr = 'A'
            else: ftr = 'D'

            # Cari Match yang belum selesai
            match = Match.objects.filter(home_team_name__icontains=team_name, is_finished=False).first()
            
            if not match:
                self.stdout.write(self.style.ERROR(f'Match dengan home team "{team_name}" tidak ditemukan / sudah selesai.'))
                return

            # UPDATE MATCH
            match.fthg = h_goal
            match.ftag = a_goal
            match.ftr = ftr
            match.is_finished = True
            match.save()
            
            self.stdout.write(self.style.SUCCESS(f'✅ Match Update: {match.home_team_name} {h_goal}-{a_goal} {match.away_team_name}'))

            # BAGI HADIAH (Sama seperti import_results.py)
            preds = UserPrediction.objects.filter(match=match, reward_claimed=False)
            count = 0
            for p in preds:
                if p.predicted_result == ftr:
                    p.is_correct = True
                    prof, _ = GameProfile.objects.get_or_create(user=p.user)
                    prof.normal_tickets += 1
                    prof.save()
                    count += 1
                p.reward_claimed = True
                p.save()
            
            self.stdout.write(self.style.SUCCESS(f'🎁 Hadiah dibagikan ke {count} user yang benar.'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {e}'))