// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {PyrisPact} from "../src/PyrisPact.sol";

/// @notice Deployment script for PyrisPact (B2B Escrow on Arc Chain & Anvil).
contract DeployPact is Script {
    address constant ANVIL_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        address usdcAddress;
        if (block.chainid == 31337) {
            // Deploy mock USDC for local development
            MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
            usdc.mint(deployer, 100_000 * 1e6);
            usdc.mint(ANVIL_1, 50_000 * 1e6);
            usdcAddress = address(usdc);
            console.log("Deployed Mock USDC at:", usdcAddress);
        } else {
            // On Arc Chain: read from environment or use canonical Arc USDC address
            usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
            console.log("Target Arc Chain USDC:", usdcAddress);
        }

        PyrisPact pact = new PyrisPact(usdcAddress);
        console.log("Deployed PyrisPact at:", address(pact));

        vm.stopBroadcast();

        // Write deployment output
        string memory root = "deploy";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "usdc", usdcAddress);
        string memory out = vm.serializeAddress(root, "pyrisPact", address(pact));

        string memory file = block.chainid == 31337 ? "deployments/local.json" : string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, file);
        console.log("Wrote deployment file:", file);
    }
}
