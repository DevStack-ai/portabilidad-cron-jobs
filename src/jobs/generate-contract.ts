import "dotenv/config";
import { DbController } from "../controllers/db.controller";
import { PaperlessController } from "../controllers/paperless.controller";
import { ISOFT_INPUT } from "@prisma/client";
import cron from "node-cron";
import Printer from "../utils/utils";
import { json2csv } from "../utils/json2csv";
const print = new Printer("generate-contract");

const task = async (ORACLE_STATUS: number = 0) => {
    try {
        const db = new DbController();
        const paperless = new PaperlessController();

        print.log(`Starting generate contract ===================================================================`);
        const rows = await db.getDataWithoutContract(ORACLE_STATUS);
        print.log(`STEP 0 | DATA WITHOUT CONTRACT: ${rows.length}`)
        print.log("STEP 0 | GENERATE CONTRACT")
        const queue_base = [];
        print.log("-----------------")

        for (const row of rows) {
            const contract = {
                request_number: row.IDISOFT,
                date: row.FECHA_REGISTRO,
                client_name: row.NOMBRE_DE_CLIENTE,
                id: row.CEDULA,
                address: row.DIRECCION_CLIENTE,
                ctn: row.MSISDN,
                email: row.EMAIL_DEL_CLIENTE,
                type: "POST"//row.PRE_POST
            }

            print.log(`STEP 0 | PROCESS ${row.IDISOFT}`)
            const query = paperless.generateContract(contract);
            queue_base.push(query);
        }
        print.log("-----------------")


        const responses_base = await Promise.allSettled(queue_base);
        const success_base: any = [];
        const error_base: ISOFT_INPUT[] = [];
        const update_msg_base: any = [];

        const update_contract: Promise<void>[] = [];
        responses_base.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                if (typeof response.value === 'number') {
                    success_base.push({ ...rows[index], CONTRACT_ID: response.value });
                    const update = db.updateField(rows[index].IDISOFT, 'CONTRACT_ID', String(response.value));
                    update_contract.push(update);
                    const updateContract = db.updateField(rows[index].IDISOFT, 'CONTRATO_GENERADO', 1);
                    update_contract.push(updateContract);
                    print.log(`STEP 0 | SUCCESS ${rows[index].IDISOFT} - ${response.value} `)
                }
            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_msg_base.push(db.updateField(rows[index].IDISOFT, 'paperless_message', error_message));
                error_base.push(rows[index]);
                print.error(`STEP 0 | ERROR ${rows[index].IDISOFT} ${error_message}`)
            }
        });

        print.log("-----------------")
        print.log(`STEP 0 | TOTAL SUCCESS: ${success_base.length}`);
        print.log(`STEP 0 | TOTAL ERROR: ${responses_base.length - success_base.length}`);

        await Promise.all([
            ...update_contract,
            ...update_msg_base,
            db.successStep(success_base.map((item: any) => item.IDISOFT), 1),
            db.failedProcess(error_base.map((item: any) => item.IDISOFT))
        ])
        print.log(`STEP 0 | UPDATE ${success_base.length} ROWS TO STEP 1`)
        print.log("-----------------")

        print.log("STEP 1 | STEP UPLOAD FILES CONTRACT  ============================")

        const withoutSPN = await db.getDataByStep(1, ORACLE_STATUS);
        print.log(`STEP 1 | DATA TO LOAD/GENERATE SPN: ${withoutSPN.length}`)

        const queue_spn = [];
        print.log("-----------------")

        for (const item of withoutSPN) {
            if (item.CONTRACT_ID === null) {
                print.log(`STEP 1 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }

            print.log(`STEP 1 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
            let path = item.s3_spn_path
            if (!path) {
                print.log(`STEP 1 | ${item.IDISOFT} no tiene s3_spn_path`)
                const url = await paperless.getSPN(item);
                path = url
            }

            const query = paperless.uploadSPN(item.IDISOFT, item.CONTRACT_ID, path);
            queue_spn.push(query);
        }

        print.log("-----------------")
        const responses_spn = await Promise.allSettled(queue_spn);
        const success_spn: ISOFT_INPUT[] = [];
        const error_spn: ISOFT_INPUT[] = [];
        const update_msg_spn: any = [];

        responses_spn.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_spn.push(withoutSPN[index]);
                print.log(`STEP 1 | SUCCESS ${withoutSPN[index].IDISOFT} - ${withoutSPN[index].CONTRACT_ID}`)
            } else {
                const is_error_recognized = response.reason?.response?.data?.message?.includes('Duplicate attachments for contracts are not allowed');

                if (is_error_recognized) {
                    print.log(`STEP 1 | ${withoutSPN[index].IDISOFT} - ${withoutSPN[index].CONTRACT_ID} ya tiene el SPN`)
                    success_spn.push(withoutSPN[index]);
                } else {
                    const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                    update_msg_spn.push(db.updateField(withoutSPN[index].IDISOFT, 'paperless_message', error_message));
                    error_spn.push(withoutSPN[index]);
                    print.error(`STEP 1 | ERROR ${withoutSPN[index].IDISOFT} - ${withoutSPN[index].CONTRACT_ID} ${error_message}`)
                }

            }
        });
        print.log("-----------------")
        print.log(`STEP 1 | TOTAL SUCCESS: ${success_spn.length}`);
        print.log(`STEP 1 | TOTAL ERROR: ${responses_spn.length - success_spn.length}`);

        await Promise.all([
            ...update_msg_spn,
            db.successStep(success_spn.map((item: any) => item.IDISOFT), 2),
            db.failedProcess(error_spn.map((item: any) => item.IDISOFT))
        ])
        print.log(`STEP 1 | UPDATE ${success_spn.length} ROWS TO STEP 2`)
        print.log("-----------------")

        print.log("STEP 2 | UPLOAD ID ============================")
        const withId = await db.getDataByStep(2, ORACLE_STATUS);
        print.log(`STEP 2 | DATA TO LOAD ID: ${withId.length}`)

        const queue_id = [];
        print.log("-----------------")

        for (const item of withId) {
            if (item.CONTRACT_ID === null) {
                print.log(`STEP 2 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }
            if (item.s3_front_document !== null) {
                print.log(`STEP 2 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
                const query = paperless.uploadId(item.CONTRACT_ID, item.s3_front_document, item.PRE_POST ?? 'PRE');
                queue_id.push(query);
            } else {
                print.log(`STEP 2 | ${item.IDISOFT} no tiene s3_front_document`)
                queue_id.push(Promise.reject({ code: 'NO_CONTRACT' }))
            }
        }
        print.log("-----------------")

        const responses_id = await Promise.allSettled(queue_id);
        const success_id: ISOFT_INPUT[] = [];
        const error_id: ISOFT_INPUT[] = [];
        const update_msg_id: any = [];

        responses_id.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_id.push(withId[index]);
                print.log(`STEP 2 | SUCCESS ${withId[index].IDISOFT} - ${withId[index].CONTRACT_ID}`)

            } else {
                const is_error_recognized = response.reason?.response?.data?.message?.includes('Duplicate attachments for contracts are not allowed');

                if (is_error_recognized) {
                    print.log(`STEP 2 | ${withId[index].IDISOFT} - ${withId[index].CONTRACT_ID} ya tiene el ID`)
                    success_id.push(withId[index]);
                } else {
                    const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                    update_msg_id.push(db.updateField(withId[index].IDISOFT, 'paperless_message', error_message));
                    error_id.push(withId[index]);
                    print.error(`STEP 2 | ERROR ${withId[index].IDISOFT} - ${withId[index].CONTRACT_ID} ${error_message}`)
                }
            }
        });
        print.log("-----------------")
        print.log(`STEP 2 | TOTAL SUCCESS: ${success_id.length}`);
        print.log(`STEP 2 | TOTAL ERROR: ${responses_id.length - success_id.length}`);

        await Promise.all([
            ...update_msg_id,
            db.successStep(success_id.map((item: any) => item.IDISOFT), 3),
            db.failedProcess(error_id.map((item: any) => item.IDISOFT))
        ])
        print.log(`STEP 2 | UPDATE ${success_id.length} ROWS TO STEP 3`)
        print.log("-----------------")


        print.log("STEP 3 | UPLOAD LAST INVOICE ============================")
        const toUploadInvoice = await db.getDataByStepPostpaid(3, ORACLE_STATUS);
        print.log(`STEP 3 | DATA TO LOAD LAST INVOICE: ${toUploadInvoice.length}`)

        const queue_invoice = [];
        print.log("-----------------")

        for (const item of toUploadInvoice) {
            if (item.port_type_id === 3 || item.port_type_id === 5) {
                queue_invoice.push(Promise.resolve({ status: 'fulfilled', item: item }))
            } else {
                if (item.CONTRACT_ID === null) {
                    print.log(`STEP 3 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                    queue_invoice.push(Promise.reject({ code: 'NO_CONTRACT' }))
                } else {
                    print.log(`STEP 3 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
                    const query = paperless.uploadLastContract(item, item.CONTRACT_ID);
                    queue_invoice.push(query);
                }
            }
        }
        const queue_auth2 = [];
        for (const item of toUploadInvoice) {

            if (item.CONTRACT_ID === null) {
                print.log(`STEP 3.5 | ${item.TRANSACTION_ID} no tiene CONTRACTID`)
                queue_auth2.push(Promise.reject({ code: 'NO_CONTRACT' }))
                continue;
            }

            const url_generated = await paperless.generateAuthContract(item.TRANSACTION_ID, 3)
            if (url_generated) {
                const query = paperless.uploadAuthApcContract(item.CONTRACT_ID, url_generated);
                queue_auth2.push(query);
            } else {
                print.log(`STEP 3.5 | ${item.TRANSACTION_ID} no tiene s3_apc_path o apc_signature`)
                queue_auth2.push(Promise.resolve({ code: 'NO_APC_AUTH' }))
            }
        }
        print.log("-----------------")
        await Promise.allSettled(queue_auth2)
        const responses_invoice = await Promise.allSettled(queue_invoice);
        const success_invoice: ISOFT_INPUT[] = [];
        const error_invoice: ISOFT_INPUT[] = [];
        const update_msg_invoice: any = [];

        responses_invoice.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_invoice.push(toUploadInvoice[index]);
                print.log(`STEP 3 | SUCCESS ${toUploadInvoice[index].IDISOFT} - ${toUploadInvoice[index].CONTRACT_ID}`)

            } else {

                const is_error_recognized = response.reason?.response?.data?.message?.includes('Duplicate attachments for contracts are not allowed');
                if (is_error_recognized) {
                    print.log(`STEP 3 | ${toUploadInvoice[index].IDISOFT} - ${toUploadInvoice[index].CONTRACT_ID} ya tiene la factura`)
                    success_invoice.push(toUploadInvoice[index]);
                } else {
                    const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                    update_msg_invoice.push(db.updateField(toUploadInvoice[index].IDISOFT, 'paperless_message', error_message));
                    error_invoice.push(toUploadInvoice[index]);
                    print.error(`STEP 3 | ERROR ${toUploadInvoice[index].IDISOFT} - ${toUploadInvoice[index].CONTRACT_ID} ${error_message}`)
                }

            }
        });
        print.log("-----------------")
        print.log(`STEP 3 | TOTAL SUCCESS: ${success_invoice.length}`);
        print.log(`STEP 3 | TOTAL ERROR: ${responses_invoice.length - success_invoice.length}`);
        print.log("-----------------")

        await Promise.all([
            ...update_msg_invoice,
            db.successStep(success_invoice.map((item: any) => item.IDISOFT), 4),
            db.failedProcess(error_invoice.map((item: any) => item.IDISOFT))
        ])
        print.log(`STEP 3 | UPDATE ${success_invoice.length} ROWS TO STEP 4`)

        print.log("-----------------")

        print.log("STEP 4 | UPLOAD CONTRACT ============================")
        const toUploadContract = await db.getDataByStepPostpaid(4, ORACLE_STATUS);

        print.log(`STEP 4 | DATA TO LOAD CONTRACT: ${toUploadContract.length}`)

        const queue_contract = [];
        print.log("-----------------")

        for (const item of toUploadContract) {
            if (item.port_type_id === 3) {
                queue_contract.push(Promise.resolve({ status: 'fulfilled', item: item }))
                continue;
            }
            if (item.CONTRACT_ID === null) {
                print.log(`STEP 4 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }
            if (item.s3_contract_path === null) {
                print.log(`STEP 4 | ${item.IDISOFT} no tiene s3_contract_path`)
                continue;
            }
            print.log(`STEP 4 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
            const query = paperless.uploadContract(item.CONTRACT_ID, item.s3_contract_path);
            queue_contract.push(query);
        }
        print.log("-----------------")

        const responses_contract = await Promise.allSettled(queue_contract);
        const success_contract: ISOFT_INPUT[] = [];
        const error_contract: ISOFT_INPUT[] = [];

        responses_contract.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_contract.push(toUploadContract[index]);
                print.log(`STEP 4 | SUCCESS ${toUploadContract[index].IDISOFT} - ${toUploadContract[index].CONTRACT_ID}`)

            } else {
                const is_error_recognized = response.reason?.response?.data?.message?.includes('Duplicate attachments for contracts are not allowed');
                if (is_error_recognized) {
                    print.log(`STEP 4 | ${toUploadContract[index].IDISOFT} - ${toUploadContract[index].CONTRACT_ID} ya tiene el contrato`)
                    success_contract.push(toUploadContract[index]);
                } else {
                    error_contract.push(toUploadContract[index]);
                    print.error(`STEP 4 | ERROR ${toUploadContract[index].IDISOFT} - ${toUploadContract[index].CONTRACT_ID} ${response.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`)
                }
            }
        });

        print.log("-----------------")

        print.log(`STEP 4 | TOTAL SUCCESS: ${success_contract.length}`);
        print.log(`STEP 4 | TOTAL ERROR: ${responses_contract.length - success_contract.length}`);

        await Promise.all([
            db.successStep(success_contract.map((item: any) => item.IDISOFT), 5),
            db.failedProcess(error_contract.map((item: any) => item.IDISOFT))
        ])

        print.log(`STEP 4 | UPDATE ${success_contract.length} ROWS TO STEP 5`)

        print.log("-----------------")
        print.log(`STEP 5 | Fetch from database`);
        const data = await db.getReport(ORACLE_STATUS);
        const billgroup = await db.getBillGroup();

        print.log(`STEP 5 | Fetched: ${data.length} records`);

        const lines = data.map((item: any) => {
            const copy = { ...item }

            const liberate_value = copy.liberate_value
            const source = copy.source
            const mrc = copy.mrc
            const mrc_n = copy.mrc_n
            const mrc_amount = copy.mrc_amount
            const fmc_account = copy.fmc_account
            const fmc_type = copy.fmc_type
            const calculated_amount = copy.calculated_amount
            const fmc_order = copy.fmc_order
            const apc_ws_amount = copy.apc_ws_amount

            delete copy.TRANSACTION_ID
            delete copy.plan_type
            delete copy.liberate_value
            delete copy.source
            delete copy.mrc
            delete copy.mrc_n
            delete copy.mrc_amount
            delete copy.fmc_account
            delete copy.fmc_type
            delete copy.calculated_amount
            delete copy.apc_ws_amount
            delete copy.fmc_order

            copy.BILLGROUP = billgroup
            copy.area_code = copy.area_code || 'W3'
            // let proxy = "&"//plan_type
            let line = `${json2csv([{ ...copy }])},,,,,,,0,0,0,N,12,R,${liberate_value},${fmc_account || 0}`          //if last character is a comma, remove it
            if (line.slice(-1) === ',') {
                line = line.slice(0, -1)
            }

            return {
                ...item,
                fmc_account,
                fmc_type,
                calculated_amount,
                apc_ws_amount,
                fmc_order: fmc_order,
                TRANSACTION_ID: Number(item.TRANSACTION_ID),
                transaction_id: Number(item.TRANSACTION_ID),
                contractid: Number(item.contract_id),
                source: source,
                mrc: mrc,
                mrc_n: mrc_n,
                mrc_amount: mrc_amount,
                file_content: line,
                liberateLine: line
            }
        })
        console.log(lines)
        print.log(`STEP 5 | Converted to CSV and update`);
        await db.updateLine(lines);

        print.log(`End of generate contract ===================================================================`)
        await db.disconnect();
    } catch (e) {
        print.log(`Error: ${typeof e === 'object' ? JSON.stringify(e) : e}`)
    }
}

if (process.argv.includes('--manual')) {
    task(20)
} else {
    if (process.env.CRON_PAPERLESS) {
        console.log("init paperless as", process.env.CRON_PAPERLESS)
        cron.schedule(process.env.CRON_PAPERLESS, () => task(0))
    }
}
