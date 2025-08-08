// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./LPToken.sol";

contract DEX is ReentrancyGuard {
    uint constant SCALE = 1e18;
    uint constant TOLERANCE = 1e16;

    IERC20 immutable public tokenA;
    IERC20 immutable public tokenB;
    LPToken immutable public lpToken;
    
    uint reserveA;
    uint reserveB;

    // Events
    event LiquidityAdded(address indexed _lp, uint _amountA, uint _amountB, uint _lpAmount);
    event LiquidityRemoved(address indexed  _lp, uint _amountA, uint _amountB, uint _lpAmount);
    event TokenSwapped(address indexed _trader, uint _amountIn, uint _amountOut);

    constructor (address _tokenA, address _tokenB) {
        require(_tokenA != _tokenB, "tokenA address should not be equal to tokenB address.");
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token address");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        lpToken = new LPToken();
    }

    /**
     * @dev Add Liquidity Into the pool
    */
    function addLiquidity(uint amountA, uint amountB) external nonReentrant returns (uint lpAmount) {
        require(amountA > 0 && amountB > 0, "Amounts must be positive");
        require(reserveA == 0 && reserveB == 0 || reserveA > 0 && reserveB > 0, "Invalid reserve state");
        
        uint totalSupply = lpToken.totalSupply();

        if(reserveA == 0 && reserveB == 0) {
            lpAmount = Math.sqrt(amountA * amountB);
            require(lpAmount > 0, "Invalid initial deposit");
        }
        else {
            uint amountRatio = amountA * SCALE / amountB;
            uint reserveRatio = reserveA * SCALE / reserveB;
            uint minRatio = Math.min(amountRatio, reserveRatio);
            uint maxRatio = Math.max(amountRatio, reserveRatio);
            require((maxRatio - minRatio) <= (TOLERANCE * minRatio) / SCALE);
            
            uint lpAmountA = (amountA * totalSupply) / reserveA;
            uint lpAmountB = (amountB * totalSupply) / reserveB;
            lpAmount = Math.min(lpAmountA, lpAmountB);
            require(lpAmount > 0, "No lp tokens to mint");
        }

        reserveA += amountA;
        reserveB += amountB;

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "Token A transfer to DEX failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "Token B transfer to DEX failed");

        lpToken.mint(msg.sender, lpAmount);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpAmount);
        return lpAmount;
    }

    /**
     * @dev Remove Liquidity From the pool
    */
    function removeLiquidity(uint lpAmount) external nonReentrant returns (uint amountA, uint amountB) {
        require(lpAmount > 0, "LP amount must be positive");
        uint totalSupply = lpToken.totalSupply();

        require(totalSupply > 0, "Pool is empty");
        require(lpAmount <= lpToken.balanceOf(msg.sender), "Insufficient LP Tokens");
        
        amountA = (reserveA * lpAmount) / totalSupply;
        amountB = (reserveB * lpAmount) / totalSupply;

        require(amountA > 0 && amountB > 0, "No tokens to withdraw");
        require(amountA <= reserveA && amountB <= reserveB, "Insufficient reserves");

        lpToken.burn(msg.sender, lpAmount);
        reserveA -= amountA;
        reserveB -= amountB;

        require(tokenA.transfer(msg.sender, amountA), "Token A transfer to user failed");
        require(tokenB.transfer(msg.sender, amountB), "Token B transfer to user failed");

        emit LiquidityRemoved(msg.sender, amountA, amountB, lpAmount);
        return (amountA, amountB);
    }

    /**
     * @dev Swap TokenA For TokenB
    */
    function swapAForB(uint amountA) external nonReentrant returns (uint amountB) {
        require(amountA > 0, "AmountA should be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient Liquidity");

        uint amountAWithFee = amountA * 997;
        uint numerator = amountAWithFee * reserveB;
        uint denominator = (reserveA * 1000) + amountAWithFee;
        amountB = numerator / denominator;

        require(amountB > 0 && amountB <= reserveB, "Invalid output amount");

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "Token A transfer to DEX failed");
        require(tokenB.transfer(msg.sender, amountB), "Token B transfer to user failed.");

        reserveA += amountA;
        reserveB -= amountB;

        emit TokenSwapped(msg.sender, amountA, amountB);
        return amountB;
    }

    function swapBForA(uint amountB) external nonReentrant returns (uint amountA) {
        require(amountB > 0, "Amount B should be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient Liquidity");
        
        uint amountBWithFee = amountB * 997;
        uint numerator = amountBWithFee * reserveA;
        uint denominator = (reserveB * 1000) + amountBWithFee;
        amountA = numerator / denominator;

        require(amountA > 0 && amountA <= reserveA, "Invalid output amount");

        require(tokenB.transferFrom(msg.sender, address(this), amountB), "Token B transfer to DEX failed");
        require(tokenA.transfer(msg.sender, amountA), "Token A transfer to user failed.");

        reserveA -= amountA;
        reserveB += amountB;

        emit TokenSwapped(msg.sender, amountB, amountA);
        return amountA;
    }

    function spotPrice() external view returns (uint, uint) {
        return (reserveA, reserveB);
    }

    function getPriceAInB() external view returns (uint) {
        require(reserveA > 0, "ReserveA is zero");
        return (reserveB * SCALE) / reserveA;
    }

    function getPriceBInA() external view returns (uint) {
        require(reserveB > 0, "ReserveB is zero");
        return (reserveA * SCALE) / reserveB;
    }
}