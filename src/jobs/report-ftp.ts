import { FtpController } from "../controllers/ftp.controller";
import { DbController } from "../controllers/db.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import moment from "moment";
import log from "../utils/utils";

async function main() {
    try {
        log(`Starting report ftp`);
        const ftp = new FtpController();
        const db = new DbController();

        log(`Fetch from database`);
        const data = await db.getReport();
        log(`Fetched: ${data.length} records`);

        log(`Converted to CSV`);
        const csv = json2csv(data);
        if(!csv) {
            log(`No data to write`);
            return
        }

        const today = moment().format("YYYYMMDDHHmmss")
        const filename = `DIGI_POSTPORT_${today}.csv`;
        const dir = `${process.env.TMP_DIR}/${filename}`
        log(`Writing to file: ${dir}`);

        fs.writeFileSync(dir, csv);
        log(`File written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        log(`Uploading to FTP: ${toPath}`)
        await ftp.upload(dir, toPath);
        log(`Uploaded successfully`);
        fs.unlinkSync(dir);
        log(`End of report ftp`)
    } catch (e) {
        console.log(e)
        log(`Error: ${e}`)
    }
}

main()