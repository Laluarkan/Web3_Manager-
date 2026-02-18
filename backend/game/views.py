from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Player, UserCard, Match, UserPrediction, GameProfile, FantasyLeaderboard
from .serializers import PlayerSerializer, UserCardSerializer, MatchSerializer, GameProfileSerializer, LeaderboardSerializer
import random
from datetime import date
from django.shortcuts import get_object_or_404

# --- Helper ---
def get_user_from_wallet(request):
    wallet_address = request.headers.get('X-Wallet-Address')
    if not wallet_address: return None
    user, created = User.objects.get_or_create(username=wallet_address)
    return user

# ==========================================
# 1. LOGIKA STARTER PACK (MODIFIED)
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def generate_starter_pack(request):
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)

    if UserCard.objects.filter(user=user).exists():
        return Response({"message": "Anda sudah mengambil Starter Pack!"}, status=400)

    formation = {'GK': 1, 'DF': 4, 'MF': 4, 'FW': 2}
    
    # POOL RARITY KHUSUS STARTER (NO LEGEND)
    # Peluang: Basic (50%), Common (40%), Rare (10%)
    starter_pool = ['BASIC']*5 + ['COMMON']*4 + ['RARE']*1

    for position, count in formation.items():
        available_players = list(Player.objects.filter(position=position))
        safe_count = min(len(available_players), count)
        selected_players = random.sample(available_players, safe_count)

        for player in selected_players:
            # Pakai rarity acak dari pool starter, bukan dari rating asli
            assigned_rarity = random.choice(starter_pool)
            
            UserCard.objects.create(
                user=user,
                player=player,
                rarity=assigned_rarity, 
                is_on_sale=False,
                is_playing=False
            )

    return Response({"message": "Starter Pack Berhasil! (Tanpa Legend)"})

# ==========================================
# 2. FITUR LAMA (MARKET, LINEUP, SIMULASI)
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def get_all_players(request):
    user = get_user_from_wallet(request)
    all_players = Player.objects.all()
    if user:
        owned_player_ids = UserCard.objects.filter(user=user).values_list('player_id', flat=True)
        all_players = all_players.exclude(id__in=owned_player_ids)
    serializer = PlayerSerializer(all_players, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def my_cards(request):
    user = get_user_from_wallet(request)
    if not user: return Response([])
    cards = UserCard.objects.filter(user=user)
    serializer = UserCardSerializer(cards, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def buy_player(request, player_id):
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)
    try:
        player_obj = Player.objects.get(id=player_id)
        if UserCard.objects.filter(user=user, player=player_obj).exists():
             return Response({"message": "Anda sudah memiliki pemain ini!"}, status=400)
        
        # Beli manual rarity-nya sesuai rating asli (logic lama)
        UserCard.objects.create(user=user, player=player_obj, is_on_sale=False)
        return Response({"message": f"Berhasil membeli {player_obj.name}!"})
    except Player.DoesNotExist:
        return Response({"message": "Pemain tidak ditemukan"}, status=404)

@api_view(['POST'])
@permission_classes([AllowAny])
def toggle_lineup(request, card_id):
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)
    try:
        card = UserCard.objects.get(id=card_id, user=user)
        if not card.is_playing:
            current_lineup = UserCard.objects.filter(user=user, is_playing=True).count()
            if current_lineup >= 11: return Response({"error": "Lineup Penuh (Max 11)!"}, status=400)
            if card.player.position == 'GK':
                has_gk = UserCard.objects.filter(user=user, is_playing=True, player__position='GK').exists()
                if has_gk: return Response({"error": "Hanya boleh 1 Kiper!"}, status=400)
        card.is_playing = not card.is_playing
        card.save()
        return Response({"message": "Sukses ubah posisi", "success": True})
    except UserCard.DoesNotExist:
        return Response({"error": "Kartu tidak ditemukan"}, status=404)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_market_items(request):
    user = get_user_from_wallet(request)
    market_cards = UserCard.objects.filter(is_on_sale=True)
    if user: market_cards = market_cards.exclude(user=user)
    return Response(UserCardSerializer(market_cards, many=True).data)

@api_view(['POST'])
@permission_classes([AllowAny])
def sell_card(request, card_id):
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)
    try:
        price = request.data.get('price')
        if not price: return Response({"error": "Harga tidak valid!"}, status=400)
        card = UserCard.objects.get(id=card_id, user=user)
        if card.is_playing: return Response({"error": "Pemain sedang main!"}, status=400)
        card.is_on_sale = True
        card.price = price
        card.save()
        return Response({"message": f"Berhasil menjual {card.player.name}!"})
    except UserCard.DoesNotExist:
        return Response({"error": "Kartu tidak ditemukan"}, status=404)

