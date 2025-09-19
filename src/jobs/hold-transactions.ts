import "dotenv/config";
import { HoldController } from "../controllers/hold.controller";
import cron from "node-cron";
import Printer from "../utils/utils";
import axios from "axios";
import moment from "moment";


const print = new Printer("hold-transactions");

const task = async () => {
    try {
        print.log(`Starting hold transactions process ===================================================================`);
        const db = new HoldController(true);
        const config = await db.getConfig();
        const transactions = await db.getHoldTransactions();
        print.log(`Found ${transactions.length} hold transactions`);

        const flowsMap: Record<string, string> = {
            "10": "ACT",
            "9": "INT_PORT",
            "4": "EXT_PORT_POST",
            "5": "INT_PORT"
        }

        const queue = []
        for (const transaction of transactions) {

            const flow = flowsMap[String(transaction.port_type)] || ""
            if (!flow) {
                print.log(`No flow found for transaction ${transaction.id} with port_type ${transaction.port_type}, skipping`);
                await db.updateStatus(transaction.id, 3); // set to failed
                continue;
            }


            const query = new Promise<void>(async (resolve, reject) => {
                try {

                    const payload: Record<string, any> = JSON.parse(transaction.payload || '{}');
                    const contract_number = payload?.contract_number || "";
                    if (!contract_number) {
                        print.log(`No contract_number in payload for transaction ${transaction.id}, skipping`);
                        await db.updateStatus(transaction.id, 3); // set to failed
                        resolve();
                        return
                    }

                    print.log(`Processing transaction ${transaction.id} - ${flow} - ${contract_number}`)

                    const checkPost = await axios.post(config.sp_gettransactionstatus_service, {
                        flow: flow,
                        transaction_id: contract_number,
                    }, { headers: { apikey: config.api_key_nip_service } })

                    const checkResponse = checkPost.data;
                    if (checkResponse.response !== 1) {
                        print.log(`Error in response for transaction ${transaction.id}: ${JSON.stringify(checkResponse)}`);
                        resolve();
                        return
                    }

                    const isPaid = checkResponse?.result?.fecha_pago
                    print.log(`Transaction ${transaction.id} isPaid: ${!!isPaid}, fecha_pago: ${checkResponse?.result?.fecha_pago}`);
                    if (!isPaid) {

                        const createdAt = moment.utc(transaction.created_at).subtract(5, 'hours'); // convert to utc-5
                        const now = moment.utc().subtract(5, 'hours');
                        const diffHours = now.diff(createdAt, 'hours');

                        if (diffHours >= Number(process.env.ht_time_for_payment || 24)) {
                            print.log(`Transaction ${transaction.id} has been in hold for more than ${process.env.ht_time_for_payment || 24} hours`);
                            await db.updateStatus(transaction.id, 3); // set to failed
                        }else{
                            print.log(`Transaction ${transaction.id} has been in hold for ${diffHours} hours, waiting more time`);
                        }

                        resolve();
                        return
                    }

                    await db.updateStatus(transaction.id, 2); // set to completed

                    print.log(`Response for transaction ${transaction.id}: ${JSON.stringify(checkResponse)}`);
                    resolve();
                } catch (error) {
                    print.log(`Error processing transaction ${transaction.id}: ${error}`);
                    reject(error);
                }
            });
            queue.push(query);
        }

        await Promise.allSettled(queue);
        await db.disconnect();
        print.log(`End of hold transactions process ===================================================================`)
    } catch (e) {
        print.log(`Error: ${e}`)
    }
}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.HOLD_TRANSACTIONS_CRON) {
        console.log("init HOLD_TRANSACTIONS_CRON as", process.env.HOLD_TRANSACTIONS_CRON)
        cron.schedule(process.env.HOLD_TRANSACTIONS_CRON, () => task())
    }
}

