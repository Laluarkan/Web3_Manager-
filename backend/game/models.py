from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# --- [BARU] PROFIL GAME USER (Untuk Simpan Tiket & Poin) ---
class GameProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='game_profile')
    normal_tickets = models.IntegerField(default=0)   # Tiket dari Prediksi Benar
    premium_tickets = models.IntegerField(default=0)  # Tiket dari Juara Fantasy
    total_fantasy_points = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} (N:{self.normal_tickets} P:{self.premium_tickets})"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        GameProfile.objects.create(user=instance)

# --- 1. Tabel Tim Asli ---
class Team(models.Model):
    name = models.CharField(max_length=100)
    league = models.CharField(max_length=100) 
    league_id = models.IntegerField(default=0) 
    logo_url = models.URLField(blank=True, null=True)
    api_team_id = models.IntegerField(unique=True, default=0) 
    
    # [BARU] Nama tim di CSV sering beda dengan API, kita simpan mappingnya
    csv_team_name = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name

# --- 2. Tabel Pemain Asli ---
class Player(models.Model):
    POSITIONS = (('GK', 'Goalkeeper'), ('DF', 'Defender'), ('MF', 'Midfielder'), ('FW', 'Forward'))
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    position = models.CharField(max_length=2, choices=POSITIONS)
    real_api_id = models.IntegerField(unique=True) 
    image_url = models.URLField(blank=True, null=True) 
    overall = models.IntegerField(default=75)

    def __str__(self):
        return f"{self.name} ({self.position})"

# --- 3. Kartu Milik User ---
class UserCard(models.Model):
    RARITY_CHOICES = (
        ('BASIC', 'Basic'), ('COMMON', 'Common'), 
        ('RARE', 'Rare'), ('LEGEND', 'Legendary'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="cards")
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    rarity = models.CharField(max_length=10, choices=RARITY_CHOICES, default='COMMON')
    
    # [BARU] Field untuk Lazy Minting
    is_minted = models.BooleanField(default=False) # False = Masih di Database, True = Sudah jadi NFT
    token_id = models.IntegerField(null=True, blank=True)
    tx_hash = models.CharField(max_length=100, null=True, blank=True) # Bukti Transaksi Blockchain
    
    is_on_sale = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    is_playing = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        # Logika rarity default
        if not self.pk and self.rarity == 'COMMON': 
            if self.player.overall >= 90: self.rarity = 'LEGEND'
            elif self.player.overall >= 85: self.rarity = 'RARE'
            elif self.player.overall >= 80: self.rarity = 'BASIC'    
        super(UserCard, self).save(*args, **kwargs)

    def __str__(self):
        status = "NFT" if self.is_minted else "DB"
        return f"[{status}] {self.user.username}'s {self.player.name}"

# --- 4. [UPDATE] Jadwal Pertandingan Asli (Sesuai CSV Football-Data) ---
class Match(models.Model):
    # Field CSV standard
    div = models.CharField(max_length=10, null=True, blank=True) # E0, SP1, dll
    date = models.DateField(null=True, blank=True) # Tanggal Match
    
    # Kita pakai CharField untuk nama tim agar mudah import dari CSV
    home_team_name = models.CharField(max_length=100, default="Home") 
    away_team_name = models.CharField(max_length=100, default="Away")
    
    # Relasi Opsional ke Team (jika mau link ke logo)
    home_team_id = models.ForeignKey(Team, related_name='home_matches', on_delete=models.SET_NULL, null=True, blank=True)
    away_team_id = models.ForeignKey(Team, related_name='away_matches', on_delete=models.SET_NULL, null=True, blank=True)
    
    is_finished = models.BooleanField(default=False)
    
    # Skor & Hasil
    fthg = models.IntegerField(null=True, blank=True) # Home Goal
    ftag = models.IntegerField(null=True, blank=True) # Away Goal
    ftr = models.CharField(max_length=1, null=True, blank=True) # 'H', 'D', 'A'

    def __str__(self):
        return f"[{self.date}] {self.home_team_name} vs {self.away_team_name}"

# --- 5. [BARU] Prediksi User ---
class UserPrediction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    match = models.ForeignKey(Match, on_delete=models.CASCADE)
    predicted_result = models.CharField(max_length=1, choices=[('H','Home'), ('D','Draw'), ('A','Away')])
    is_correct = models.BooleanField(default=False)
    reward_claimed = models.BooleanField(default=False)

# --- 6. [BARU] Fantasy Leaderboard Mingguan ---
class FantasyLeaderboard(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    week_number = models.IntegerField()
    total_points = models.IntegerField(default=0)

# --- 7. Skuad Mingguan User (LAMA - Tetap disimpan jika perlu) ---
class WeeklyLineup(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    week_number = models.IntegerField()
    total_points = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    gk = models.ForeignKey(UserCard, related_name='lineup_gk', on_delete=models.CASCADE)
    players = models.ManyToManyField(UserCard, related_name='lineups')