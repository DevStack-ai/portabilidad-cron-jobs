import "dotenv/config";
import { DbController } from "../controllers/apc.controller";
import cron from "node-cron";
import Printer from "../utils/utils";
const print = new Printer("generate-contract");

const task = async () => {
    try {
        const db = new DbController(true);

        print.log(`Starting generate contract ===================================================================`);
        const rows = await db.getDataWithoutContract();
        print.log(`STEP 0 | DATA WITHOUT CONTRACT: ${rows.length}`)
        print.log("STEP 0 | GENERATE CONTRACT")

        print.log("-----------------")

        const queue_base = [];
        for (const row of rows) {
            print.log(`STEP 0 | PROCESS ${row.id}`)
            const query = db.generateContract(row);
            queue_base.push(query);
        }

        print.log("-----------------")

        const responses_base = await Promise.allSettled(queue_base);
        const success_base: any[] = [];
        const error_base: any[] = [];

        const update_contract: Promise<void>[] = [];
        responses_base.forEach((response: any, index) => {
            if (response.status === 'fulfilled' && response.value) {
                success_base.push({ ...rows[index], contract_id: response.value });
                update_contract.push(db.updateField(rows[index].id, 'contract_id', Number(response.value)));
                print.log(`STEP 0 | SUCCESS ${rows[index].id} - ${response.value} `)
            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_contract.push(db.updateField(rows[index].id, 'error_reason', error_message));
                error_base.push(rows[index]);
                print.error(`STEP 0 | ERROR ${rows[index].id} ${error_message}`)
            }
        });

        await Promise.all([
            ...update_contract,
            db.setProcess(success_base, 1),
            db.successStep(success_base, 1),
            db.failedStep(error_base)
        ])

        print.log("-----------------")
        print.log(`STEP 0 | TOTAL SUCCESS: ${success_base.length}`);
        print.log(`STEP 0 | TOTAL ERROR: ${responses_base.length - success_base.length}`);
        print.log(`STEP 0 | UPDATE ${success_base.length} ROWS TO STEP 1`)
        print.log("-----------------")

        print.log("STEP 1 | UPLOAD UPLOAD APC ============================")
        const toUploadAPC = await db.getDataByStep(1);
        print.log(`STEP 1 | DATA TO LOAD UPLOAD APC: ${toUploadAPC.length}`)

        print.log("-----------------")

        const apc_queue = [];
        for (const item of toUploadAPC) {
            if (item.s3_apc_path) {
                print.log(`STEP 1 | PROCESS ${item.id} - ${item.contract_id}`)
                const query = db.uploadAuthContract(item.contract_id, item.s3_apc_path);
                apc_queue.push(query);
            } else {
                print.log(`STEP 1 | ${item.id} no tiene s3_apc_path o apc_signature`)
                apc_queue.push(Promise.resolve({ code: 'NO_APC_AUTH' }))
            }
        }
        print.log("-----------------")

        const responses_invoice = await Promise.allSettled(apc_queue);
        const success_apc: any[] = [];
        const error_apc: any[] = [];
        const update_msg_invoice: any = [];

        responses_invoice.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_apc.push(toUploadAPC[index]);
                print.log(`STEP 1 | SUCCESS ${toUploadAPC[index].id} - ${toUploadAPC[index].contract_id}`)

            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_msg_invoice.push(db.updateField(toUploadAPC[index].id, 'error_reason', error_message));
                error_apc.push(toUploadAPC[index]);
                print.error(`STEP 1 | ERROR ${toUploadAPC[index].id} - ${toUploadAPC[index].contract_id} ${error_message}`)
            }
        });
        await Promise.all([
            ...update_msg_invoice,
            db.setProcess(success_base, 2),
            db.successStep(success_apc, 2),
            db.failedStep(error_apc)
        ])

        print.log("-----------------")
        print.log(`STEP 1 | TOTAL SUCCESS: ${success_apc.length}`);
        print.log(`STEP 1 | TOTAL ERROR: ${responses_invoice.length - success_apc.length}`);
        print.log(`STEP 1 | UPDATE ${success_apc.length} ROWS TO STEP 2`)
        print.log("-----------------")


        print.log(`End of generate contract ===================================================================`)
        await db.disconnect();
    } catch (e) {
        print.log(`Error: ${typeof e === 'object' ? JSON.stringify(e) : e}`)
    }


    
}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CRON_APC) {
        console.log("init paperless as", process.env.CRON_APC)
        cron.schedule(process.env.CRON_APC, () => task())
    }
}
