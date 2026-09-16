// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {PyrisCore} from "../src/PyrisCore.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {ERC4626YieldSource} from "../src/ERC4626YieldSource.sol";
import {IAggregatorV3} from "../src/IAggregatorV3.sol";
import {IPriceOracle} from "../src/IPriceOracle.sol";
import {IYieldSource} from "../src/IYieldSource.sol";
import {ISwapRouter} from "../src/ISwapRouter.sol";

/// @notice Production deployment. Every external address comes from the environment,
///         because nothing here may be a mock: the USDG, the price feeds, the yield
///         vaults and the swap venue are all contracts someone else already operates.
/// @dev Markets are read from `script/markets.<chainId>.json` so that adding one is a
///      config change rather than a code change. Run with:
///
///        MARKETS_FILE=script/markets.1234.json \
///        USDG=0x… ROUTER=0x… FEE_RECIPIENT=0x… \
///        forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
///
///      The script refuses to run against Anvil — use DeployLocal for that.
contract Deploy is Script {
    struct MarketCfg {
        address asset;
        address aggregator;
        address vault;
        uint256 maxAnswer1e18;
        uint16 maxLtvBps;
        uint16 liqThresholdBps;
        uint16 liqBonusBps;
        uint256 cap;
        string symbol;
        string name;
    }

    error UseDeployLocalOnAnvil();
    error MissingAddress(string what);
    error NoMarkets();

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        if (block.chainid == 31337) revert UseDeployLocalOnAnvil();

        address usdg = vm.envAddress("USDG");
        address router = vm.envOr("ROUTER", address(0));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address owner = vm.envOr("OWNER", deployer);
        uint16 slippageBps = uint16(vm.envOr("MAX_SLIPPAGE_BPS", uint256(100)));
        uint256 maxStaleness = vm.envOr("MAX_STALENESS", uint256(3600));
        if (usdg == address(0)) revert MissingAddress("USDG");
        if (feeRecipient == address(0)) revert MissingAddress("FEE_RECIPIENT");

        MarketCfg[] memory cfgs = _readMarkets();
        if (cfgs.length == 0) revert NoMarkets();

        vm.startBroadcast(pk);

        // Deployer keeps ownership through configuration and hands over at the end,
        // so a single broadcast can both deploy and wire everything up.
        ChainlinkOracle oracle = new ChainlinkOracle(deployer);
        ERC4626YieldSource ys = new ERC4626YieldSource(
            deployer, IERC20(usdg), IPriceOracle(address(oracle)), ISwapRouter(router), slippageBps
        );
        PyrisCore core = new PyrisCore(deployer, IERC20(usdg), IPriceOracle(address(oracle)), feeRecipient);
        core.setMaxStaleness(maxStaleness);

        for (uint256 i; i < cfgs.length; ++i) {
            MarketCfg memory c = cfgs[i];
            if (c.asset == address(0)) revert MissingAddress(c.symbol);
            oracle.setFeed(c.asset, IAggregatorV3(c.aggregator), c.maxAnswer1e18);
            ys.setVault(c.asset, IERC4626(c.vault));
            core.listMarket(
                c.asset, c.maxLtvBps, c.liqThresholdBps, c.liqBonusBps, c.cap, IYieldSource(address(ys))
            );
            // Prove the feed answers before anyone can borrow against it.
            (uint256 price,) = oracle.getPrice(c.asset);
            console.log(c.symbol, "listed at price 1e18:", price);
        }

        if (owner != deployer) {
            oracle.transferOwnership(owner);
            ys.transferOwnership(owner);
            core.transferOwnership(owner);
        }

        vm.stopBroadcast();

        _write(core, oracle, ys, usdg, deployer, cfgs);
    }

    // ---------------------------------------------------------------- config i/o

    function _readMarkets() internal view returns (MarketCfg[] memory cfgs) {
        string memory file = vm.envOr("MARKETS_FILE", string(""));
        if (bytes(file).length == 0) {
            file = string.concat("script/markets.", vm.toString(block.chainid), ".json");
        }
        string memory json = vm.readFile(file);
        string[] memory symbols = vm.parseJsonKeys(json, "$");
        cfgs = new MarketCfg[](symbols.length);
        for (uint256 i; i < symbols.length; ++i) {
            string memory k = string.concat("$.", symbols[i]);
            cfgs[i] = MarketCfg({
                asset: vm.parseJsonAddress(json, string.concat(k, ".asset")),
                aggregator: vm.parseJsonAddress(json, string.concat(k, ".aggregator")),
                vault: vm.parseJsonAddress(json, string.concat(k, ".vault")),
                maxAnswer1e18: vm.parseJsonUint(json, string.concat(k, ".maxAnswer1e18")),
                maxLtvBps: uint16(vm.parseJsonUint(json, string.concat(k, ".maxLtvBps"))),
                liqThresholdBps: uint16(vm.parseJsonUint(json, string.concat(k, ".liqThresholdBps"))),
                liqBonusBps: uint16(vm.parseJsonUint(json, string.concat(k, ".liqBonusBps"))),
                cap: vm.parseJsonUint(json, string.concat(k, ".cap")),
                symbol: symbols[i],
                name: vm.parseJsonString(json, string.concat(k, ".name"))
            });
        }
    }

    function _write(
        PyrisCore core,
        ChainlinkOracle oracle,
        ERC4626YieldSource ys,
        address usdg,
        address deployer,
        MarketCfg[] memory cfgs
    ) internal {
        string memory root = "deploy";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "usdg", usdg);
        vm.serializeAddress(root, "oracle", address(oracle));
        vm.serializeAddress(root, "yieldSource", address(ys));
        vm.serializeAddress(root, "PyrisCore", address(core));

        string memory mk = "markets";
        string memory marketsJson;
        for (uint256 i; i < cfgs.length; ++i) {
            string memory key = string.concat("m", vm.toString(i));
            vm.serializeString(key, "symbol", cfgs[i].symbol);
            vm.serializeString(key, "name", cfgs[i].name);
            vm.serializeUint(key, "maxLtvBps", cfgs[i].maxLtvBps);
            vm.serializeBool(key, "open", true);
            string memory obj = vm.serializeAddress(key, "asset", cfgs[i].asset);
            marketsJson = vm.serializeString(mk, cfgs[i].symbol, obj);
        }
        string memory out = vm.serializeString(root, "markets", marketsJson);
        string memory outFile = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, outFile);
        console.log("PyrisCore:", address(core));
        console.log("wrote", outFile);
    }
}

