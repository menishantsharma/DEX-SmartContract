const Num_LP = 5;
const Num_Traders = 8;
const N = 100;
const SCALE = BigInt(10**18);

async function getContractInstance(contractName, args = [], Owner) {
    const metadata = JSON.parse(await remix.call("fileManager", "getFile", `browser/contracts/artifacts/${contractName}.json`));
    if(!metadata) throw new Error(`Could not find ${contractName}.json artifact. Please compile the contract first.`);
    const abi = metadata.abi;
    const bytecode = metadata.data?.bytecode?.object || metadata.bytecode;
    const instance = new web3.eth.Contract(abi);
    return await instance.deploy({
        data: bytecode,
        arguments: args,
    }).send({ from: Owner, gas: 5000000 });
}

async function randomBigInt(max) {
    if (max <= 0n) throw new Error("Max must be greater than 0");

    const bits = max.toString(2).length;
    const bytes = Math.ceil(bits / 8);
    
    while (true) {
        const randBytes = crypto.getRandomValues(new Uint8Array(bytes));
        let rand = 0n;
        for (let i = 0; i < bytes; i++) {
            rand = (rand << 8n) + BigInt(randBytes[i]);
        }

        if (rand < max) return rand;
    }
}

function convert(value) {
    return web3.utils.fromWei(`${value}`, 'ether');
}