@api_view(['POST'])
@permission_classes([AllowAny])
def buy_market_item(request, card_id):
    buyer = get_user_from_wallet(request)
    if not buyer: return Response({"error": "Wallet not connected"}, status=401)
    try:
        card = UserCard.objects.get(id=card_id, is_on_sale=True)
        if card.user == buyer: return Response({"error": "Ini kartu Anda sendiri!"}, status=400)
        old_owner = card.user
        card.user = buyer
        card.is_on_sale = False
        card.price = 0
        card.is_playing = False
        card.save()
        return Response({"message": f"Sukses membeli {card.player.name} dari {old_owner.username}!"})
    except UserCard.DoesNotExist:
        return Response({"error": "Kartu tidak ditemukan"}, status=404)

@api_view(['POST'])
@permission_classes([AllowAny])
def play_match(request):
    # SIMULASI CEPAT (Logic Lama)
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)
    lineup = UserCard.objects.filter(user=user, is_playing=True)
    if lineup.count() != 11: return Response({"error": "Starting XI harus 11 pemain!"}, status=400)
    
    my_rating = sum([c.player.overall for c in lineup]) // 11
    opponents = ["Garuda FC", "Mataram United", "Lombok Warriors"]
    opp_name = random.choice(opponents)
    opp_rating = random.randint(70, 90)
    
    my_score = random.randint(0, 3) + (1 if my_rating > opp_rating else 0)
    opp_score = random.randint(0, 3)
    
    result_msg = "MENANG! 🎉" if my_score > opp_score else "KALAH! 💀" if my_score < opp_score else "SERI! 🤝"
    return Response({"opponent": opp_name, "opp_rating": opp_rating, "my_rating": my_rating, "score": f"{my_score} - {opp_score}", "result": result_msg})

# ==========================================
# 3. [BARU] FITUR PREDIKSI & JADWAL NYATA
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def get_upcoming_matches(request):
    # Tampilkan match yang belum selesai
    matches = Match.objects.filter(is_finished=False).order_by('date')[:20]
    return Response(MatchSerializer(matches, many=True).data)

@api_view(['POST'])
@permission_classes([AllowAny])
def predict_match(request, match_id):
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet!"}, status=401)
    try:
        match = Match.objects.get(id=match_id)
        if match.is_finished: return Response({"error": "Match selesai!"}, status=400)
        
        pred = request.data.get('prediction') # 'H', 'D', 'A'
        if pred not in ['H', 'D', 'A']: return Response({"error": "Invalid Prediksi"}, 400)
        
        UserPrediction.objects.update_or_create(user=user, match=match, defaults={'predicted_result': pred})
        return Response({"message": "Prediksi tersimpan!"})
    except Match.DoesNotExist:
        return Response({"error": "Match 404"}, 404)

@api_view(['POST'])
@permission_classes([AllowAny])
def claim_rewards(request):
    # Cek prediksi benar -> Kasih Tiket Normal
    user = get_user_from_wallet(request)
    profile, _ = GameProfile.objects.get_or_create(user=user)
    
    # Ambil prediksi yang benar & match sudah selesai & belum diklaim
    corrects = UserPrediction.objects.filter(user=user, match__is_finished=True, reward_claimed=False)
    
    earned = 0
    for p in corrects:
        if p.predicted_result == p.match.ftr: # Cek jawaban
            p.is_correct = True
            earned += 1
        p.reward_claimed = True
        p.save()
        
    if earned > 0:
        profile.normal_tickets += earned
        profile.save()
        return Response({"message": f"Benar {earned}x! Dapat {earned} Tiket Normal.", "tickets": earned})
    
    return Response({"message": "Belum ada hadiah baru."})

@api_view(['GET'])
@permission_classes([AllowAny])
def get_my_predictions(request):
    user = get_user_from_wallet(request)
    if not user: return Response({})
    
    # Ambil semua prediksi user ini
    preds = UserPrediction.objects.filter(user=user)
    
    # Kita format jadi Dictionary simpel: { match_id: 'H', match_id: 'A', ... }
    # Contoh output: { 1: 'H', 2: 'D', 5: 'A' }
    data = {p.match.id: p.predicted_result for p in preds}
    
    return Response(data)
# ==========================================
# 4. [BARU] FANTASY & LEADERBOARD
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def calculate_fantasy(request):
    # Simulasi perhitungan poin (biasanya dijalankan admin/cronjob)
    users = User.objects.all()
    week = 1 
    FantasyLeaderboard.objects.filter(week_number=week).delete() # Reset week ini
    
    rank_list = []
    for u in users:
        lineup = UserCard.objects.filter(user=u, is_playing=True)
        if lineup.count() < 11: continue
        
        # Simulasi: Poin = Overall + Random performa match hari ini
        points = sum([c.player.overall + random.randint(-2, 3) for c in lineup])
        
        FantasyLeaderboard.objects.create(user=u, week_number=week, total_points=points)
        rank_list.append((u, points))
    
    # Beri Tiket Premium ke Top 3
    rank_list.sort(key=lambda x: x[1], reverse=True)
    for i, (winner, pts) in enumerate(rank_list[:3]):
        prof, _ = GameProfile.objects.get_or_create(user=winner)
        prof.premium_tickets += 1
        prof.save()
        
    return Response({"message": "Fantasy Points Updated! Top 3 got Premium Tickets."})

