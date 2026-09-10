// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice TEST ONLY. A genuine OpenZeppelin ERC-4626 vault — the adapter under test
///         talks to the real standard implementation, not a hand-written imitation.
///         `accrue` moves the share price the way a yield-bearing vault does, by
///         increasing the underlying the vault holds without issuing new shares.
contract StubVault is ERC4626 {
    constructor(MockERC20 asset_)
        ERC20(string.concat("Vault ", IERC20Metadata(address(asset_)).symbol()), string.concat("v", IERC20Metadata(address(asset_)).symbol()))
        ERC4626(IERC20(address(asset_)))
    {}

    /// @notice Credit `amount` of underlying to the vault: every share gains value.
    function accrue(uint256 amount) external {
        MockERC20(asset()).mint(address(this), amount);
    }

    /// @notice Burn underlying held by the vault: every share loses value.
    function lose(uint256 amount) external {
        MockERC20(asset()).burn(address(this), amount);
    }
}
