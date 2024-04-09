import { FtpController } from "../controllers/ftp.controller";
import { DbController } from "../controllers/db.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import log from "../utils/utils";

async function main() {
    try {

        log(`Starting report ftp`);
        const ftp = new FtpController();
        const db = new DbController();

        log(`Fetch from database`);
        const data = await db.getData();
        log(`Fetched: ${data.length} records`);

        log(`Converted to CSV`);
        const csv = json2csv(data);

        const today = new Date().toJSON()
        const filename = `${today}_data.csv`;
        const dir = `${__dirname}/${process.env.TMP_DIR}/${filename}`
        log(`Writing to file: ${dir}`);

        fs.writeFileSync(dir, csv);
        log(`File written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        log(`Uploading to FTP: ${toPath}`)
        await ftp.upload(dir, toPath);
        log(`Uploaded successfully`);

        log(`End of report ftp`)
    } catch (e) {
        log(`Error: ${e}`)
    }
}

main()