@api_view(['GET'])
@permission_classes([AllowAny])
def get_leaderboard(request):
    data = FantasyLeaderboard.objects.filter(week_number=1).order_by('-total_points')[:10]
    return Response(LeaderboardSerializer(data, many=True).data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_profile(request):
    user = get_user_from_wallet(request)
    if not user: return Response({})
    profile, _ = GameProfile.objects.get_or_create(user=user)
    return Response(GameProfileSerializer(profile).data)

# ==========================================
# 5. [MODIFIED] GACHA SYSTEM (WEB3 INTEGRATION)
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def pull_gacha(request):
    """
    GACHA INSTAN (WEB2):
    User langsung dapat kartu di database tanpa bayar gas fee.
    Status kartu: is_minted = False.
    """
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet not connected"}, status=401)

    profile, _ = GameProfile.objects.get_or_create(user=user)
    gacha_type = request.data.get('type') 
    
    # 1. Cek & Kurangi Tiket
    if gacha_type == 'PREMIUM':
        if profile.premium_tickets < 1: return Response({"error": "Tiket Premium Habis!"}, 400)
        profile.premium_tickets -= 1
        pool = ['LEGEND']*30 + ['RARE']*50 + ['COMMON']*20
    else:
        if profile.normal_tickets < 1: return Response({"error": "Tiket Normal Habis!"}, 400)
        profile.normal_tickets -= 1
        pool = ['LEGEND']*1 + ['RARE']*10 + ['COMMON']*50 + ['BASIC']*39
        
    profile.save()

    # 2. Random Player
    rarity = random.choice(pool)
    player = Player.objects.order_by('?').first()

    # 3. Simpan ke DB (Status: Belum Minting)
    new_card = UserCard.objects.create(
        user=user,
        player=player,
        rarity=rarity,
        is_minted=False, # <--- Masih Database biasa
        is_playing=False
    )
    
    return Response({
        "message": f"Dapat {player.name} ({rarity})!",
        "card": UserCardSerializer(new_card).data,
        "new_tickets": {
            "normal": profile.normal_tickets, 
            "premium": profile.premium_tickets
        }
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_mint(request):
    """
    Dipanggil setelah user MANUAL melakukan minting di Frontend.
    Mengubah status kartu dari Database -> NFT.
    """
    user = get_user_from_wallet(request)
    if not user: return Response({"error": "Wallet!"}, status=401)

    card_id = request.data.get('card_id')
    tx_hash = request.data.get('tx_hash')
    # token_id bisa dikirim dari frontend jika berhasil diparsing, atau kosongkan dulu
    token_id = request.data.get('token_id', 0) 

    card = get_object_or_404(UserCard, id=card_id, user=user)
    
    if card.is_minted:
        return Response({"error": "Kartu ini sudah jadi NFT!"}, 400)

    card.is_minted = True
    card.tx_hash = tx_hash
    card.token_id = token_id
    card.save()

    return Response({"message": "Berhasil diubah menjadi NFT!"})

@api_view(['POST'])
@permission_classes([AllowAny])
def restore_card(request):
    try:
        user = get_user_from_wallet(request)
        if not user: return Response({"error": "Wallet not connected"}, status=401)

        player_id = request.data.get('player_id')
        rarity = request.data.get('rarity')
        token_id = request.data.get('token_id')

        # 1. Cari Pemain (Handle jika ID berubah karena reset DB)
        try:
            player = Player.objects.get(id=player_id)
        except (Player.DoesNotExist, ValueError):
            # Fallback: Jika ID tidak ketemu, kita coba cari berdasarkan metadata lain kalau ada, 
            # atau abaikan saja untuk mencegah Error 500.
            return Response({"message": f"Skip: Player ID {player_id} tidak ditemukan di DB baru."}, status=200)

        # 2. LOGIKA PINTAR: Cek apakah user SUDAH punya kartu ini tapi statusnya masih Off-Chain?
        # Kita cari kartu milik user, dengan pemain yang sama, rarity sama, dan BELUM minting.
        existing_card = UserCard.objects.filter(
            user=user, 
            player=player, 
            rarity=rarity, 
            is_minted=False
        ).first()

        if existing_card:
            # UPDATE KARTU YANG ADA (JANGAN BUAT BARU)
            existing_card.is_minted = True
            existing_card.token_id = token_id
            existing_card.save()
            return Response({"message": f"Berhasil update status {player.name} jadi NFT!"})

        # 3. Jika benar-benar belum punya, baru buat kartu baru (Restore murni)
        # Cek dulu agar tidak duplikat token_id
        if UserCard.objects.filter(token_id=token_id).exists():
             return Response({"message": "Kartu dengan Token ID ini sudah ada."})

        UserCard.objects.create(
            user=user,
            player=player,
            rarity=rarity,
            is_minted=True,
            token_id=token_id,
            is_playing=False,
            is_on_sale=False
        )
        
        return Response({"message": f"Kartu {player.name} berhasil dipulihkan ke Squad!"})

    except Exception as e:
        # Tangkap semua error agar tidak jadi Error 500 di frontend
        print(f"ERROR RESTORE: {str(e)}")
        return Response({"error": str(e)}, status=400)