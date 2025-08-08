# Running the Ballot Contract on Remix IDE

## Prerequisites
1. Ensure you have a web3-compatible browser (Chrome/Firefox).
2. Access the [Remix IDE](https://remix.ethereum.org/).

---

## Steps to Compile and Deploy the Ballot Contract

### 1. Load the `Ballot.sol` Contract in Remix
- Open Remix IDE.
- In the **File Explorer**, upload or create a new file named `Ballot.sol`.
- Copy and paste the contents of `Ballot.sol` into this file.

### 2. Compile the Contract
- Navigate to the **Solidity Compiler** tab (on the left sidebar).
- Ensure the compiler version matches the Solidity version specified in `Ballot.sol`.
- Click **Compile Ballot.sol**.
- If successful, you will see a green checkmark.

### 3. Deploy the Contract
- Go to the **Deploy & Run Transactions** tab.
- Select an environment:
  - **Remix VM** (for local testing)
- Under "Deploy", enter proposal names as an array of strings (e.g., `['Alpha', 'Beta', 'Gamma']`).
- Click **Deploy**.
- The contract should be deployed, and its address will appear in the "Deployed Contracts" section.

---

## Running `ballot_example.js` to Interact with the Contract

### 1. Load the Script in Remix
- Open the **File Explorer** and upload/create `ballot_example.js`.
- Copy and paste the contents of `ballot_example.js`.

### 2. Connect to the Deployed Contract
- In `ballot_example.js`, replace `ballotAddress` with the actual contract address deployed in Remix. You can find the address of the deployed contract in the console.

### 3. Execute the Script
- Open the **Terminal** in Remix.
- Press the play button on the top toolbar after opening the javascript file to run it.
- Observe the logs showing contract interactions, including proposal listings, voting, and results.

---


For additional help, post on Piazza.

