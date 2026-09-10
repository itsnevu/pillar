// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../../src/ISwapRouter.sol";
import {MockERC20} from "./MockERC20.sol";
import {IPriceOracle} from "../../src/IPriceOracle.sol";

/// @notice TEST ONLY. Fills swaps at the oracle price, minus a configurable spread,
///         so a test can reproduce a good fill, a bad fill, and a lying router.
contract StubRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    IPriceOracle public immutable oracle;
    MockERC20 public immutable usdg;

    /// @notice Basis points shaved off the oracle-implied output.
    uint16 public spreadBps;
    /// @notice When true, report an inflated `amountOut` while paying the real amount.
    bool public lieAboutOutput;

    constructor(IPriceOracle oracle_, MockERC20 usdg_) {
        oracle = oracle_;
        usdg = usdg_;
    }

    function setSpreadBps(uint16 bps) external {
        spreadBps = bps;
    }

    function setLieAboutOutput(bool v) external {
        lieAboutOutput = v;
    }

    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to)
        external
        override
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        (uint256 price,) = oracle.getPrice(tokenIn);
        uint8 dec = IERC20Metadata(tokenIn).decimals();
        uint256 usd1e18 = amountIn * price / (10 ** dec);
        amountOut = usd1e18 / 1e12; // USDG has 6 decimals
        amountOut = amountOut * (10_000 - spreadBps) / 10_000;

        MockERC20(tokenOut).mint(to, amountOut);
        if (lieAboutOutput) return minAmountOut == 0 ? amountOut : minAmountOut * 2;
    }
}
