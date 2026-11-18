import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, testPlayerA, testPlayerB] = await ethers.getSigners();
  const baseURI = process.env.METADATA_BASE_URI || "http://localhost:4000/api/metadata/";

  console.log("========================================");
  console.log("Network  :", network.name);
  console.log("Deployer :", deployer.address);
  console.log("========================================");

  // 1. Deploy KansToken (ERC-20)
  const KansToken = await ethers.getContractFactory("KansToken");
  const kansToken = await KansToken.deploy(deployer.address);
  await kansToken.waitForDeployment();
  const kansAddress = await kansToken.getAddress();
  console.log("KansToken deployed to      :", kansAddress);

  // 2. Deploy FootballCardNFT (ERC-721)
  const FootballCardNFT = await ethers.getContractFactory("FootballCardNFT");
  const cardNft = await FootballCardNFT.deploy(deployer.address, deployer.address, baseURI);
  await cardNft.waitForDeployment();
  const nftAddress = await cardNft.getAddress();
  console.log("FootballCardNFT deployed to:", nftAddress);

  // 3. Deploy CardMarketplace (P2P pakai KANS)
  const CardMarketplace = await ethers.getContractFactory("CardMarketplace");
  const marketplace = await CardMarketplace.deploy(
    nftAddress,
    kansAddress,
    deployer.address,
    deployer.address
  );
  await marketplace.waitForDeployment();
  const marketAddress = await marketplace.getAddress();
  console.log("CardMarketplace deployed to:", marketAddress);

  // 4. Deploy CardPackShop (Buka Pack NFT pakai KANS + Burn 50%)
  const CardPackShop = await ethers.getContractFactory("CardPackShop");
  const packShop = await CardPackShop.deploy(
    nftAddress,
    kansAddress,
    deployer.address,
    deployer.address,
    deployer.address
  );
  await packShop.waitForDeployment();
  const packShopAddress = await packShop.getAddress();
  console.log("CardPackShop deployed to   :", packShopAddress);

  // Beri hak MINTER_ROLE kepada CardPackShop agar bisa langsung mencetak NFT saat user buka pack
  const MINTER_ROLE = await cardNft.MINTER_ROLE();
  await (await cardNft.grantRole(MINTER_ROLE, packShopAddress)).wait();
  console.log("Granted MINTER_ROLE on FootballCardNFT to CardPackShop");

  // 5. Khusus Hardhat lokal: bagikan saldo uji coba KANS ke akun test
  if (network.name === "localhost" || network.name === "hardhat") {
    const testAmount = ethers.parseEther("10000");
    await (await kansToken.mint(deployer.address, ethers.parseEther("100000"))).wait();
    if (testPlayerA) {
      await (await kansToken.mint(testPlayerA.address, testAmount)).wait();
      console.log(`Minted 10,000 KANS to testPlayerA (${testPlayerA.address})`);
    }
    if (testPlayerB) {
      await (await kansToken.mint(testPlayerB.address, testAmount)).wait();
      console.log(`Minted 10,000 KANS to testPlayerB (${testPlayerB.address})`);
    }
  }

  // 6. Simpan alamat kontrak ke deployments/<network>.json
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputPath = path.join(deploymentsDir, `${network.name}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        network: network.name,
        chainId: network.config.chainId,
        deployedAt: new Date().toISOString(),
        contracts: {
          KansToken: kansAddress,
          FootballCardNFT: nftAddress,
          CardMarketplace: marketAddress,
          CardPackShop: packShopAddress,
        },
      },
      null,
      2
    )
  );
  console.log(`Deployment info saved to   : ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
