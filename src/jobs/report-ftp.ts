import "dotenv/config";
import { FtpController } from "../controllers/ftp.controller";
import { DbController } from "../controllers/db.controller";

import { json2csv } from "../utils/json2csv";
import fs from "fs";
import moment from "moment";
import Printer from "../utils/utils";
import cron from "node-cron";

const print = new Printer("report-ftp");
const task = async () => {
    try {
        print.log(`Starting report ftp ===================================================================`);
        const ftp = new FtpController();
        const db = new DbController();

        const host = process.env.FTP_HOST;
        const port = Number(process.env.FTP_PORT);
        const username = process.env.FTP_USER;
        const password = process.env.FTP_PASS;

        if (!host || !port || !username || !password) {
            throw new Error("FTP settings are not set in .env file");
        }

        print.log(`Connecting to FTP`);
        await ftp.connect({ host, port, username, password });
        print.log(`Connected to FTP`);


        print.log(`Fetch from database`);
        const data = await db.getReport();
        print.log(`Fetched: ${data.length} records`);

        const ids = data.map((item: any) => item.IDISOFT)
        print.log(`Converted to CSV`);
        const csv = json2csv(data);
        if (!csv) {
            print.log(`No data to write`);
            return
        }

        const today = moment().format("YYYYMMDDHHmmss")
        const filename = `TIGO_POSTPORT_${today}.csv`;
        const dir = `${process.env.TMP_DIR}/${filename}`
        print.log(`Writing to file: ${dir}`);

        fs.writeFileSync(dir, csv, { encoding: 'utf-8' });
        print.log(`File written successfully`);

        const toPath = `${process.env.FTP_DIR}/${filename}`;
        print.log(`Uploading to FTP: ${toPath}`)
        await ftp.uploadFile(dir, toPath);

        print.log(`Uploaded successfully`);
        print.log('Updating database');
        await db.updateReport(ids);
        print.log(`Database updated`);

        print.log(`End of report ftp ===================================================================`)
    } catch (e) {
        console.log(e)
        print.log(`Error: ${e}`)
    }

}

if (process.argv.includes('--manual')) {
    task()
} else {
    if (process.env.CRON_REPORT) {
        console.log("init report as", process.env.CRON_REPORT)
        cron.schedule(process.env.CRON_REPORT, () => task())
    }
}
