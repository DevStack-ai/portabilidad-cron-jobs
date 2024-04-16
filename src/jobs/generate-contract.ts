import { DbController } from "../controllers/db.controller";
import { PaperlessController } from "../controllers/paperless.controller";
import log from "../utils/utils";
import { ISOFT_INPUT } from "@prisma/client";
import cron from "node-cron";

cron.schedule("* * * * *", async () => {
    try {
        const db = new DbController();
        const paperless = new PaperlessController();

        log(`Starting generate contract ===================================================================`);
        const rows = await db.getDataWithoutContract();
        log(`STEP 0 | DATA WITHOUT CONTRACT: ${rows.length}`)
        log("STEP 0 | GENERATE CONTRACT")
        const queue_base = [];
        log("-----------------")

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

            log(`STEP 0 | PROCESS ${row.IDISOFT}`)
            const query = paperless.generateContract(contract);
            queue_base.push(query);
        }
        log("-----------------")


        const responses_base = await Promise.allSettled(queue_base);
        const success_base: any = [];
        const error_base: ISOFT_INPUT[] = [];

        const update_contract: Promise<void>[] = [];
        responses_base.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                if (typeof response.value === 'number') {
                    success_base.push({ ...rows[index], CONTRACT_ID: response.value });
                    const update = db.updateField(rows[index].IDISOFT, 'CONTRACT_ID', String(response.value));
                    update_contract.push(update);
                    const updateContract = db.updateField(rows[index].IDISOFT, 'CONTRATO_GENERADO', 1);
                    update_contract.push(updateContract);
                    log(`STEP 0 | SUCCESS ${rows[index].IDISOFT} - ${response.value} `)
                }
            } else {
                error_base.push(rows[index]);
                log(`STEP 0 | ERROR ${rows[index].IDISOFT}`)
            }
        });

        log("-----------------")
        log(`STEP 0 | TOTAL SUCCESS: ${success_base.length}`);
        log(`STEP 0 | TOTAL ERROR: ${responses_base.length - success_base.length}`);

        await Promise.all([
            ...update_contract,
            db.successStep(success_base.map((item: any) => item.IDISOFT), 1),
            db.failedProcess(error_base.map((item: any) => item.IDISOFT))
        ])
        log(`STEP 0 | UPDATE ${success_base.length} ROWS TO STEP 1`)
        log("-----------------")

        log("STEP 1 | STEP UPLOAD FILES CONTRACT  ============================")

        const withoutSPN = await db.getDataByStep(1);
        log(`STEP 1 | DATA TO LOAD/GENERATE SPN: ${withoutSPN.length}`)

        const queue_spn = [];
        log("-----------------")

        for (const item of withoutSPN) {
            if (item.CONTRACT_ID === null) {
                log(`STEP 1 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }

            log(`STEP 1 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
            let path = item.s3_spn_path
            if (!path) {
                log(`STEP 1 | ${item.IDISOFT} no tiene s3_spn_path`)
                const url = await paperless.getSPN(item);
                path = url
            }

            const query = paperless.uploadSPN(item.IDISOFT, item.CONTRACT_ID, path);
            queue_spn.push(query);
        }

        log("-----------------")
        const responses_spn = await Promise.allSettled(queue_spn);
        const success_spn: ISOFT_INPUT[] = [];
        const error_spn: ISOFT_INPUT[] = [];

        responses_spn.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_spn.push(withoutSPN[index]);
                log(`STEP 1 | SUCCESS ${withoutSPN[index].IDISOFT} - ${withoutSPN[index].CONTRACT_ID}`)
            } else {
                error_spn.push(withoutSPN[index]);
                log(`STEP 1 | ERROR ${withoutSPN[index].IDISOFT} -${withoutSPN[index].CONTRACT_ID}`)
            }
        });
        log("-----------------")
        log(`STEP 1 | TOTAL SUCCESS: ${success_spn.length}`);
        log(`STEP 1 | TOTAL ERROR: ${responses_spn.length - success_spn.length}`);

        await Promise.all([
            db.successStep(success_spn.map((item: any) => item.IDISOFT), 2),
            db.failedProcess(error_spn.map((item: any) => item.IDISOFT))
        ])
        log(`STEP 1 | UPDATE ${success_spn.length} ROWS TO STEP 2`)
        log("-----------------")

        log("STEP 2 | UPLOAD ID ============================")
        const withId = await db.getDataByStep(2);
        log(`STEP 2 | DATA TO LOAD ID: ${withId.length}`)

        const queue_id = [];
        log("-----------------")

        for (const item of withId) {
            if (item.CONTRACT_ID === null) {
                log(`STEP 2 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }
            if (item.s3_front_document !== null) {
                log(`STEP 2 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
                const query = paperless.uploadId(item.CONTRACT_ID, item.s3_front_document, item.PRE_POST ?? 'PRE');
                queue_id.push(query);
            } else {
                log(`STEP 2 | ${item.IDISOFT} no tiene s3_front_document`)

            }
        }
        log("-----------------")

        const responses_id = await Promise.allSettled(queue_id);
        const success_id: ISOFT_INPUT[] = [];
        const error_id: ISOFT_INPUT[] = [];

        responses_id.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_id.push(withId[index]);
                log(`STEP 2 | SUCCESS ${withId[index].IDISOFT} - ${withId[index].CONTRACT_ID}`)

            } else {
                error_id.push(withId[index]);
                log(`STEP 2 | ERROR ${withId[index].IDISOFT} - ${withId[index].CONTRACT_ID}`)

            }
        });
        log("-----------------")
        log(`STEP 2 | TOTAL SUCCESS: ${success_id.length}`);
        log(`STEP 2 | TOTAL ERROR: ${responses_id.length - success_id.length}`);

        await Promise.all([
            db.successStep(success_id.map((item: any) => item.IDISOFT), 3),
            db.failedProcess(error_id.map((item: any) => item.IDISOFT))
        ])
        log(`STEP 2 | UPDATE ${success_id.length} ROWS TO STEP 3`)
        log("-----------------")


        log("STEP 3 | UPLOAD LAST INVOICE ============================")
        const toUploadInvoice = await db.getDataByStepPostpaid(3);
        log(`STEP 3 | DATA TO LOAD LAST INVOICE: ${toUploadInvoice.length}`)

        const queue_invoice = [];
        log("-----------------")
        for (const item of toUploadInvoice) {
            if (item.CONTRACT_ID === null) {
                log(`STEP 3 | ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }
            log(`STEP 3 | PROCESS ${item.IDISOFT} - ${item.CONTRACT_ID}`)
            const query = paperless.uploadLastContract(item.IDISOFT, item.CONTRACT_ID);
            queue_invoice.push(query);
        }
        log("-----------------")
        const responses_invoice = await Promise.allSettled(queue_invoice);
        const success_invoice: ISOFT_INPUT[] = [];
        const error_invoice: ISOFT_INPUT[] = [];

        responses_invoice.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                success_invoice.push(toUploadInvoice[index]);
                log(`STEP 3 | SUCCESS ${toUploadInvoice[index].IDISOFT} - ${toUploadInvoice[index].CONTRACT_ID}`)

            } else {
                error_invoice.push(toUploadInvoice[index]);
                log(`STEP 3 | ERROR ${toUploadInvoice[index].IDISOFT} - ${toUploadInvoice[index].CONTRACT_ID}`)
            }
        });
        log("-----------------")
        log(`STEP 3 | TOTAL SUCCESS: ${success_invoice.length}`);
        log(`STEP 3 | TOTAL ERROR: ${responses_invoice.length - success_invoice.length}`);
        log("-----------------")

        await Promise.all([
            db.successStep(success_invoice.map((item: any) => item.IDISOFT), 4),
            db.failedProcess(error_spn.map((item: any) => item.IDISOFT))
        ])
        log(`STEP 3 | UPDATE ${success_invoice.length} ROWS TO STEP 4`)
        log(`End of generate contract ===================================================================`)
    } catch (e) {
        log(`Error: ${e}`)
    }
})

