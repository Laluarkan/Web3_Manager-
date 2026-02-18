from django.urls import path
from . import views

urlpatterns = [
    path('generate-starter/', views.generate_starter_pack, name='generate-starter'),
    path('my-cards/', views.my_cards, name='my-cards'),
    path('market/', views.get_market_items, name='market-players'),
    path('buy/<int:player_id>/', views.buy_player, name='buy-player'),
    path('toggle-lineup/<int:card_id>/', views.toggle_lineup, name='toggle-lineup'),
    path('sell-card/<int:card_id>/', views.sell_card, name='sell-card'),
    path('buy-market/<int:card_id>/', views.buy_market_item, name='buy-market'),
    path('play-match/', views.play_match, name='play-match'), # Simulasi Cepat
    path('profile/', views.get_profile, name='user-profile'), # Cek Tiket
    path('matches/', views.get_upcoming_matches, name='upcoming-matches'), # Jadwal
    path('predict/<int:match_id>/', views.predict_match, name='predict-match'), # Tebak
    path('claim-rewards/', views.claim_rewards, name='claim-rewards'), # Ambil Tiket
    path('leaderboard/', views.get_leaderboard, name='leaderboard'),
    path('calculate-fantasy/', views.calculate_fantasy, name='calc-fantasy'),
    path('my-predictions/', views.get_my_predictions, name='my-predictions'),
    path('gacha/', views.pull_gacha, name='pull-gacha'),        # Gacha Instan
    path('confirm-mint/', views.confirm_mint, name='confirm-mint'),
    path('restore-card/', views.restore_card, name='restore-card'),
]