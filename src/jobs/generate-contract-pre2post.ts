import "dotenv/config";
import { Pre2Post, Pre2PostController } from "../controllers/prepost.controller";
import cron from "node-cron";
import Printer from "../utils/utils";
import { json2csv } from "../utils/json2csv";
const print = new Printer("generate-contract");

const task = async (ORACLE_STATUS: number = 0) => {
    try {
        const pre2post = new Pre2PostController();

        print.log(`Starting generate contract ===================================================================`);
        const rows = await pre2post.getDataWithoutContract(ORACLE_STATUS);
        print.log(`STEP 0 | DATA WITHOUT CONTRACT: ${rows.length}`)
        print.log("STEP 0 | GENERATE CONTRACT")
        const queue_base = [];
        print.log("-----------------")
        for (const row of rows) {
            let cedula = ""
            if (row.document_type === 1) {
                cedula = `${row.c_provincia || row.c_letra}-${row.c_folio}-${row.c_asiento}`
            } else if (row.document_type === 2) {
                cedula = `${row.passport}`
            } else {
                cedula = `${row.ruc}`
            }
            const contract = {
                ...row,
                request_number: row.TRANSACTION_ID,
                date: row.ADDED_ON,
                id: row.CEDULA,
                address: row.address,
                ctn: row.phone,
                cedula: cedula,
                type: "Portln Pre to Post Internal"//row.PRE_POST,
            }

            print.log(`STEP 0 | PROCESS ${row.TRANSACTION_ID}`)
            const query = pre2post.generateContract(contract, contract.type);
            queue_base.push(query);
        }
        print.log("-----------------")


        const responses_base = await Promise.allSettled(queue_base);
        const success_base: any = [];
        const error_base: Pre2Post[] = [];
        const update_msg_base: any = [];

        const update_contract: Promise<void>[] = [];
        responses_base.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                if (typeof response.value === 'number') {
                    success_base.push({ ...rows[index], CONTRACTID: response.value });
                    const update = pre2post.updateField(rows[index].TRANSACTION_ID, 'CONTRACTID', String(response.value));
                    update_contract.push(update);
                    const updateContract = pre2post.updateField(rows[index].TRANSACTION_ID, 'CONTRATO_GENERADO', 1);
                    update_contract.push(updateContract);
                    print.log(`STEP 0 | SUCCESS ${rows[index].TRANSACTION_ID} - ${response.value} `)
                }
            } else {
                const error_message = JSON.stringify(response.reason?.response?.data || response)
                update_msg_base.push(pre2post.updateField(rows[index].TRANSACTION_ID, 'paperless_message', error_message));
                error_base.push(rows[index]);
                print.error(`STEP 0 | ERROR ${rows[index].TRANSACTION_ID} ${error_message}`)
            }
        });

        print.log("-----------------")
        print.log(`STEP 0 | TOTAL SUCCESS: ${success_base.length}`);
        print.log(`STEP 0 | TOTAL ERROR: ${responses_base.length - success_base.length}`);

        await Promise.all([
            ...update_contract,
            ...update_msg_base,
            pre2post.successStep(success_base.map((item: any) => item.TRANSACTION_ID), 1),
            pre2post.failedProcess(error_base.map((item: any) => item.TRANSACTION_ID))
        ])
        print.log(`STEP 0 | UPDATE ${success_base.length} ROWS TO STEP 1`)
        print.log("-----------------")

        print.log("STEP 1 | STEP UPLOAD FILES CONTRACT  ============================")

        const withoutSPN = await pre2post.getDataByStep(1, ORACLE_STATUS);
        print.log(`STEP 1 | DATA TO LOAD/GENERATE SPN: ${withoutSPN.length}`)

        const queue_spn: any[] = [];
        print.log("-----------------")

        for (const item of withoutSPN) {
            queue_spn.push(Promise.resolve({ status: 'fulfilled', item: item }))
        }

        print.log("-----------------")
        const responses_spn = await Promise.allSettled(queue_spn);
        const success_spn: Pre2Post[] = [];
        const error_spn: Pre2Post[] = [];
        const update_msg_spn: any = [];

        responses_spn.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_spn.push(withoutSPN[index]);
                print.log(`STEP 1 | SUCCESS ${withoutSPN[index].TRANSACTION_ID} - ${withoutSPN[index].CONTRACTID}`)
            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_msg_spn.push(pre2post.updateField(withoutSPN[index].TRANSACTION_ID, 'paperless_message', error_message));
                error_spn.push(withoutSPN[index]);
                print.error(`STEP 1 | ERROR ${withoutSPN[index].TRANSACTION_ID} - ${withoutSPN[index].CONTRACTID} ${error_message}`)

            }
        });
        print.log("-----------------")
        print.log(`STEP 1 | TOTAL SUCCESS: ${success_spn.length}`);
        print.log(`STEP 1 | TOTAL ERROR: ${responses_spn.length - success_spn.length}`);

        await Promise.all([
            ...update_msg_spn,
            pre2post.successStep(success_spn.map((item: any) => item.TRANSACTION_ID), 2),
            pre2post.failedProcess(error_spn.map((item: any) => item.TRANSACTION_ID))
        ])
        print.log(`STEP 1 | UPDATE ${success_spn.length} ROWS TO STEP 2`)
        print.log("-----------------")

        print.log("STEP 2 | UPLOAD ID ============================")
        const withId = await pre2post.getDataByStep(2, ORACLE_STATUS);
        print.log(`STEP 2 | DATA TO LOAD ID: ${withId.length}`)

        const queue_id = [];
        print.log("-----------------")

        for (const item of withId) {
            if (item.CONTRACTID === null) {
                print.log(`STEP 2 | ${item.TRANSACTION_ID} no tiene CONTRACTID`)
                queue_id.push(Promise.reject({ code: 'NO_CONTRACT' }))
                continue;
            }
            if (item.s3_front_document !== null) {
                print.log(`STEP 2 | PROCESS ${item.TRANSACTION_ID} - ${item.CONTRACTID}`)
                const query = pre2post.uploadId(item.CONTRACTID, item.s3_front_document, "POST");
                queue_id.push(query);
            } else {
                print.log(`STEP 2 | ${item.TRANSACTION_ID} no tiene s3_front_document`)
                queue_id.push(Promise.reject({ code: 'NO_ID' }))
            }
        }
        print.log("-----------------")

        const responses_id = await Promise.allSettled(queue_id);
        const success_id: Pre2Post[] = [];
        const error_id: Pre2Post[] = [];
        const update_msg_id: any = [];

        responses_id.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_id.push(withId[index]);
                print.log(`STEP 2 | SUCCESS ${withId[index].TRANSACTION_ID} - ${withId[index].CONTRACTID}`)

            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_msg_id.push(pre2post.updateField(withId[index].TRANSACTION_ID, 'paperless_message', error_message));
                error_id.push(withId[index]);
                print.error(`STEP 2 | ERROR ${withId[index].TRANSACTION_ID} - ${withId[index].CONTRACTID} ${error_message}`)

            }
        });
        print.log("-----------------")
        print.log(`STEP 2 | TOTAL SUCCESS: ${success_id.length}`);
        print.log(`STEP 2 | TOTAL ERROR: ${responses_id.length - success_id.length}`);

        await Promise.all([
            ...update_msg_id,
            pre2post.successStep(success_id.map((item: any) => item.TRANSACTION_ID), 3),
            pre2post.failedProcess(error_id.map((item: any) => item.TRANSACTION_ID))
        ])
        print.log(`STEP 2 | UPDATE ${success_id.length} ROWS TO STEP 3`)
        print.log("-----------------")


        print.log("STEP 3 | UPLOAD AUTH PDF ============================")
        const toUploadInvoice = await pre2post.getDataByStep(3, ORACLE_STATUS);
        print.log(`STEP 3 | DATA TO LOAD AUTH PDF: ${toUploadInvoice.length}`)

        const queue_auth = [];
        print.log("-----------------")
        for (const item of toUploadInvoice) {

            if (item.CONTRACTID === null) {
                print.log(`STEP 3 | ${item.TRANSACTION_ID} no tiene CONTRACTID`)
                queue_auth.push(Promise.reject({ code: 'NO_CONTRACT' }))
                continue;
            }
            if (item.s3_auth_pdf_path === null) {
                print.log(`STEP 4 | ${item.TRANSACTION_ID} no tiene s3_auth_pdf_path`)
                queue_auth.push(Promise.reject({ code: 'NO_AUTH_CONTRACT' }))
                continue;
            }
            print.log(`STEP 4 | PROCESS ${item.TRANSACTION_ID} - ${item.CONTRACTID}`)
            const query = pre2post.uploadAuthContract(item.CONTRACTID, item.s3_auth_pdf_path);
            queue_auth.push(query);

        }
        print.log("-----------------")
        const responses_invoice = await Promise.allSettled(queue_auth);
        const success_invoice: Pre2Post[] = [];
        const error_invoice: Pre2Post[] = [];
        const update_msg_invoice: any = [];

        responses_invoice.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_invoice.push(toUploadInvoice[index]);
                print.log(`STEP 3 | SUCCESS ${toUploadInvoice[index].TRANSACTION_ID} - ${toUploadInvoice[index].CONTRACTID}`)

            } else {
                const error_message = `${response?.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`
                update_msg_invoice.push(pre2post.updateField(toUploadInvoice[index].TRANSACTION_ID, 'paperless_message', error_message));
                error_invoice.push(toUploadInvoice[index]);
                print.error(`STEP 3 | ERROR ${toUploadInvoice[index].TRANSACTION_ID} - ${toUploadInvoice[index].CONTRACTID} ${error_message}`)

            }
        });
        print.log("-----------------")
        print.log(`STEP 3 | TOTAL SUCCESS: ${success_invoice.length}`);
        print.log(`STEP 3 | TOTAL ERROR: ${responses_invoice.length - success_invoice.length}`);
        print.log("-----------------")

        await Promise.all([
            ...update_msg_invoice,
            pre2post.successStep(success_invoice.map((item: any) => item.TRANSACTION_ID), 4),
            pre2post.failedProcess(error_invoice.map((item: any) => item.TRANSACTION_ID))
        ])
        print.log(`STEP 3 | UPDATE ${success_invoice.length} ROWS TO STEP 4`)

        print.log("-----------------")

        print.log("STEP 4 | UPLOAD CONTRACT ============================")
        const toUploadContract = await pre2post.getDataByStep(4, ORACLE_STATUS);

        print.log(`STEP 4 | DATA TO LOAD CONTRACT: ${toUploadContract.length}`)

        const queue_contract = [];
        print.log("-----------------")

        for (const item of toUploadContract) {

            if (item.CONTRACTID === null) {
                print.log(`STEP 4 | ${item.TRANSACTION_ID} no tiene CONTRACTID`)
                queue_contract.push(Promise.reject({ code: 'NO_CONTRACT' }))
                continue;
            }
            if (item.s3_contract_path === null) {
                print.log(`STEP 4 | ${item.TRANSACTION_ID} no tiene s3_contract_path`)
                queue_contract.push(Promise.reject({ code: 'NO_S3_CONTRACT' }))
                continue;
            }
            print.log(`STEP 4 | PROCESS ${item.TRANSACTION_ID} - ${item.CONTRACTID}`)
            const query = pre2post.uploadContract(item.CONTRACTID, item.s3_contract_path);
            queue_contract.push(query);
        }
        print.log("-----------------")

        const responses_contract = await Promise.allSettled(queue_contract);
        const success_contract: Pre2Post[] = [];
        const error_contract: Pre2Post[] = [];

        responses_contract.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_contract.push(toUploadContract[index]);
                print.log(`STEP 4 | SUCCESS ${toUploadContract[index].TRANSACTION_ID} - ${toUploadContract[index].CONTRACTID}`)

            } else {
                error_contract.push(toUploadContract[index]);
                print.error(`STEP 4 | ERROR ${toUploadContract[index].TRANSACTION_ID} - ${toUploadContract[index].CONTRACTID} ${response.reason?.code} ${JSON.stringify(response.reason?.response?.data || response)}`)
            }
        });

        print.log("-----------------")

        print.log(`STEP 4 | TOTAL SUCCESS: ${success_contract.length}`);
        print.log(`STEP 4 | TOTAL ERROR: ${responses_contract.length - success_contract.length}`);

        await Promise.all([
            pre2post.successStep(success_contract.map((item: any) => item.TRANSACTION_ID), 5),
            pre2post.failedProcess(error_contract.map((item: any) => item.TRANSACTION_ID))
        ])

        print.log(`STEP 4 | UPDATE ${success_contract.length} ROWS TO STEP 5`)

        print.log("-----------------")

        print.log(`STEP 5 | Fetch from database`);
        const activations = await pre2post.getReportPortasPre2Post();
        print.log(`STEP 5 | Fetched v1: ${activations.length} records`);
        // const idsActivations = activations.map((item: any) => item.CONTRACTID)

        const lines = activations.map((item: any) => {
            const copy = { ...item }
            delete copy.TRANSACTION_ID
            let line = json2csv([{ ...copy }])
            //if last character is a comma, remove it
            if (line.slice(-1) === ',') {
                line = line.slice(0, -1)
            }

            return {
                ...item,
                liberateLine: line
            }
        })
        print.log(`STEP 5 | Converted to CSV and update`);
        await pre2post.updateLineP2P(lines)

        print.log(`STEP 5 | send lines to liberate`);
        const mapped = lines.map((item: any) => ({
            transaction_id: item.TRANSACTION_ID,
            file_content: item.liberateLine,
            msisdn: item.msisdn,
            contractid: item.CONTRACTID
        }))
        await pre2post.sendToLiberateP2P(mapped)
        print.log(`STEP 5 | send lines to liberate`);
        await pre2post.updateLineStepP2P(lines)

        await pre2post.disconnect();
        print.log(`End of generate contract ===================================================================`)

    } catch (e) {
        print.log(`Error: ${e}`)
    }
}

if (process.argv.includes('--manual')) {
    task(0)
} else {
    if (process.env.CRON_PAPERLESS) {
        console.log("init paperless as", process.env.CRON_PAPERLESS)
        cron.schedule(process.env.CRON_PAPERLESS, () => task(0))
    }
}
