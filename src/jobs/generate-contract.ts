import { DbController } from "../controllers/db.controller";
import { PaperlessController } from "../controllers/paperless.controller";
import fs from "fs";
import log from "../utils/utils";
import { ISOFT_INPUT } from "@prisma/client";

(async () => {
    try {
        const db = new DbController();
        const paperless = new PaperlessController();

        log(`Starting generate contract ===================================================================`);
        const rows = await db.getDataWithoutContract();
        log(`Data without contract: ${rows.length}`)

        log("STEP GENERATE CONTRACT")
        const queue_base = [];
        for (const row of rows) {
            const contract = {
                request_number: row.IDISOFT,
                date: row.FECHA_REGISTRO,
                client_name: row.NOMBRE_DE_CLIENTE,
                id: row.CEDULA,
                address: row.DIRECCION_CLIENTE,
                ctn: row.MSISDN,
                email: row.EMAIL_DEL_CLIENTE,
                type: row.PRE_POST
            }

            const query = paperless.generateContract(contract);
            queue_base.push(query);
        }

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
                }
            } else {
                error_base.push(rows[index]);
            }
        });

        log(`Success: ${success_base.length}`);
        log(`Error: ${responses_base.length - success_base.length}`);

        await Promise.all([
            ...update_contract,
            db.successStep(success_base.map((item: any) => item.IDISOFT), 1),
            db.failedProcess(error_base.map((item: any) => item.IDISOFT))
        ])

        log("STEP UPLOAD FILES CONTRACT")

        const withoutSPN = await db.getDataByStep(1);
        log(`Data to load SPN: ${withoutSPN.length}`)

        const queue_spn = [];
        for (const item of withoutSPN) {
            if (item.CONTRACT_ID === null) {
                log(`Error: ${item.IDISOFT} no tiene CONTRACT_ID`)
                continue;
            }
            const query = paperless.uploadSPN(item.IDISOFT, item.CONTRACT_ID, item.s3_spn_path);
            queue_spn.push(query);
        }

        const responses_spn = await Promise.allSettled(queue_spn);
        const success_spn: ISOFT_INPUT[] = [];
        const error_spn: ISOFT_INPUT[] = [];

        responses_spn.forEach((response, index) => {
            console.log(response)
            if (response.status === 'fulfilled') {
                success_spn.push(withoutSPN[index]);
            }else{
                error_spn.push(withoutSPN[index]);
            }
        });

        log(`Success: ${success_spn.length}`);
        log(`Error: ${responses_spn.length - success_spn.length}`);

        await Promise.all([
            db.successStep(success_spn.map((item: any) => item.IDISOFT), 2),
            db.failedProcess(error_spn.map((item: any) => item.IDISOFT))
        ])


        
        // const queue_files = [];
        // for (const item of success_base) {

        //     if (item.s3_front_document === null) {
        //         log(`Error: ${item.IDISOFT} no tiene s3_front_document`)
        //         continue;
        //     }

        //     const query = paperless.uploadId(item.s3_front_document);
        //     queue_files.push(query);
        // }



        // //update failed files
        // const responses_files = await Promise.allSettled(queue_files);

        // const success_files: any = [];

        // responses_files.forEach((response, index) => {
        //     if (response.status === 'fulfilled') {
        //         success_files.push(success_base[index]);
        //     }
        // });

        // log(`Success: ${success_files.length}`);
        // log(`Error: ${responses_files.length - success_files.length}`);

        // //update failed files
        // await db.successStep(success_base.map((item: any) => item.IDISOFT), 1)


        // //update failed files



        log(`End of generate contract ===================================================================`)
    } catch (e) {
        console.log(e)
        log(`Error: ${e}`)
    }

})();