async function simulator() {
    const accounts = await web3.eth.getAccounts();
    const Owner = accounts[0];
    const tokenA = await getContractInstance("Token", ["TokenA", "TKA", BigInt("1000000") * SCALE], Owner);
    const tokenB = await getContractInstance("Token", ["TokenB", "TKB", BigInt("1000000") * SCALE], Owner);
    const dex = await getContractInstance("DEX", [tokenA.options.address, tokenB.options.address], Owner);
    const lpTokenMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/contracts/artifacts/LPToken.json'));
    const LPTokenABI = lpTokenMetadata.abi;
    const lpTokenAddress = await dex.methods.lpToken().call();
    const lpToken = new web3.eth.Contract(LPTokenABI, lpTokenAddress);

    // Stats
    const tvl = [];
    const totalFees = [];
    const totalSwappedA = [];
    const totalSwappedB = [];
    const slippagesA = [];
    const slippagesB = [];
    const spotPricesA = [];
    const spotPricesB = [];
    const txnTypes = [];
    const holdings = {}

    // Accounts
    for(let i = 0; i < Num_LP; i++) holdings[accounts[i]] = [];

    // Distribute Tokens
    const totalA = BigInt(await tokenA.methods.balanceOf(Owner).call());
    const totalB = BigInt(await tokenB.methods.balanceOf(Owner).call());
    const tokenAPerAcc = totalA / BigInt(Num_LP + Num_Traders);
    const tokenBPerAcc = totalB / BigInt(Num_LP + Num_Traders);

    for(let i = 0; i < (Num_LP + Num_Traders); i++) {
        await tokenA.methods.transfer(accounts[i], tokenAPerAcc).send({ from: Owner });
        await tokenB.methods.transfer(accounts[i], tokenBPerAcc).send({ from: Owner });
        await tokenA.methods.approve(dex.options.address, totalA).send({ from: accounts[i] });
        await tokenB.methods.approve(dex.options.address, totalB).send({ from: accounts[i] });
    }

    console.log("Distributed");

    let swappedA = 0n;
    let swappedB = 0n;
    let fees = 0n;

    for(let round = 0; round < N; round++) {
        const txn = Math.floor(Math.random() * 3);

        // Save Stats
        const reserves = await dex.methods.spotPrice().call();
        const reserveA = BigInt(reserves[0]);
        const reserveB = BigInt(reserves[1]);

        let spotPriceA = 0n, spotPriceB = 0n;
        if(reserveA != 0n) spotPriceA = (reserveB * SCALE) / reserveA;
        if(reserveB != 0n) spotPriceB = (reserveA * SCALE) / reserveB;

        spotPricesA.push({[round]: convert(spotPriceA)})
        spotPricesB.push({[round]: convert(spotPriceB)})
        tvl.push({ [round]: convert(reserveA * 2n) });
        totalFees.push({ [round]: convert(fees) });
        totalSwappedA.push({ [round]: convert(swappedA) });
        totalSwappedB.push({ [round]: convert(swappedB) });

        for(let i = 0; i < Num_LP; i++) {
            holdings[accounts[i]].push(convert(BigInt(await lpToken.methods.balanceOf(accounts[i]).call())));
        }
        
        let type = ["ADD", "REMOVE", "SWAP"][txn];
        txnTypes.push({[round]: type});
        
        // Add Liquidity
        if(txn == 0) {
            console.log(`-------------${round}: ADD-------------`);
            try {
                const lp = Math.floor(Math.random() * Num_LP);
                const balanceA = BigInt(await tokenA.methods.balanceOf(accounts[lp]).call());
                const balanceB = BigInt(await tokenB.methods.balanceOf(accounts[lp]).call());

                let amountA = BigInt(10) * SCALE;
                let amountB = BigInt(10) * SCALE;
                
                if(reserveA != 0n && reserveB != 0n) {
                    const factor = Math.floor(Math.random() * 50) + 1;
                    amountA = (BigInt(factor) * reserveA) / 100n;
                    amountB = (amountA * reserveB) / reserveA;
                }  

                if(balanceA >= amountA && balanceB >= amountB) {
                    await dex.methods.addLiquidity(amountA, amountB).send({ from: accounts[lp] });
                    console.log("Success");
                }

                else {
                    console.log("Failed");
                    console.log(`Account: ${accounts[lp]}`);
                    console.log(`Balance Needed: TokenA ${convert(amountA)} | TokenB: ${convert(amountB)}`);
                    console.log(`Current Balance: TokenA ${convert(balanceA)} | TokenB: ${convert(balanceB)}`);
                }

            } catch(err) {
                console.log("Error");
            }
        }

        // Remove Liquidity
        if(txn == 1) {
            console.log(`-------------${round}: REMOVE-------------`);
            try {
                const lp = Math.floor(Math.random() * Num_LP);
                const lpBalance = BigInt(await lpToken.methods.balanceOf(accounts[lp]).call());
                if(lpBalance > 0n) {
                    const factor = BigInt(Math.floor(Math.random() * 100));
                    const amountLP = (lpBalance * factor) / 100n;
                    await dex.methods.removeLiquidity(amountLP).send({ from: accounts[lp] });
                    console.log("Success");
                }
                else {
                    console.log("Failed");
                    console.log(`LP Balance: ${lpBalance}`);
                }
            }

            catch(err) {
                console.log("Error");
            }
        }

        // Swap Token
        if(txn == 2) {
            try {
                const token = Math.floor(Math.random() * 2);
                const trader = Math.floor(Math.random() * Num_Traders) + Num_LP;

                // Swap A For B
                if(token == 0) {
                    console.log(`-------------${round}: SWAP A TO B-------------`);
                    const balanceA = BigInt(await tokenA.methods.balanceOf(accounts[trader]).call());
                    const reserveA10 = (reserveA * 10n) / 100n;
                    const max = balanceA < reserveA10 ? balanceA : reserveA10;

                    if(max > 0) {
                        const amountA = await randomBigInt(max);
                        const amountB = (amountA * 997n * reserveB) / (reserveA * 1000n + amountA * 997n);
                        await dex.methods.swapAForB(amountA).send({ from: accounts[trader] });
                        
                        // Stats
                        fees += (amountA * 3n)/1000n;
                        swappedA += amountA;

                        const X = amountA > 0n ? (amountB * SCALE) / amountA : 0n;
                        const Y = reserveA > 0n ? (reserveB * SCALE) / reserveA : 0n;
                        const slippage = Y > 0n ? (((X-Y) * SCALE) / Y) * 100n : 0n;
                        slippagesA.push({[round] : convert(slippage)});
                        console.log("Success");
                    }
                    else {
                        console.log("Failed");
                        console.log(`Max is Zero`);
                    }
                }

                // Swap B For A
                if(token == 1) {
                    console.log(`-------------${round}: SWAP B TO A-------------`);
                    const balanceB = BigInt(await tokenB.methods.balanceOf(accounts[trader]).call());
                    const reserveB10 = (reserveB * 10n) / 100n;
                    const max = balanceB < reserveB10 ? balanceB : reserveB10;
                    if(max > 0) {
                        const amountB = await randomBigInt(max);
                        const amountA = (amountB * 997n * reserveA) / (reserveB * 1000n + amountB * 997n);
                        await tokenB.methods.approve(dex.options.address, amountB).send({ from: accounts[trader] });
                        await dex.methods.swapBForA(amountB).send({ from: accounts[trader] });
                        
                        // Stats
                        if(reserveB != 0n) fees += (((amountB * 3n) / 1000n) * reserveA) / reserveB;

                        swappedB += amountB;
                        const X = amountB > 0n ? (amountA * SCALE) / amountB : 0n;
                        const Y = reserveB > 0n ? (reserveA * SCALE) / reserveB : 0n;
                        const slippage = Y > 0n ? (((X-Y) * SCALE) / Y) * 100n : 0n; 
                        slippagesB.push({[round] : convert(slippage)});
                        console.log("Success");
                    }
                    else {
                        console.log("Failed");
                        console.log("Max is Zero");
                    }
                }
            }

            catch(err) {
                console.log("Error");
            }
        }
    }

    // Printing Stats
    console.log("-------------STATS-------------");
    console.log("Transactions", txnTypes);
    console.log("TVL", tvl);
    console.log("Total Fees", totalFees);
    console.log("Total Swapped A", totalSwappedA);
    console.log("Total Swapped B", totalSwappedB);
    console.log("Slippages A", slippagesA);
    console.log("Slippages B", slippagesB);
    console.log("Spot Prices A", spotPricesA);
    console.log("Spot Prices B", spotPricesB);
    console.log("Holdings", holdings);
}


simulator();