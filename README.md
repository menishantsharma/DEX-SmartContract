# Arbitrage and Decentralized Exchange (DEX) Simulation

This project implements a decentralized exchange (DEX) and an arbitrage contract to simulate and execute arbitrage opportunities between two DEXs. It also includes scripts to simulate DEX operations and arbitrage scenarios.

## Project Structure

### Solidity Contracts

1. **Token.sol**  
   Implements an ERC20 token. Used as the base token for trading in the DEX.

2. **DEX.sol**  
   Implements a decentralized exchange with liquidity pools. Supports adding/removing liquidity and swapping tokens.

3. **LPToken.sol**  
   Implements ERC20 tokens for liquidity providers. Minted when liquidity is added and burned when liquidity is removed.

4. **arbitrage.sol**  
   Implements an arbitrage contract to identify and execute profitable trades between two DEXs. Uses a ternary search algorithm to maximize profits.

### Simulation Scripts

1. **simulate_DEX.js**  
   Simulates DEX operations such as adding/removing liquidity and token swaps. Tracks statistics like total value locked (TVL), fees, and slippage.

2. **simulate_arbitrage.js**  
   Simulates arbitrage scenarios between two DEXs. Tests cases with no profit, profit below the threshold, and profit above the threshold.

### Documentation

- **README.md**  
  Provides an overview of the project, its structure, and usage instructions.

- **report.pdf**  
  Contains a detailed report on the implementation, testing, and results of the project.

## Usage

1. Deploy the contracts using Remix or your preferred Ethereum development environment.
2. Use the simulation scripts to test the functionality of the contracts:
   - Run `simulate_DEX.js` to simulate DEX operations.
   - Run `simulate_arbitrage.js` to simulate arbitrage scenarios.

## Key Features

- **DEX Functionality**: Add/remove liquidity, swap tokens, and calculate spot prices.
- **Arbitrage Execution**: Identify and execute profitable trades between two DEXs.
- **Simulation**: Scripts to simulate real-world scenarios and test the contracts.