import { contractAddresses, abi, networkConfig } from "../constants"
import { useMoralis, useWeb3Contract } from "react-moralis"
import { useEffect, useState } from "react"
import { useNotification } from "web3uikit"
import { ethers } from "ethers"

export default function CreateABet() {
    function dateString2timestampNum(aDateString) {
        var inputDate = new Date(aDateString)
        return Math.round(inputDate.getTime() / 1000) // seconds
    }
    function timestampNum2dateString(aTimestampNum) {
        var date = new Date(aTimestampNum * 1000)
        // console.log(date.toDateString(), date.toTimeString())
        var year = date.getFullYear()
        var month = "0" + (date.getMonth() + 1)
        var day = "0" + date.getDate()
        var hours = "0" + date.getHours()
        var minutes = "0" + date.getMinutes()
        var seconds = "0" + date.getSeconds()
        return (
            year +
            "-" +
            month.slice(-2) +
            "-" +
            day.slice(-2) +
            " " +
            hours.slice(-2) +
            ":" +
            minutes.slice(-2) +
            ":" +
            seconds.slice(-2)
        )
    }

    // const timeStamp = dateString2timestampNum("2022-10-01 09:05:30")
    // const outputDate = timestampNum2dateString(timeStamp)

    const { Moralis, isWeb3Enabled, chainId: chainIdHex } = useMoralis()
    const chainId = parseInt(chainIdHex)
    const cryptocurrencyFutureBetAddress =
        chainId in contractAddresses ? contractAddresses[chainId][0] : null
    const dispatch = useNotification()
    let [allBetsLines, setAllBetsLines] = useState([]),
        [createBetParams, setCreateBetParams] = useState({}),
        [betParams, setBetParams] = useState({ msgValue: 0, walletParams: {}, marginParams: {} })

    let withDrawParams = {}

    const { runContractFunction: getAllBetsLines } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "getAllBetsLines",
        // msgValue: 0,
        // params: {},
    })
    const { runContractFunction: withDraw } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "withDraw",
        params: withDrawParams,
    })
    const { runContractFunction: getAvailableMargin } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "getAvailableMargin",
    })
    const {
        runContractFunction: payFromWallet,
        data: BWD,
        BWisLoading,
        BWisFetching,
    } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "payFromWallet",
        msgValue: betParams["msgValue"],
        params: betParams["walletParams"],
    })
    const {
        runContractFunction: payFromMargin,
        data: BMD,
        BMisLoading,
        BMisFetching,
    } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "payFromMargin",
        params: betParams["marginParams"],
    })

    const {
        runContractFunction: createBet,
        data: aResponse,
        CBisLoading,
        CBisFetching,
    } = useWeb3Contract({
        abi: abi,
        contractAddress: cryptocurrencyFutureBetAddress,
        functionName: "createBet",
        // msgValue: 100000000,
        params: createBetParams,
    })

    async function updateBetLines() {
        const betsLines = await getAllBetsLines()
        const now = Date.now() / 1000
        var formatLines = []
        for (let i = 0; i < betsLines.length; i++) {
            const bli = betsLines[i].split(",")
            if (now < parseInt(bli[2])) {
                formatLines.push(
                    `Line-${i + 1} -> Bet ${bli[0]} would reach ${parseInt(
                        bli[4]
                    )} on ${timestampNum2dateString(
                        parseInt(bli[3])
                    )}: starts from ${timestampNum2dateString(
                        parseInt(bli[1])
                    )} stop at ${timestampNum2dateString(parseInt(bli[2]))}`
                )
            }
        }
        setAllBetsLines(formatLines)
    }

    function BupdateParams() {
        const createNewBetParams = document.getElementById("bet").value.split(",")
        if (createNewBetParams.length === 3 && createNewBetParams[2].length > 0) {
            let lineNum = parseInt(createNewBetParams[0].trim()) - 1,
                betDirect = createNewBetParams[1].trim().toUpperCase() === "UP" ? 1 : -1,
                weiAmount = ethers.utils.parseEther(createNewBetParams[2].trim())
            setBetParams({
                msgValue: weiAmount,
                walletParams: { betIndex: lineNum, direct: betDirect },
                marginParams: { betIndex: lineNum, direct: betDirect, amount: weiAmount },
            })
        }
    }

    function CBupdateParams() {
        const createNewBetParams = document.getElementById("createNewBet").value.split(",")
        if (createNewBetParams.length === 3) {
            let symbol = createNewBetParams[0].trim().toUpperCase(),
                targetPrice = createNewBetParams[2].trim().split(".")
            setCreateBetParams({
                symbol: symbol,
                targetTime: dateString2timestampNum(createNewBetParams[1].trim()),
                targetPriceInt: targetPrice[0].trim(),
                targetPriceDecimals: targetPrice.length < 2 ? 0 : targetPrice[1].trim,
                feedDataAddress: networkConfig[chainId]["feedDataAddress"][symbol],
            })
        }
    }

    useEffect(() => {
        if (isWeb3Enabled) {
            updateBetLines()
        }
    }, [isWeb3Enabled])

    return (
        <div className="p-5">
            <h1 className="py-2 px-1 font-bold text-1xl">
                <input
                    className="py-2"
                    type="text"
                    id="createNewBet"
                    placeholder="Please put in 'symbol,target time,target price', e.g. ETHUSD,2022-10-30 00:00:00,2600"
                    size="75"
                    onChange={CBupdateParams}
                />
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-auto"
                    onClick={async () => {
                        await createBet({
                            onSuccess: async (tx) => {
                                try {
                                    await tx.wait(1)
                                    updateBetLines()
                                    {
                                        dispatch({
                                            type: "info",
                                            message: "A new Bet line has been created!",
                                            title: "Create New Bet Notification",
                                            position: "topR",
                                            icon: "bell",
                                        })
                                    }
                                } catch (error) {
                                    console.log(error)
                                }
                            },
                            onError: (error) => console.log(error),
                        })
                    }}
                    disabled={CBisLoading || CBisFetching}
                >
                    {CBisLoading || CBisFetching ? (
                        <div className="animate-spin spinner-border h-8 w-8 border-b-2 rounded-full"></div>
                    ) : (
                        "Create New Bet"
                    )}
                </button>
                <input
                    className="py-2"
                    type="text"
                    id="bet"
                    placeholder="Please put in 'bet line number,bet direct,bet eth amount', e.g. 1,UP,0.1"
                    size="75"
                    onChange={BupdateParams}
                />
                <button
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-auto"
                    onClick={async () => {
                        let availableMargin = await getAvailableMargin()
                        if (parseInt(betParams["msgValue"].toString()) > parseInt(availableMargin.toString())) {
                            await payFromWallet({
                                onSuccess: async (tx) => {
                                    try {
                                        await tx.wait(1)
                                        {
                                            dispatch({
                                                type: "info",
                                                message: "A Bet has been done, payed from Wallet",
                                                title: "Bet Notification",
                                                position: "topR",
                                                icon: "bell",
                                            })
                                        }
                                    } catch (error) {
                                        console.log(error)
                                    }
                                },
                            })
                        } else {
                            await payFromMargin({
                                onSuccess: async (tx) => {
                                    try {
                                        await tx.wait(1)
                                        {
                                            dispatch({
                                                type: "info",
                                                message: "A Bet has been done, payed from Margin",
                                                title: "Bet Notification",
                                                position: "topR",
                                                icon: "bell",
                                            })
                                        }
                                    } catch (error) {
                                        console.log(error)
                                    }
                                },
                                onError: (error) => console.log(error),
                            })
                        }
                    }}
                    disabled={BMisLoading || BMisFetching || BWisLoading || BWisFetching}
                >
                    {BMisLoading || BMisFetching || BWisLoading || BWisFetching ? (
                        <div className="animate-spin spinner-border h-8 w-8 border-b-2 rounded-full"></div>
                    ) : (
                        "Bet"
                    )}
                </button>
            </h1>
            <div>All Bets Lines:</div>
            <pre>{allBetsLines.join("\n")}</pre>
        </div>
    )
}
