import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("W3 Football Manager Contracts (KANS + NFT + Marketplace)", function () {
  async function deployFixture() {
    const [admin, backendSigner, treasury, playerA, playerB] = await ethers.getSigners();

    const KansToken = await ethers.getContractFactory("KansToken");
    const kansToken = await KansToken.deploy(admin.address);

    const FootballCardNFT = await ethers.getContractFactory("FootballCardNFT");
    const cardNft = await FootballCardNFT.deploy(
      admin.address,
      backendSigner.address,
      "http://localhost:4000/api/metadata/"
    );

    const CardMarketplace = await ethers.getContractFactory("CardMarketplace");
    const marketplace = await CardMarketplace.deploy(
      await cardNft.getAddress(),
      await kansToken.getAddress(),
      treasury.address,
      admin.address
    );

    const CardPackShop = await ethers.getContractFactory("CardPackShop");
    const packShop = await CardPackShop.deploy(
      await cardNft.getAddress(),
      await kansToken.getAddress(),
      treasury.address,
      backendSigner.address,
      admin.address
    );
    const MINTER_ROLE = await cardNft.MINTER_ROLE();
    await cardNft.grantRole(MINTER_ROLE, await packShop.getAddress());

    // Beri saldo KANS ke playerB untuk tes beli di marketplace & buka pack
    await kansToken.mint(playerB.address, ethers.parseEther("5000"));

    return {
      kansToken,
      cardNft,
      marketplace,
      packShop,
      admin,
      backendSigner,
      treasury,
      playerA,
      playerB,
    };
  }

  // Helper membuat 11 kartu starter pack formasi 4-3-3 (1 GK, 4 DF, 3 MF, 3 FW)
  function buildStarterPackCards() {
    // 9 COMMON, 1 RARE, 1 EPIC (simulasi hoki 10%)
    const positions = [0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3];
    return positions.map((pos, idx) => ({
      playerId: 100 + idx,
      position: pos,
      baseOverall: idx === 10 ? 84 : idx === 9 ? 78 : 70,
      rarity: idx === 10 ? 2 : idx === 9 ? 1 : 0, // 0=COMMON, 1=RARE, 2=EPIC
      edition: 0, // BASE
      season: 2026,
    }));
  }

  async function signStarterVoucher(
    signer: any,
    nftAddress: string,
    recipient: string,
    cards: any[],
    nonce: number,
    deadline: number
  ) {
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "W3FootballCardNFT",
      version: "1",
      chainId: network.chainId,
      verifyingContract: nftAddress,
    };

    const types = {
      StarterClaim: [
        { name: "recipient", type: "address" },
        { name: "cards", type: "CardInput[]" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
      CardInput: [
        { name: "playerId", type: "uint32" },
        { name: "position", type: "uint8" },
        { name: "baseOverall", type: "uint8" },
        { name: "rarity", type: "uint8" },
        { name: "edition", type: "uint8" },
        { name: "season", type: "uint16" },
      ],
    };

    const value = { recipient, cards, nonce, deadline };
    return signer.signTypedData(domain, types, value);
  }

  describe("1. KansToken (ERC-20)", function () {
    it("memiliki nama, simbol, dan batas max supply 100 juta KANS", async function () {
      const { kansToken } = await loadFixture(deployFixture);
      expect(await kansToken.name()).to.equal("Kans Token");
      expect(await kansToken.symbol()).to.equal("KANS");
      expect(await kansToken.cap()).to.equal(ethers.parseEther("100000000"));
    });

    it("menolak mint oleh akun tanpa MINTER_ROLE dan menolak melebihi cap", async function () {
      const { kansToken, playerA } = await loadFixture(deployFixture);
      await expect(
        kansToken.connect(playerA).mint(playerA.address, ethers.parseEther("10"))
      ).to.be.reverted;

      await expect(
        kansToken.mint(playerA.address, ethers.parseEther("100000000"))
      ).to.be.reverted;
    });
  });

  describe("2. FootballCardNFT (Starter Pack 11 Kartu & Keamanan EIP-712)", function () {
    it("berhasil klaim 11 kartu Starter Pack 4-3-3 dengan voucher valid dari backend", async function () {
      const { cardNft, backendSigner, playerA } = await loadFixture(deployFixture);
      const cards = buildStarterPackCards();
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = 1;

      const sig = await signStarterVoucher(
        backendSigner,
        await cardNft.getAddress(),
        playerA.address,
        cards,
        nonce,
        deadline
      );

      await expect(cardNft.connect(playerA).claimStarterPack(cards, nonce, deadline, sig))
        .to.emit(cardNft, "StarterPackClaimed");

      expect(await cardNft.balanceOf(playerA.address)).to.equal(11);
      expect(await cardNft.hasClaimedStarter(playerA.address)).to.equal(true);

      const tokens = await cardNft.getTokensOfOwner(playerA.address);
      expect(tokens.length).to.equal(11);

      const epicCard = await cardNft.getCard(tokens[10]);
      expect(epicCard.playerId).to.equal(110);
      expect(epicCard.rarity).to.equal(2); // EPIC
      expect(epicCard.baseOverall).to.equal(84);
      expect(epicCard.level).to.equal(1);
      expect(await cardNft.tokenURI(tokens[0])).to.equal("http://localhost:4000/api/metadata/1");
    });

    it("menolak klaim Starter Pack kedua kali atau dengan tanda tangan palsu", async function () {
      const { cardNft, backendSigner, playerA, playerB } = await loadFixture(deployFixture);
      const cards = buildStarterPackCards();
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Tanda tangan palsu (bukan dari backendSigner)
      const fakeSig = await signStarterVoucher(
        playerA,
        await cardNft.getAddress(),
        playerA.address,
        cards,
        1,
        deadline
      );
      await expect(
        cardNft.connect(playerA).claimStarterPack(cards, 1, deadline, fakeSig)
      ).to.be.revertedWith("Tanda tangan voucher tidak valid");

      // Klaim pertama valid
      const validSig = await signStarterVoucher(
        backendSigner,
        await cardNft.getAddress(),
        playerA.address,
        cards,
        2,
        deadline
      );
      await cardNft.connect(playerA).claimStarterPack(cards, 2, deadline, validSig);

      // Klaim kedua oleh wallet yang sama ditolak
      const secondSig = await signStarterVoucher(
        backendSigner,
        await cardNft.getAddress(),
        playerA.address,
        cards,
        3,
        deadline
      );
      await expect(
        cardNft.connect(playerA).claimStarterPack(cards, 3, deadline, secondSig)
      ).to.be.revertedWith("Starter pack sudah pernah diklaim");

      // Voucher milik playerA tidak bisa dipakai playerB
      await expect(
        cardNft.connect(playerB).claimStarterPack(cards, 3, deadline, secondSig)
      ).to.be.revertedWith("Tanda tangan voucher tidak valid");
    });
  });

  describe("3. CardMarketplace (Jual-Beli NFT Pakai KANS)", function () {
    it("berhasil list, beli kartu pakai KANS, potong fee 2.5% ke treasury, dan pindahkan NFT", async function () {
      const { kansToken, cardNft, marketplace, backendSigner, treasury, playerA, playerB } =
        await loadFixture(deployFixture);

      // PlayerA klaim starter pack (tokenId 1..11)
      const cards = buildStarterPackCards();
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const sig = await signStarterVoucher(
        backendSigner,
        await cardNft.getAddress(),
        playerA.address,
        cards,
        10,
        deadline
      );
      await cardNft.connect(playerA).claimStarterPack(cards, 10, deadline, sig);

      const tokenIdToSell = 11n; // Kartu EPIC milik PlayerA
      const price = ethers.parseEther("400"); // 400 KANS

      // PlayerA approve marketplace & list kartu
      await cardNft.connect(playerA).setApprovalForAll(await marketplace.getAddress(), true);
      await expect(marketplace.connect(playerA).listCard(tokenIdToSell, price))
        .to.emit(marketplace, "CardListed")
        .withArgs(1, playerA.address, tokenIdToSell, price);

      // PlayerB approve KANS & beli kartu
      await kansToken.connect(playerB).approve(await marketplace.getAddress(), price);
      await expect(marketplace.connect(playerB).buyCard(1))
        .to.emit(marketplace, "CardSold")
        .withArgs(1, playerA.address, playerB.address, tokenIdToSell, price, ethers.parseEther("10"));

      // Cek kepemilikan NFT pindah ke PlayerB
      expect(await cardNft.ownerOf(tokenIdToSell)).to.equal(playerB.address);
      expect(await cardNft.balanceOf(playerA.address)).to.equal(10);
      expect(await cardNft.balanceOf(playerB.address)).to.equal(1);

      // Cek distribusi KANS: fee 2.5% (10 KANS) ke treasury, 97.5% (390 KANS) ke PlayerA
      expect(await kansToken.balanceOf(treasury.address)).to.equal(ethers.parseEther("10"));
      expect(await kansToken.balanceOf(playerA.address)).to.equal(ethers.parseEther("390"));
      expect(await kansToken.balanceOf(playerB.address)).to.equal(ethers.parseEther("4600"));
    });

    it("berhasil update harga dan membatalkan listing oleh penjual", async function () {
      const { cardNft, marketplace, admin, playerA } = await loadFixture(deployFixture);

      await cardNft.connect(admin).mintCard(playerA.address, {
        playerId: 999,
        position: 3,
        baseOverall: 91,
        rarity: 3, // LEGENDARY
        edition: 4, // ICONIC
        season: 2026,
      });

      await cardNft.connect(playerA).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(playerA).listCard(1, ethers.parseEther("1000"));

      await expect(marketplace.connect(playerA).updatePrice(1, ethers.parseEther("850")))
        .to.emit(marketplace, "ListingPriceUpdated")
        .withArgs(1, ethers.parseEther("850"));

      await expect(marketplace.connect(playerA).cancelListing(1))
        .to.emit(marketplace, "ListingCanceled")
        .withArgs(1, playerA.address, 1);

      const listing = await marketplace.listings(1);
      expect(listing.active).to.equal(false);
    });
  });

  describe("4. CardPackShop (Buka Pack NFT Pakai KANS + Burn 50%)", function () {
    it("berhasil buka Pack POTW, membakar 50% KANS, mengirim 50% ke treasury, dan mint NFT", async function () {
      const { kansToken, cardNft, packShop, backendSigner, treasury, playerB } =
        await loadFixture(deployFixture);

      const card = {
        playerId: 777,
        position: 3,
        baseOverall: 90,
        rarity: 3, // LEGENDARY
        edition: 1, // POTW
        season: 2026,
      };
      const price = ethers.parseEther("300");
      const nonce = 1001;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const network = await ethers.provider.getNetwork();
      const signature = await backendSigner.signTypedData(
        {
          name: "W3CardPackShop",
          version: "1",
          chainId: network.chainId,
          verifyingContract: await packShop.getAddress(),
        },
        {
          PackOpen: [
            { name: "buyer", type: "address" },
            { name: "card", type: "CardInput" },
            { name: "price", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
          CardInput: [
            { name: "playerId", type: "uint32" },
            { name: "position", type: "uint8" },
            { name: "baseOverall", type: "uint8" },
            { name: "rarity", type: "uint8" },
            { name: "edition", type: "uint8" },
            { name: "season", type: "uint16" },
          ],
        },
        { buyer: playerB.address, card, price, nonce, deadline }
      );

      const supplyBefore = await kansToken.totalSupply();
      await kansToken.connect(playerB).approve(await packShop.getAddress(), price);

      await expect(packShop.connect(playerB).openPack(card, price, nonce, deadline, signature))
        .to.emit(packShop, "PackOpened")
        .withArgs(playerB.address, 1, price, ethers.parseEther("150"), ethers.parseEther("150"));

      // Cek NFT tercetak ke playerB
      expect(await cardNft.ownerOf(1)).to.equal(playerB.address);
      const minted = await cardNft.getCard(1);
      expect(minted.playerId).to.equal(777);
      expect(minted.edition).to.equal(1); // POTW

      // Cek 50% KANS (150) benar-benar dibakar (totalSupply berkurang) & 150 ke treasury
      expect(await kansToken.totalSupply()).to.equal(supplyBefore - ethers.parseEther("150"));
      expect(await kansToken.balanceOf(treasury.address)).to.equal(ethers.parseEther("150"));

      // Replay nonce yang sama ditolak
      await kansToken.connect(playerB).approve(await packShop.getAddress(), price);
      await expect(
        packShop.connect(playerB).openPack(card, price, nonce, deadline, signature)
      ).to.be.revertedWith("Nonce pack sudah digunakan");
    });
  });

  describe("5. CardMarketplace Private Deal (Tawar-Menawar EIP-712 Tanpa Escrow)", function () {
    it("berhasil eksekusi kesepakatan privat jika penjual sudah tanda tangan, meskipun penjual sedang offline", async function () {
      const { kansToken, cardNft, marketplace, packShop, backendSigner, treasury, playerA, playerB } =
        await loadFixture(deployFixture);

      const price = ethers.parseEther("400");
      const nonce = 888999;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Beri NFT #1 ke playerB melalui pembukaan pack POTW
      const card = {
        playerId: 999,
        position: 3, // FW
        baseOverall: 92,
        rarity: 2, // EPIC
        edition: 1, // POTW
        season: 2026,
      };
      const packPrice = ethers.parseEther("300");
      const packNonce = 112233;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const packSig = await backendSigner.signTypedData(
        {
          name: "W3CardPackShop",
          version: "1",
          chainId,
          verifyingContract: await packShop.getAddress(),
        },
        {
          PackOpen: [
            { name: "buyer", type: "address" },
            { name: "card", type: "CardInput" },
            { name: "price", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
          CardInput: [
            { name: "playerId", type: "uint32" },
            { name: "position", type: "uint8" },
            { name: "baseOverall", type: "uint8" },
            { name: "rarity", type: "uint8" },
            { name: "edition", type: "uint8" },
            { name: "season", type: "uint16" },
          ],
        },
        { buyer: playerB.address, card, price: packPrice, nonce: packNonce, deadline }
      );
      await kansToken.connect(playerB).approve(await packShop.getAddress(), packPrice);
      await packShop.connect(playerB).openPack(card, packPrice, packNonce, deadline, packSig);

      expect(await cardNft.ownerOf(1)).to.equal(playerB.address);

      // playerB (penjual) menyetujui CardMarketplace
      await cardNft.connect(playerB).setApprovalForAll(await marketplace.getAddress(), true);

      // Beri saldo KANS ke playerA (pembeli) dan approve marketplace untuk 400 KANS
      await kansToken.mint(playerA.address, ethers.parseEther("1000"));
      await kansToken.connect(playerA).approve(await marketplace.getAddress(), price);

      // playerB (penjual) tanda tangan kesepakatan EIP-712
      const sellerSignature = await playerB.signTypedData(
        {
          name: "W3CardMarketplace",
          version: "1",
          chainId,
          verifyingContract: await marketplace.getAddress(),
        },
        {
          PrivateDeal: [
            { name: "seller", type: "address" },
            { name: "buyer", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "price", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        {
          seller: playerB.address,
          buyer: playerA.address,
          tokenId: 1,
          price,
          nonce,
          deadline,
        }
      );

      // playerA (pembeli) mengeksekusi deal on-chain (playerB tidak perlu aktif/transaksi lagi)
      const sellerBalanceBefore = await kansToken.balanceOf(playerB.address);
      await expect(
        marketplace
          .connect(playerA)
          .executePrivateDeal(1, price, playerB.address, nonce, deadline, sellerSignature)
      )
        .to.emit(marketplace, "PrivateDealExecuted")
        .withArgs(
          playerB.address,
          playerA.address,
          1,
          price,
          ethers.parseEther("10"), // 2.5% fee dari 400 = 10 KANS
          nonce
        );

      // NFT #1 sekarang resmi berpindah ke playerA
      expect(await cardNft.ownerOf(1)).to.equal(playerA.address);

      // Saldo playerB bertambah 390 KANS (400 - 10 fee)
      expect(await kansToken.balanceOf(playerB.address)).to.equal(
        sellerBalanceBefore + ethers.parseEther("390")
      );
    });
  });
});
