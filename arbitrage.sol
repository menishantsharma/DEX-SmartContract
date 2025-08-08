// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./DEX.sol";


struct Reserves {
    uint A1;
    uint B1;
    uint A2;
    uint B2;
}

struct SpotPrices {
    uint A1;
    uint B1;
    uint A2;
    uint B2;
}

contract Arbitrage {
    uint constant FEE_NUMERATOR = 3;
    uint constant FEE_DENOMINATOR = 1000;
    uint constant SCALE = 1e18;
    address dex1_addr;
    address dex2_addr;

    DEX dex1;
    DEX dex2;
    IERC20 tokenA;
    IERC20 tokenB;

    constructor(address _dex1, address _dex2) {
        dex1 = DEX(_dex1);
        dex2 = DEX(_dex2);
        dex1_addr = _dex1;
        dex2_addr = _dex2;
        tokenA = IERC20(dex1.tokenA());
        tokenB = IERC20(dex1.tokenB());
    }

    event ArbitrageDone(uint profit, uint txnType, uint amountIn);

    function getAmountOut(uint amountIn, uint reserveIn1, uint reserveOut1, uint reserveIn2, uint reserveOut2) internal pure returns (uint amountOut) {
        // First Swap
        uint amountInWithFee = amountIn * 997;
        uint numerator1 = amountInWithFee * reserveOut1;
        uint denominator1 = (reserveIn1 * 1000) + amountInWithFee;
        uint amountMid = numerator1 / denominator1;

        // Second Swap
        uint amountMidWithFee = amountMid * 997;
        uint numerator2 = amountMidWithFee * reserveOut2;
        uint denominator2 = (reserveIn2 * 1000) + amountMidWithFee;
        amountOut = numerator2 / denominator2;
        return amountOut;
    }

    function getProfit(uint reserveIn1, uint reserveOut1, uint reserveIn2, uint reserveOut2, uint balance) internal pure returns(uint profit, uint amount) {
        profit = 0;
        amount = 0;

        uint start = 1;
        uint end = (reserveIn1 < balance) ? reserveIn1 : balance;

        while(end - start > 3) {
            uint mid1 = start + (end - start)/3;
            uint mid2 = end - (end-start)/3;

            uint out1 = getAmountOut(mid1, reserveIn1, reserveOut1, reserveIn2, reserveOut2);
            uint out2 = getAmountOut(mid2, reserveIn1, reserveOut1, reserveIn2, reserveOut2);

            uint profit1 = (out1 > mid1) ? (out1 - mid1) : 0;
            uint profit2 = (out2 > mid2) ? (out2 - mid2) : 0;

            if(profit1 < profit2) {
                start = mid1;

                if(profit2 > profit) {
                    profit = profit2;
                    amount = mid2;
                }
            }

            else {
                end = mid2;
                if(profit1 > profit) {
                    profit = profit1;
                    amount = mid1;
                }
            }
        }

        for(uint amt = start; amt <= end; amt++) {
            uint out = getAmountOut(amt, reserveIn1, reserveOut1, reserveIn2, reserveOut2);

            if(out > amt) {
                uint curProfit = out - amt;
                if(curProfit > profit) {
                    profit = curProfit;
                    amount = amt;
                }
            }
        }


        return (profit, amount);
    }

    function executeTrade(uint txnType, uint amountIn) internal {
        // A -> DEX1 -> B -> DEX2 -> A
        if(txnType == 1) {
            tokenA.transferFrom(msg.sender, address(this), amountIn);
            tokenA.approve(dex1_addr, amountIn);
            uint amountB = dex1.swapAForB(amountIn);
            tokenB.approve(dex2_addr, amountB);
            uint amountA = dex2.swapBForA(amountB);
            tokenA.transfer(msg.sender, amountA);
        }

        // A -> DEX2 -> B -> DEX1 -> A
        else if(txnType == 2) {
            tokenA.transferFrom(msg.sender, address(this), amountIn);
            tokenA.approve(dex2_addr, amountIn);
            uint amountB = dex2.swapAForB(amountIn);
            tokenB.approve(dex1_addr, amountB);
            uint amountA = dex1.swapBForA(amountB);
            tokenA.transfer(msg.sender, amountA);
        }

        // B -> DEX1 -> A -> DEX2 -> B
        else if(txnType == 3) {
            tokenB.transferFrom(msg.sender, address(this), amountIn);
            tokenB.approve(dex1_addr, amountIn);
            uint amountA = dex1.swapBForA(amountIn);
            tokenA.approve(dex2_addr, amountA);
            uint amountB = dex2.swapAForB(amountA);
            tokenB.transfer(msg.sender, amountB);
        }

        // B -> DEX2 -> A -> DEX1 -> B
        else if(txnType == 4) {
            tokenB.transferFrom(msg.sender, address(this), amountIn);
            tokenB.approve(dex2_addr, amountIn);
            uint amountA = dex2.swapBForA(amountIn);
            tokenA.approve(dex1_addr, amountA);
            uint amountB = dex1.swapAForB(amountA);
            tokenB.transfer(msg.sender, amountB);
        }
    }

    function executeArbitrage(uint threshold) external returns (uint maxProfit, uint txnType, uint maxAmountIn) {
        Reserves memory r = Reserves(0, 0, 0, 0);
        SpotPrices memory s = SpotPrices(0, 0, 0, 0);

        (r.A1, r.B1) = dex1.spotPrice();
        (r.A2, r.B2) = dex2.spotPrice();

        uint balanceA = tokenA.balanceOf(msg.sender);
        uint balanceB = tokenB.balanceOf(msg.sender);

        uint profit = 0;
        uint amount = 0;

        if(r.A1 != 0) s.A1 = (r.B1 * SCALE) / r.A1;
        if(r.B1 != 0) s.B1 = (r.A1 * SCALE) / r.B1;
        if(r.A2 != 0) s.A2 = (r.B2 * SCALE) / r.A2;
        if(r.B2 != 0) s.B2 = (r.A2 * SCALE) / r.B2;

        // A -> DEX1 -> B -> DEX2 -> A
        if(s.A1 > s.A2) {
            (profit, amount) = getProfit(r.A1, r.B1, r.B2, r.A2, balanceA);
            if(profit > maxProfit) {
                maxProfit = profit;
                maxAmountIn = amount;
                txnType = 1;
            }
        }

        // A -> DEX2 -> B -> DEX1 -> A
        else {
            (profit, amount) = getProfit(r.A2, r.B2, r.B1, r.A1, balanceA);
            if(profit > maxProfit) {
                maxProfit = profit;
                maxAmountIn = amount;
                txnType = 2;
            }
        }

        // B -> DEX1 -> A -> DEX2 -> B
        if(s.B1 > s.B2) {
            (profit, amount) = getProfit(r.B1, r.A1, r.A2, r.B2, balanceB);
            if(profit > maxProfit) {
                maxProfit = profit;
                maxAmountIn = amount;
                txnType = 3;
            }
        }

        // B -> DEX2 -> A -> DEX1 -> B
        else {
            (profit, amount) = getProfit(r.B2, r.A2, r.A1, r.B1, balanceB);
            if(profit > maxProfit) {
                maxProfit = profit;
                maxAmountIn = amount;
                txnType = 4;
            }
        }

        if(maxProfit == 0) {
            txnType = 5;
        }

        else if(maxProfit < threshold) {
            txnType = 6;
            maxProfit = 0;
            maxAmountIn = 0;
        }

        if(maxProfit > 0) executeTrade(txnType, maxAmountIn);

        emit ArbitrageDone(maxProfit, txnType, maxAmountIn);
        return (maxProfit, txnType, maxAmountIn);
    }
}