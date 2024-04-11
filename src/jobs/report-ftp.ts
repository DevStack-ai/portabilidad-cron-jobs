import { FtpController } from "../controllers/ftp.controller";
import { DbController } from "../controllers/db.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import moment from "moment";
import log from "../utils/utils";

(async () => {
    try {
        log(`Starting report ftp`);
        const ftp = new FtpController();
        const db = new DbController();


        const host = process.env.FTP_HOST;
        const port = Number(process.env.FTP_PORT);
        const username = process.env.FTP_USER;
        const password = process.env.FTP_PASS;

        if (!host || !port || !username || !password) {
            throw new Error("FTP settings are not set in .env file");
        }

        log(`Connecting to FTP`);
        await ftp.connect({ host, port, username, password });
        log(`Connected to FTP`);


        log(`Fetch from database`);
        const data = await db.getReport();
        log(`Fetched: ${data.length} records`);

        const ids = data.map((item: any) => item.IDISOFT)
        log(`Converted to CSV`);
        const csv = json2csv(data);
        if (!csv) {
            log(`No data to write`);
            return
        }

        const today = moment().format("YYYYMMDDHHmmss")
        const filename = `DIGI_POSTPORT_${today}.csv`;
        const dir = `${process.env.TMP_DIR}/${filename}`
        log(`Writing to file: ${dir}`);

        fs.writeFileSync(dir, csv, { encoding: 'utf-8' });
        log(`File written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        log(`Uploading to FTP: ${toPath}`)
        await ftp.uploadFile(dir, toPath);

        log(`Uploaded successfully`);
        log('Updating database');
        await db.updateReport(ids);
        log(`Database updated`);

        log(`End of report ftp`)
    } catch (e) {
        console.log(e)
        log(`Error: ${e}`)
    }

})();