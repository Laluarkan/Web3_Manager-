const hre = require("hardhat");

async function main() {
  // Ambil pabrik kontrak
  const FootballNFT = await hre.ethers.getContractFactory("FootballNFT");
  
  // Deploy kontrak
  const nft = await FootballNFT.deploy();

  // Tunggu sampai selesai
  await nft.waitForDeployment();

  console.log("FootballNFT deployed to:", await nft.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});