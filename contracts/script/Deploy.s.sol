// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {MockYieldSource} from "../src/MockYieldSource.sol";
import {PillarCore} from "../src/PillarCore.sol";
import {IYieldSource} from "../src/IYieldSource.sol";
import {IPriceOracle} from "../src/IPriceOracle.sol";

/// @notice Local deployment: mocks + oracle + yield source + PillarCore with 6 markets.
///         Writes deployments/<chainId>.json (local.json for Anvil 31337).
/// @dev For Robinhood Chain later: swap the Mock* deployments for the real USDG address,
///      a real oracle adapter and the Mosaic vault adapter — PillarCore is unchanged.
contract Deploy is Script {
    struct MarketCfg {
        string symbol;
        string name;
        uint256 price1e18;
        uint16 maxLtvBps;
        bool open;
    }

    // ~8% APY expressed as per-second fraction, 1e18 scale.
    uint256 constant RATE_8PCT = 2_536_783_358;
    uint256 constant TREASURY = 5_000_000e6;
    address constant ANVIL_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(pk);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        MarketCfg[6] memory cfgs = [
            MarketCfg("AAPL", "Apple", 312.62e18, 4000, true),
            MarketCfg("MSFT", "Microsoft", 491.62e18, 4000, true),
            MarketCfg("NVDA", "Nvidia", 224.62e18, 3500, true),
            MarketCfg("TSLA", "Tesla", 368.16e18, 3000, true),
            MarketCfg("SPY", "S&P 500 ETF", 761.56e18, 5000, true),
            MarketCfg("SLV", "Silver", 61.43e18, 3500, false)
        ];

        vm.startBroadcast(pk);

        MockERC20 usdg = new MockERC20("Global Dollar", "USDG", 6);
        MockOracle oracle = new MockOracle(deployer);
        MockYieldSource ys = new MockYieldSource(deployer, usdg, IPriceOracle(address(oracle)), RATE_8PCT);
        PillarCore core = new PillarCore(deployer, usdg, IPriceOracle(address(oracle)), feeRecipient);

        address[6] memory assets;
        for (uint256 i; i < cfgs.length; ++i) {
            MockERC20 tok = new MockERC20(cfgs[i].name, cfgs[i].symbol, 18);
            assets[i] = address(tok);
            oracle.setPrice(address(tok), cfgs[i].price1e18);
            core.listMarket(address(tok), cfgs[i].maxLtvBps, cfgs[i].maxLtvBps + 1000, 500, 0, IYieldSource(address(ys)));
            if (!cfgs[i].open) core.closeMarket(address(tok));
            tok.mint(deployer, 10_000e18);
            tok.mint(ANVIL_1, 10_000e18);
        }

        usdg.mint(deployer, TREASURY + 100_000e6);
        usdg.approve(address(core), TREASURY);
        core.fundTreasury(TREASURY);
        usdg.mint(ANVIL_1, 10_000e6);

        vm.stopBroadcast();

        // ---- write deployments json
        string memory root = "deploy";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "usdg", address(usdg));
        vm.serializeAddress(root, "oracle", address(oracle));
        vm.serializeAddress(root, "yieldSource", address(ys));
        vm.serializeAddress(root, "pillarCore", address(core));

        string memory mk = "markets";
        string memory marketsJson;
        for (uint256 i; i < cfgs.length; ++i) {
            string memory key = string.concat("m", vm.toString(i));
            vm.serializeString(key, "symbol", cfgs[i].symbol);
            vm.serializeString(key, "name", cfgs[i].name);
            vm.serializeUint(key, "maxLtvBps", cfgs[i].maxLtvBps);
            vm.serializeBool(key, "open", cfgs[i].open);
            string memory obj = vm.serializeAddress(key, "asset", assets[i]);
            marketsJson = vm.serializeString(mk, cfgs[i].symbol, obj);
        }
        string memory out = vm.serializeString(root, "markets", marketsJson);

        string memory file = block.chainid == 31337 ? "deployments/local.json" : string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, file);
        console.log("PillarCore:", address(core));
        console.log("USDG:", address(usdg));
        console.log("wrote", file);
    }
}
