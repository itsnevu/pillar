// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISwapRouter
/// @notice The one thing Pillar needs from a DEX: turn an exact amount of one
///         token into at least `minAmountOut` of another.
/// @dev Deliberately narrower than any real router's surface. Aggregators such as
///      KyberSwap expose route-specific calldata that cannot be constructed
///      on-chain, so the deployed contract at this address is a thin adapter that
///      owns the route for a single pair. Keeping the interface this small means
///      ERC4626YieldSource has no opinion about which venue fills the swap.
interface ISwapRouter {
    /// @notice Pull `amountIn` of `tokenIn` from msg.sender and send at least
    ///         `minAmountOut` of `tokenOut` to `to`.
    /// @return amountOut The amount of `tokenOut` actually delivered.
    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to)
        external
        returns (uint256 amountOut);
}
