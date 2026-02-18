from rest_framework import serializers
from .models import Team, Player, UserCard, WeeklyLineup, Match, UserPrediction, GameProfile, FantasyLeaderboard

class GameProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameProfile
        fields = ['normal_tickets', 'premium_tickets', 'total_fantasy_points']

class PlayerSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)
    class Meta:
        model = Player
        fields = ['id', 'name', 'position', 'team_name', 'image_url', 'real_api_id', 'overall']

class UserCardSerializer(serializers.ModelSerializer):
    player_details = PlayerSerializer(source='player', read_only=True)
    
    class Meta:
        model = UserCard
        # PASTIKAN 'is_minted' ADA DI SINI:
        fields = ['id', 'user', 'player', 'player_details', 'rarity', 'is_on_sale', 'price', 'is_playing', 'is_minted', 'token_id', 'tx_hash']

class MatchSerializer(serializers.ModelSerializer):
    # Ambil URL logo dari relasi Team
    home_logo = serializers.CharField(source='home_team_id.logo_url', read_only=True)
    away_logo = serializers.CharField(source='away_team_id.logo_url', read_only=True)

    class Meta:
        model = Match
        fields = '__all__' 
        # fields sekarang akan otomatis include 'home_logo' dan 'away_logo'

class PredictionSerializer(serializers.ModelSerializer):
    match_details = MatchSerializer(source='match', read_only=True)
    class Meta:
        model = UserPrediction
        fields = ['id', 'match', 'match_details', 'predicted_result', 'is_correct', 'reward_claimed']

class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = FantasyLeaderboard
        fields = ['username', 'total_points', 'week_number']
        
class WeeklyLineupSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyLineup
        fields = '__all__'