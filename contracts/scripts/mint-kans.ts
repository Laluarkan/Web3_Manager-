import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deploymentsPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`File deployment tidak ditemukan di: ${deploymentsPath}. Jalankan deploy terlebih dahulu.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const kansAddress = deploymentData.contracts?.KansToken;

  if (!kansAddress) {
    throw new Error("Alamat KansToken tidak ditemukan di file deployment");
  }

  const KansToken = await ethers.getContractFactory("KansToken");
  const kans = KansToken.attach(kansAddress) as any;

  const targetAddress = process.env.MINT_TARGET || "0x0eE46b93baca82F1ec877BE9650759Ee0813F405";
  const amountStr = process.env.MINT_AMOUNT || "10000";
  const amountWei = ethers.parseEther(amountStr);

  console.log(`Minting ${amountStr} KANS to ${targetAddress} on ${network.name}...`);
  const tx = await kans.mint(targetAddress, amountWei);
  console.log(`Transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log(`Berhasil mencetak ${amountStr} KANS ke ${targetAddress}!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
