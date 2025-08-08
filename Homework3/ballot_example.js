async function interactWithBallot() {
    try {
        console.log("Starting Ballot contract interaction...");
        
        // 1. Get contract ABI
        const metadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/contracts/artifacts/Ballot.json'));
        if (!metadata) {
            throw new Error("Could not find Ballot.json artifact. Please compile the contract first.");
        }
        
        const ballotABI = metadata.abi;
        
        // 2. Get accounts
        const accounts = await web3.eth.getAccounts();
        const chairperson = accounts[0];
        const voter1 = accounts[1];
        const voter2 = accounts[2];
        const voter3 = accounts[3];
        
        console.log("Chairperson:", chairperson);
        console.log("Voter 1:", voter1);
        console.log("Voter 2:", voter2);
        console.log("Voter 3:", voter3);
        
        // 3. Enter the address of your deployed Ballot contract
        const ballotAddress = "0xb27A31f1b0AF2946B7F582768f03239b1eC07c2c"; // REPLACE WITH YOUR CONTRACT ADDRESS
        
        if (!ballotAddress || !web3.utils.isAddress(ballotAddress)) {
            throw new Error("Please enter a valid contract address");
        }
        
        // 4. Create contract instance
        const ballotInstance = new web3.eth.Contract(ballotABI, ballotAddress);
        console.log("Connected to Ballot contract at:", ballotAddress);
        
        // 5. Check current proposals (using the correct approach)
        console.log("\nCurrent proposals in contract:");
        
        // Since your contract doesn't have proposalsCount(), we'll use a try-catch approach
        let proposalCount = 0;
        while (true) {
            try {
                const proposal = await ballotInstance.methods.proposals(proposalCount).call();
                const name = web3.utils.hexToUtf8(proposal.name);
                console.log(`- Proposal ${proposalCount}: ${name}`);
                proposalCount++;
            } catch (e) {
                break;
            }
        }
        
        if (proposalCount === 0) {
            throw new Error("No proposals found in the contract");
        }
        
        console.log(`Found ${proposalCount} proposals`);
        
        // 6. Check chairperson
        const currentChairperson = await ballotInstance.methods.chairperson().call();
        console.log("\nCurrent chairperson:", currentChairperson);
        
        // 7. Simulate voting (only if chairperson matches our account)
        if (currentChairperson.toLowerCase() === chairperson.toLowerCase()) {
            console.log("\nChairperson detected - granting voting rights...");
            
            // Give voting rights
            await ballotInstance.methods.giveRightToVote(voter1).send({ from: chairperson });
            await ballotInstance.methods.giveRightToVote(voter2).send({ from: chairperson });
            await ballotInstance.methods.giveRightToVote(voter3).send({ from: chairperson });
            console.log("Voting rights granted to 3 voters");
            
            // Simulate voting
            console.log("\nSimulating votes...");
            
            // Voter 1 votes for proposal 0
            await ballotInstance.methods.vote(0).send({ from: voter1 });
            console.log("Voter 1 voted for Proposal 0");
            
            // Voter 2 votes for proposal 1
            await ballotInstance.methods.vote(1).send({ from: voter2 });
            console.log("Voter 2 voted for Proposal 1");
            
            // Voter 3 delegates to Voter 1
            await ballotInstance.methods.delegate(voter1).send({ from: voter3 });
            console.log("Voter 3 delegated their vote to Voter 1");
        } else {
            console.log("\nCurrent chairperson doesn't match our account - skipping voting simulation");
        }
        
        // 8. Check results
        console.log("\nChecking results...");
        
        const winnerIndex = await ballotInstance.methods.winningProposal().call();
        const winnerNameBytes = await ballotInstance.methods.winnerName().call();
        const winnerName = web3.utils.hexToUtf8(winnerNameBytes);
        console.log(`Winning proposal: ${winnerName} (Index ${winnerIndex})`);
        
        console.log("\nCurrent vote counts:");
        for (let i = 0; i < proposalCount; i++) {
            const proposal = await ballotInstance.methods.proposals(i).call();
            const name = web3.utils.hexToUtf8(proposal.name);
            console.log(`- ${name}: ${proposal.voteCount} votes`);
        }
        
        console.log("\nInteraction complete!");
    } catch (error) {
        console.error("Error in interaction:", error);
    }
}

// Run the interaction
interactWithBallot();