// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FootballNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event CardMinted(uint256 indexed tokenId, address owner, uint256 playerId, string rarity);

    constructor() ERC721("W3Manager Card", "W3M") Ownable(msg.sender) {}

    function mintCard(address recipient, string memory tokenURI, uint256 playerId, string memory rarity)
        public
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _mint(recipient, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit CardMinted(tokenId, recipient, playerId, rarity);

        return tokenId;
    }
}