// Input these fields before starting

const SCALE = BigInt("1000000000000000000");

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

function convert(value) {
    return web3.utils.fromWei(`${value}`, 'ether');
}

async function simulator() {
    try {
        const threshold = 100n * BigInt(1e17);
        const accounts = await web3.eth.getAccounts();
        const Owner = accounts[0];

        const intialSupplyA = 10000n;
        const intialSupplyB = 10000n;

        const tokenA = await getContractInstance("Token", ["TokenA", "TKA", intialSupplyA], Owner);
        const tokenB = await getContractInstance("Token", ["TokenB", "TKB", intialSupplyB], Owner);
        const dex1 = await getContractInstance("DEX", [tokenA.options.address, tokenB.options.address], Owner);
        const dex2 = await getContractInstance("DEX", [tokenA.options.address, tokenB.options.address], Owner);
        const arbitrage = await getContractInstance("Arbitrage", [dex1.options.address, dex2.options.address], Owner);

        let amountA1 = 2000n * SCALE;
        let amountB1 = 2000n * SCALE;
        let amountA2 = 2000n * SCALE;
        let amountB2 = 2000n * SCALE;

        await tokenA.methods.approve(dex1.options.address, amountA1).send({ from: Owner });
        await tokenB.methods.approve(dex1.options.address, amountB1).send({ from: Owner });

        await tokenA.methods.approve(dex2.options.address, amountA2).send({ from: Owner });
        await tokenB.methods.approve(dex2.options.address, amountB2).send({ from: Owner });

        await tokenA.methods.approve(arbitrage.options.address, amountA1 + amountA2).send({ from: Owner });
        await tokenB.methods.approve(arbitrage.options.address, amountB1 + amountB2).send({ from: Owner });

        await dex1.methods.addLiquidity(amountA1, amountB1).send({ from: Owner });
        await dex2.methods.addLiquidity(amountA2, amountB2).send({ from: Owner });

        // Case 1 : No profit
        
        let res = await arbitrage.methods.executeArbitrage(threshold).send({ from: Owner });
        res = res.events.ArbitrageDone.returnValues;
        console.log(`AmountIn: ${convert(res.amountIn)}, Profit: ${convert(res.profit)}, Type: ${res.txnType}`);

        // Case 2: Profit but less than threshold

        let amountAToSwap = 20n * SCALE;
        await tokenA.methods.approve(dex1.options.address, amountAToSwap).send({ from: Owner });
        await dex1.methods.swapAForB(amountAToSwap).send({ from: Owner });

        res = await arbitrage.methods.executeArbitrage(threshold).send({ from: Owner });
        res = res.events.ArbitrageDone.returnValues;
        console.log(`AmountIn: ${convert(res.amountIn)}, Profit: ${convert(res.profit)}, Type: ${res.txnType}`);

        // Case 3: Profit and greater than threshold

        amountAToSwap = 200n * SCALE;
        await tokenA.methods.approve(dex1.options.address, amountAToSwap).send({ from: Owner });
        await dex1.methods.swapAForB(amountAToSwap).send({ from: Owner });

        res = await arbitrage.methods.executeArbitrage(threshold).send({ from: Owner });
        res = res.events.ArbitrageDone.returnValues;
        console.log(`AmountIn: ${convert(res.amountIn)}, Profit: ${convert(res.profit)}, Type: ${res.txnType}`);
    }

    catch(err) {
        console.log(err);
    }
}

simulator();